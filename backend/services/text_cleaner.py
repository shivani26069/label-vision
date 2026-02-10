"""
STEP 5: TEXT CLEANING
Remove OCR garbage and normalize output.
"""
import re
from typing import List, Dict, Any


class TextCleaner:
    """Removes OCR noise and normalizes text."""
    
    MIN_LINE_LENGTH = 2
    SYMBOL_ONLY_PATTERN = re.compile(r'^[^a-zA-Z0-9]+$')
    EXTRA_WHITESPACE_PATTERN = re.compile(r'\s+')
    
    @staticmethod
    def clean_block(raw_text: str) -> str:
        """
        Clean a text block from OCR.
        
        - Remove symbol-only lines
        - Remove very short nonsense
        - Normalize whitespace
        - Preserve structure (newlines)
        """
        if not raw_text:
            return ""
        
        lines = raw_text.split('\n')
        cleaned_lines = []
        
        for line in lines:
            # Strip whitespace
            line = line.strip()
            
            # Skip empty lines
            if not line:
                continue
            
            # Skip symbol-only lines
            if TextCleaner.SYMBOL_ONLY_PATTERN.match(line):
                continue
            
            # Skip very short nonsense (single chars, etc)
            if len(line) < TextCleaner.MIN_LINE_LENGTH:
                continue
            
            # Normalize whitespace (multiple spaces -> single space)
            line = TextCleaner.EXTRA_WHITESPACE_PATTERN.sub(' ', line)
            
            cleaned_lines.append(line)
        
        return '\n'.join(cleaned_lines)
    
    @staticmethod
    def clean(ocr_results: Dict[str, str]) -> Dict[str, str]:
        """
        Clean all OCR text blocks.
        
        Args:
            {
                "front_text": raw,
                "back_text": raw,
                "middle_text": raw
            }
        
        Returns:
            {
                "front_text": cleaned,
                "back_text": cleaned,
                "middle_text": cleaned
            }
        """
        return {
            key: TextCleaner.clean_block(text)
            for key, text in ocr_results.items()
        }
