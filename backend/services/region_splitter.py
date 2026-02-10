"""
STEP 3: REGION HEURISTICS
Split image into logical regions without ML - just geometry.
"""
import numpy as np
from typing import Dict, Tuple


class RegionSplitter:
    """
    Splits image into front/back regions based on simple geometry.
    No ML, just deterministic rules.
    """
    
    FRONT_RATIO = 0.40  # Top 40% is likely front label
    BACK_RATIO = 0.40   # Bottom 40% is likely back label
    
    @staticmethod
    def split(image: np.ndarray) -> Dict[str, np.ndarray]:
        """
        Split image into front and back regions.
        
        Args:
            image: normalized RGB image (H, W, 3)
        
        Returns:
            {
                "front_region": image,
                "back_region": image,
                "middle_region": image,
                "full_image": image
            }
        """
        h, w = image.shape[:2]
        
        front_end = int(h * RegionSplitter.FRONT_RATIO)
        back_start = int(h * (1 - RegionSplitter.BACK_RATIO))
        
        return {
            "front_region": image[0:front_end, :],
            "back_region": image[back_start:h, :],
            "middle_region": image[front_end:back_start, :],
            "full_image": image,
            "metadata": {
                "front_end_y": front_end,
                "back_start_y": back_start
            }
        }
