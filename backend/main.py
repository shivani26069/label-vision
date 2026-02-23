import os
import uuid
import logging
import io
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import httpx
from PIL import Image
import numpy as np

from database import get_db, engine, Base
from models import ScanHistory
from services.ocr import get_ocr_client
from services.extract import extract_from_pipeline

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(
    title="LabelVision Backend",
    description="Direct OCR for product labels (Simple)",
    version="3.0.0",
)

# CORS
origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables
Base.metadata.create_all(bind=engine)

# OCR client (singleton) - use OCR_ENGINE env var ('tesseract' or 'easyocr')
try:
    ocr_client = get_ocr_client()
    print(f"✅ OCR Engine initialized: {os.getenv('OCR_ENGINE', 'tesseract')}")
except Exception as e:
    print(f"❌ Failed to initialize OCR engine: {e}")
    raise

# Helper: generate short UUID
def short_id() -> str:
    return str(uuid.uuid4())[:8]

# Health check
@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat() + "Z"}

# Scan endpoint - SIMPLE: Full image, no regions, no preprocessing
@app.post("/scan")
async def scan(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    logger.info(f"📥 Received file: {file.filename}")
    
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        image_bytes = await file.read()
        logger.info(f"📦 Image size: {len(image_bytes)} bytes")
        
        # Run OCR on FULL IMAGE at full resolution (this captures all text)
        logger.info("🔍 Running OCR on full image...")
        full_text = ocr_client.extract_text(image_bytes)
        logger.info(f"✅ OCR extracted {len(full_text)} chars")
        logger.info(f"📄 RAW OCR TEXT:\n{full_text}\n{'='*80}")  # Print full OCR text
        
        if len(full_text.strip()) < 5:
            result = {
                "product_name": None,
                "brand": None,
                "expiry_date": None,
                "mfg_date": None,
                "ingredients": [],
                "warnings": [],
                "confidence": 0.0,
                "id": str(uuid.uuid4())[:8],
                "failure_reason": "No text detected in image"
            }
        else:
            # Extract structured data from full text
            extraction = extract_from_pipeline(full_text, full_text, full_text)
            result = {
                "product_name": extraction.get("product_name"),
                "brand": extraction.get("brand"),
                "expiry_date": extraction.get("expiry_date"),
                "mfg_date": extraction.get("mfg_date"),
                "ingredients": extraction.get("ingredients", []),
                "warnings": extraction.get("warnings", []),
                "confidence": extraction.get("confidence", 0.0),
                "id": str(uuid.uuid4())[:8],
                "scannedAt": datetime.utcnow().isoformat() + "Z",
                "raw_ocr": full_text[:500]  # Debug info
            }
        
        # Store in DB
        scan_id = result["id"]
        db_scan = ScanHistory(
            id=scan_id,
            raw_text=full_text[:1000],
            extracted_json=result,
            confidence=result["confidence"],
        )
        db.add(db_scan)
        db.commit()
        db.refresh(db_scan)
        
        logger.info(f"✅ Scan complete: {scan_id}")
        return result
        
    except Exception as e:
        logger.error("❌ Scan error", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# Multi-image scan endpoint - accepts multiple images and combines OCR text
@app.post("/scanMultiple")
async def scan_multiple(
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    logger.info(f"📥 Received {len(files)} files for multi-image scan")
    
    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="At least one file required")
    
    try:
        combined_text = ""
        image_details = []
        
        # Process each image
        for idx, file in enumerate(files, 1):
            logger.info(f"📸 Processing image {idx}/{len(files)}: {file.filename}")
            
            if not file.content_type or not file.content_type.startswith("image/"):
                logger.warning(f"⚠️ Skipping non-image file: {file.filename}")
                continue
            
            image_bytes = await file.read()
            logger.info(f"📦 Image {idx} size: {len(image_bytes)} bytes")
            
            # Run OCR on each image
            logger.info(f"🔍 Running OCR on image {idx}...")
            image_text = ocr_client.extract_text(image_bytes)
            logger.info(f"✅ Image {idx} OCR extracted {len(image_text)} chars")
            logger.info(f"📄 IMAGE {idx} RAW OCR TEXT:\n{image_text}\n{'='*80}")
            
            image_details.append({
                "image_num": idx,
                "filename": file.filename,
                "text_length": len(image_text),
                "text": image_text
            })
            
            # Combine all text with separators
            combined_text += f"\n[IMAGE {idx}: {file.filename}]\n{image_text}\n"
        
        if len(image_details) == 0:
            raise HTTPException(status_code=400, detail="No valid images provided")
        
        logger.info(f"📝 Combined text from {len(image_details)} images: {len(combined_text)} chars total")
        logger.info(f"📊 COMBINED OCR TEXT FROM ALL IMAGES:\n{combined_text}\n{'='*80}")
        
        if len(combined_text.strip()) < 5:
            result = {
                "product_name": None,
                "brand": None,
                "expiry_date": None,
                "mfg_date": None,
                "ingredients": [],
                "warnings": [],
                "confidence": 0.0,
                "id": str(uuid.uuid4())[:8],
                "failure_reason": "No text detected in any image",
                "images_processed": len(image_details)
            }
        else:
            # Extract structured data from combined text
            # Pass all variants to extraction for better matching
            extraction = extract_from_pipeline(combined_text, combined_text, combined_text)
            result = {
                "product_name": extraction.get("product_name"),
                "brand": extraction.get("brand"),
                "expiry_date": extraction.get("expiry_date"),
                "mfg_date": extraction.get("mfg_date"),
                "ingredients": extraction.get("ingredients", []),
                "warnings": extraction.get("warnings", []),
                "confidence": extraction.get("confidence", 0.0),
                "id": str(uuid.uuid4())[:8],
                "scannedAt": datetime.utcnow().isoformat() + "Z",
                "raw_ocr": combined_text[:500],  # Debug info
                "images_processed": len(image_details),
                "image_sources": [d["filename"] for d in image_details]
            }
        
        # Store in DB
        scan_id = result["id"]
        db_scan = ScanHistory(
            id=scan_id,
            raw_text=combined_text[:2000],  # Store more text for multi-image scans
            extracted_json=result,
            confidence=result["confidence"],
        )
        db.add(db_scan)
        db.commit()
        db.refresh(db_scan)
        
        logger.info(f"✅ Multi-image scan complete: {scan_id} ({len(image_details)} images)")
        return result
        
    except Exception as e:
        logger.error("❌ Multi-image scan error", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
@app.get("/history")
def history(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    offset = (page - 1) * limit
    scans = (
        db.query(ScanHistory)
        .order_by(ScanHistory.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": s.id,
            "productName": s.extracted_json.get("product_name"),
            "brand": s.extracted_json.get("brand"),
            "confidence": s.confidence,
            "scannedAt": s.extracted_json.get("scannedAt") or s.created_at.isoformat() + "Z",
        }
        for s in scans
    ]

# History detail
@app.get("/history/{scan_id}")
def history_detail(scan_id: str, db: Session = Depends(get_db)):
    scan = db.query(ScanHistory).filter(ScanHistory.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return {
        "id": scan.id,
        "rawText": scan.raw_text,
        "extracted": scan.extracted_json,
        "confidence": scan.confidence,
        "scannedAt": scan.extracted_json.get("scannedAt"),
    }

# Run with: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
