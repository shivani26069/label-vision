"""
PIPELINE ORCHESTRATOR
Combines all 10 steps into a single, testable pipeline.
"""
import numpy as np
from typing import Dict, Any, Tuple
from services.image_validator import ImageValidator, ImageNormalizer
from services.region_splitter import RegionSplitter
from services.ocr import SimpleOCRClient
from services.text_cleaner import TextCleaner
from services.extract import extract_from_pipeline


class LabelVisionPipeline:
    """
    Complete image-to-structured-data pipeline.
    10 steps, each with clear inputs/outputs.
    """
    
    def __init__(self):
        self.ocr_client = SimpleOCRClient()
    
    def process(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Process image through complete 10-step pipeline.
        Now with fallback logic: if validation fails, still attempt OCR but penalize confidence.
        
        Returns:
            {
                "product_name": "...",
                "brand": "...",
                "expiry_date": "...",
                "mfg_date": "...",
                "ingredients": [...],
                "warnings": [...],
                "confidence": 0.0-1.0,
                "pipeline": {
                    "validation": {...},
                    "regions": {...},
                    "ocr": {...}
                }
            }
        """
        result = {
            "product_name": None,
            "brand": None,
            "expiry_date": None,
            "mfg_date": None,
            "ingredients": [],
            "warnings": [],
            "confidence": 0.0,
            "pipeline": {}
        }
        
        validation_penalty = 0.0  # Track if validation failed
        
        try:
            # STEP 1: IMAGE VALIDATION (no changes to image)
            print("🖼️ STEP 1: Validating image...")
            validation = ImageValidator.validate(image_bytes)
            result["pipeline"]["validation"] = validation
            
            if not validation["is_valid"]:
                print(f"⚠️ Validation issues detected (continuing anyway): {validation['feedback']}")
                validation_penalty = 0.3
            
            # Load original image WITHOUT resizing (keep full resolution for OCR!)
            import io
            from PIL import Image
            original_image = Image.open(io.BytesIO(image_bytes))
            if original_image.mode != 'RGB':
                original_image = original_image.convert('RGB')
            original_array = np.array(original_image)
            
            print(f"✅ Using original image: {original_array.shape}")
            
            # STEP 2: REGION SPLITTING (on full-size image)
            print("🔀 STEP 2: Splitting into front/back regions...")
            regions = RegionSplitter.split(original_array)
            result["pipeline"]["regions"] = {
                "front_shape": regions["front_region"].shape,
                "back_shape": regions["back_region"].shape,
                "original_shape": original_array.shape
            }
            print(f"✅ Front region: {regions['front_region'].shape}")
            print(f"✅ Back region: {regions['back_region'].shape}")
            
            # STEP 3: OCR EXECUTION (region-specific)
            print("🔍 STEP 3: Running OCR on each region...")
            front_ocr = self.ocr_client.extract_text_from_array(regions["front_region"])
            back_ocr = self.ocr_client.extract_text_from_array(regions["back_region"])
            full_ocr = self.ocr_client.extract_text_from_array(regions["full_image"])
            
            result["pipeline"]["ocr"] = {
                "front_text_length": len(front_ocr),
                "back_text_length": len(back_ocr),
                "full_text_length": len(full_ocr)
            }
            print(f"✅ Front OCR: {len(front_ocr)} chars")
            print(f"✅ Back OCR: {len(back_ocr)} chars")
            print(f"✅ Full OCR: {len(full_ocr)} chars")
            
            # Check if OCR found anything meaningful
            if len(full_ocr.strip()) < 5:
                print("⚠️ OCR found minimal text - image may be unreadable")
                result["failure_reason"] = "Label text could not be detected. Please try a clearer image."
                result["confidence"] = 0.0
                return result
            
            # STEP 4: TEXT CLEANING
            print("🧹 STEP 4: Cleaning OCR text...")
            cleaned_ocr = TextCleaner.clean({
                "front_text": front_ocr,
                "back_text": back_ocr
            })
            front_text = cleaned_ocr["front_text"]
            back_text = cleaned_ocr["back_text"]
            print(f"✅ Cleaned text ready")
            
            # STEP 5-9: EXTRACTION & SCORING
            print("📊 STEP 5-9: Extracting structured data...")
            extraction = extract_from_pipeline(front_text, back_text, full_ocr)
            
            # Apply validation penalty to confidence
            if validation_penalty > 0:
                extraction["confidence"] = max(0, extraction["confidence"] - validation_penalty)
            
            # Merge results
            result.update(extraction)
            result["pipeline"]["raw_text"] = {
                "front": front_text[:200],
                "back": back_text[:200]
            }
            
            print(f"✅ Pipeline complete - Confidence: {extraction['confidence']}")
            return result
            
        except Exception as e:
            print(f"❌ Pipeline error: {str(e)}")
            result["failure_reason"] = str(e)
            return result
