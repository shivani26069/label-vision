import os
import io
import cv2
import numpy as np
from PIL import Image
import pytesseract
from dotenv import load_dotenv
from typing import Union

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
