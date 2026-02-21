import os
import io
import cv2
import numpy as np
from PIL import Image
import pytesseract
from dotenv import load_dotenv
from typing import Union
try:
    import easyocr
except ImportError:
    easyocr = None

load_dotenv()

class SimpleOCRClient:
    def __init__(self):
        self.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        # Tesseract config for product labels
        # PSM 3 = Fully automatic page segmentation (handles mixed text sizes/layouts)
        # OEM 3 = Legacy + LSTM mode (most accurate)
        self.config = r'--psm 3 --oem 3'

    def preprocess_image(self, image_input: Union[bytes, np.ndarray]) -> Image.Image:
        """
        NO preprocessing - Tesseract handles images best in their natural state.
        We just convert to PIL and return.
        """
        # Convert to PIL Image
        if isinstance(image_input, bytes):
            image = Image.open(io.BytesIO(image_input))
        else:
            # numpy array
            image = Image.fromarray(image_input)
        
        # Ensure RGB (Tesseract handles this well)
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        return image

    def extract_text(self, image_bytes: bytes) -> str:
        """Extract text from image bytes."""
        try:
            image = self.preprocess_image(image_bytes)
            text = pytesseract.image_to_string(image, config=self.config)
            return text.strip()
        except Exception as e:
            raise RuntimeError(f"OCR extraction failed: {e}")
    
    def extract_text_from_array(self, image_array: np.ndarray) -> str:
        """Extract text from numpy array (region)."""
        try:
            image = self.preprocess_image(image_array)
            text = pytesseract.image_to_string(image, config=self.config)
            return text.strip()
        except Exception as e:
            raise RuntimeError(f"OCR extraction failed: {e}")


class EasyOCRClient:
    """
    EasyOCR-based client for product label text extraction.
    Better at handling varied fonts, rotations, and multi-language text.
    Slower than Tesseract but higher quality output.
    """
    def __init__(self, languages: list = None):
        if not easyocr:
            raise ImportError("easyocr not installed. Run: pip install easyocr torch")
        
        self.languages = languages or ['en']
        # GPU will be used if available (torch detects automatically)
        self.reader = easyocr.Reader(self.languages, gpu=True)
        print(f"✅ EasyOCR initialized with languages: {self.languages}")
    
    def preprocess_image(self, image_input: Union[bytes, np.ndarray]) -> np.ndarray:
        """
        Minimal preprocessing - EasyOCR is robust to rotation and scale.
        Convert to numpy array for EasyOCR.
        """
        if isinstance(image_input, bytes):
            image = Image.open(io.BytesIO(image_input))
        else:
            image = Image.fromarray(image_input) if isinstance(image_input, np.ndarray) else image_input
        
        # Convert to RGB if needed
        if isinstance(image, Image.Image):
            if image.mode != 'RGB':
                image = image.convert('RGB')
            image = np.array(image)
        
        return image
    
    def extract_text(self, image_bytes: bytes) -> str:
        """Extract text from image bytes."""
        try:
            image = self.preprocess_image(image_bytes)
            # EasyOCR returns list of results: (text, confidence)
            results = self.reader.readtext(image, detail=0)
            text = '\n'.join(results)
            return text.strip()
        except Exception as e:
            raise RuntimeError(f"EasyOCR extraction failed: {e}")
    
    def extract_text_from_array(self, image_array: np.ndarray) -> str:
        """Extract text from numpy array (region)."""
        try:
            image = self.preprocess_image(image_array)
            results = self.reader.readtext(image, detail=0)
            text = '\n'.join(results)
            return text.strip()
        except Exception as e:
            raise RuntimeError(f"EasyOCR extraction failed: {e}")


def get_ocr_client(engine: str = None) -> Union[SimpleOCRClient, EasyOCRClient]:
    """
    Factory function to get OCR client based on env var or parameter.
    OCR_ENGINE env var: 'tesseract' (default) or 'easyocr'
    """
    engine = engine or os.getenv('OCR_ENGINE', 'tesseract').lower()
    
    if engine == 'easyocr':
        return EasyOCRClient()
    elif engine == 'tesseract':
        return SimpleOCRClient()
    else:
        raise ValueError(f"Unknown OCR engine: {engine}. Use 'tesseract' or 'easyocr'")

