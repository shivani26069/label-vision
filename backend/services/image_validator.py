"""
STEP 1-2: IMAGE ACQUISITION & NORMALIZATION
Validates and normalizes camera input to consistent format.
"""
import io
import cv2
import numpy as np
from PIL import Image
from typing import Dict, Tuple, Any


class ImageValidator:
    """Validates image quality without assuming user competence."""
    
    MIN_RESOLUTION = (720, 720)  # Lowered from 1080
    MIN_BLUR_SCORE = 0.10  # LOOSENED from 0.3 - less aggressive
    MIN_BRIGHTNESS = 0.08  # Darkened threshold
    MAX_BRIGHTNESS = 0.98  # Brightened threshold
    MIN_CONTRAST = 0.05  # LOOSENED from 0.1
    
    @staticmethod
    def validate(image_bytes: bytes) -> Dict[str, Any]:
        """
        Comprehensive image quality validation.
        
        Returns:
            {
                "is_valid": bool,
                "issues": [list of problems],
                "metrics": {
                    "resolution": (h, w),
                    "blur_score": float,
                    "brightness": float,
                    "contrast": float
                },
                "feedback": "user-friendly message"
            }
        """
        issues = []
        metrics = {}
        
        try:
            # Load image
            image = Image.open(io.BytesIO(image_bytes))
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            cv_image = np.array(image)
            gray = cv2.cvtColor(cv_image, cv2.COLOR_RGB2GRAY)
            h, w = gray.shape
            
            # Resolution check
            if h * w < (ImageValidator.MIN_RESOLUTION[0] * ImageValidator.MIN_RESOLUTION[1]):
                issues.append("Image resolution too low - move closer")
                metrics["resolution"] = (h, w)
            else:
                metrics["resolution"] = (h, w)
            
            # Blur detection (Laplacian variance)
            laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            blur_score = min(laplacian_var / 500, 1.0)  # Normalize
            metrics["blur_score"] = float(blur_score)
            
            if blur_score < ImageValidator.MIN_BLUR_SCORE:
                issues.append("Image is blurry - hold camera steady")
            
            # Brightness/Exposure check
            brightness = np.mean(gray) / 255.0
            metrics["brightness"] = float(brightness)
            
            if brightness < ImageValidator.MIN_BRIGHTNESS:
                issues.append("Too dark - move to better lighting")
            elif brightness > ImageValidator.MAX_BRIGHTNESS:
                issues.append("Too bright or washed out - reduce glare")
            
            # Contrast check (standard deviation of pixel values)
            contrast = np.std(gray) / 255.0
            metrics["contrast"] = float(contrast)
            
            if contrast < ImageValidator.MIN_CONTRAST:
                issues.append("Low contrast - improve lighting angle")
            
            # Determine validity
            is_valid = len(issues) == 0
            
            # Generate feedback
            if is_valid:
                feedback = "✅ Image quality acceptable"
            else:
                feedback = " | ".join(issues)
            
            return {
                "is_valid": is_valid,
                "issues": issues,
                "metrics": metrics,
                "feedback": feedback
            }
            
        except Exception as e:
            return {
                "is_valid": False,
                "issues": [f"Cannot read image: {str(e)}"],
                "metrics": {},
                "feedback": f"❌ {str(e)}"
            }


class ImageNormalizer:
    """
    STEP 2: IMAGE NORMALIZATION
    Makes input consistent regardless of device or orientation.
    """
    
    NORMALIZED_WIDTH = 1024
    
    @staticmethod
    def normalize(image_bytes: bytes) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Normalize image to consistent format.
        
        Returns:
            (normalized_image, metadata)
        """
        metadata = {}
        
        try:
            # Load
            image = Image.open(io.BytesIO(image_bytes))
            
            # Fix orientation (EXIF)
            try:
                from PIL import ImageOps
                image = ImageOps.exif_transpose(image)
                metadata["orientation_fixed"] = True
            except:
                metadata["orientation_fixed"] = False
            
            # Convert to RGB
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Resize to normalized width (maintain aspect ratio)
            original_size = image.size
            aspect_ratio = image.height / image.width
            new_height = int(ImageNormalizer.NORMALIZED_WIDTH * aspect_ratio)
            image = image.resize(
                (ImageNormalizer.NORMALIZED_WIDTH, new_height),
                Image.Resampling.LANCZOS
            )
            
            metadata["original_size"] = original_size
            metadata["normalized_size"] = image.size
            
            # Convert to numpy array - NO PREPROCESSING
            cv_image = np.array(image)
            
            metadata["denoised"] = False
            
            return cv_image, metadata
            
        except Exception as e:
            raise RuntimeError(f"Image normalization failed: {str(e)}")
