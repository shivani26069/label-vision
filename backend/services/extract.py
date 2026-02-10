import re
import json
import os
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables from .env file (explicit path)
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
load_dotenv(dotenv_path=env_path)

# Initialize Gemini with API key from .env
api_key = os.getenv("GOOGLE_API_KEY")
model = None

if api_key:
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.5-flash")  # Use gemini-2.5-flash (newer, better)
        print(f"✅ Gemini (gemini-2.5-flash) initialized successfully")
    except Exception as e:
        print(f"⚠️ Gemini initialization failed: {e}")
        model = None
else:
    print(f"⚠️ GOOGLE_API_KEY not found in .env file")

# STEP 6: BRAND & PRODUCT EXTRACTION
KNOWN_BRANDS = [
    "TONYMOLY", "LANEIGE", "AMOREPACIFIC", "INNISFREE", "ETUDE HOUSE",
    "COSRX", "PURITO", "ISNTREE", "ROUND LAB", "SKIN FUNCTIONAL",
    "DOVE", "NIVEA", "VASELINE", "CETAPHIL", "CeraVe",
    "Neutrogena", "Olay", "L'Oreal", "Maybelline", "Loreal"
]

# STEP 8: ALLERGEN & WARNING KEYWORDS
ALLERGEN_KEYWORDS = [
    "milk", "egg", "fish", "shellfish", "tree nuts", "peanuts", "wheat", "soybean",
    "gluten", "lactose", "casein", "sesame", "mustard", "celery", "lupin", "sulphites"
]

WARNING_KEYWORDS = [
    "warning", "may contain", "contains", "allergen", "not suitable", "caution", "risk",
    "external use", "avoid eyes", "keep away", "do not ingest", "patch test"
]

# ===== GEMINI EXTRACTION (PRIMARY METHOD) =====
def extract_with_gemini(ocr_text: str) -> Dict[str, Any]:
    """
    Use Google Gemini AI to intelligently extract product details from OCR text.
    Super smart - understands product label structure without regex.
    
    Returns:
    {
        "product_name": str or None,
        "brand": str or None,
        "expiry_date": str or None,
        "mfg_date": str or None,
        "ingredients": [str],
        "warnings": [str],
    }
    """
    if not ocr_text or len(ocr_text.strip()) < 5:
        return {
            "product_name": None,
            "brand": None,
            "expiry_date": None,
            "mfg_date": None,
            "ingredients": [],
            "warnings": [],
        }
    
    # Check if Gemini is initialized
    if not model:
        print(f"❌ Gemini model not initialized. Skipping AI extraction.")
        return {
            "product_name": None,
            "brand": None,
            "expiry_date": None,
            "mfg_date": None,
            "ingredients": [],
            "warnings": [],
        }
    
    prompt = f"""You are a product label analyzer. Extract the following information from this OCR-extracted product label text.

OCR TEXT:
{ocr_text}

Extract EXACTLY these fields (return as JSON):
1. product_name: The product name (e.g., "Ceramide Mochi Toner", "Vitamin C Serum")
2. brand: The brand/manufacturer name (e.g., "TONYMOLY", "DOVE", "Neutrogena")
3. expiry_date: The expiration/best-before date (format: MM/DD/YYYY or text, or null if not found)
4. mfg_date: The manufacturing date (format: MM/DD/YYYY or text, or null if not found)
5. ingredients: List of ingredients (split by commas or newlines, remove bullet points/dashes)
6. warnings: List of warnings or cautions (e.g., "Avoid eyes", "External use only")

RULES:
- Return ONLY valid information found in the text
- If something is not clearly present, return null (not "unknown" or empty string)
- Product name should be descriptive, not just the brand
- For ingredients, return an array of individual items, not the whole list as one string
- For warnings, return complete sentences or phrases

Return ONLY a valid JSON object, no other text:
{{
  "product_name": "...",
  "brand": "...",
  "expiry_date": "...",
  "mfg_date": "...",
  "ingredients": ["item1", "item2"],
  "warnings": ["warning1", "warning2"]
}}"""
    
    try:
        print(f"🤖 Sending OCR text to Gemini...")
        response = model.generate_content(prompt)
        response_text = response.text.strip()
        print(f"✅ Gemini response received")
        
        # Parse JSON from response
        # Sometimes Gemini wraps it in markdown code blocks, so extract JSON
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]
        
        result = json.loads(response_text)
        
        # Clean up arrays
        # Ensure arrays
        result["ingredients"] = result.get("ingredients") or []
        result["warnings"] = result.get("warnings") or []
        
        print(f"✅ Extracted: product_name={result.get('product_name')}, brand={result.get('brand')}")
        return result
        
    except Exception as e:
        # Fallback: return empty/None if Gemini fails
        print(f"❌ Gemini extraction failed: {e}")
        return {
            "product_name": None,
            "brand": None,
            "expiry_date": None,
            "mfg_date": None,
            "ingredients": [],
            "warnings": [],
        }

        return {
            "product_name": None,
            "brand": None,
            "expiry_date": None,
            "mfg_date": None,
            "ingredients": [],
            "warnings": [],
        }

# STEP 6: PRODUCT & BRAND EXTRACTION (IDENTITY FIRST)
def extract_brand(text: str) -> Optional[str]:
    """
    Extract brand from text.
    Only return if CONFIDENT. Return None if unsure.
    
    Priority:
    1. Exact match against KNOWN_BRANDS (high confidence)
    2. Isolated all-caps words that look like brands (medium confidence)
    """
    if not text:
        return None
    
    text_upper = text.upper()
    
    # Priority 1: Exact match against known brands (HIGH CONFIDENCE)
    for brand in KNOWN_BRANDS:
        if brand in text_upper:
            return brand
    
    # Priority 2: Look for all-caps lines that look like brands
    # But be CONSERVATIVE - only return if clearly a brand
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    all_caps_candidates = []
    
    for line in lines:
        # Must be all caps and reasonably short (brand convention)
        if line.isupper() and 2 <= len(line) <= 20:
            # Skip if it's clearly NOT a brand (descriptions, warnings)
            skip_keywords = ["warning", "contains", "nourishing", "bouncy", "moist", "for"]
            if any(kw in line.lower() for kw in skip_keywords):
                continue
            # Skip if it's a single letters (like "EE")
            if len(line) <= 2:
                continue
            all_caps_candidates.append(line)
    
    # Return first reasonable candidate, but be conservative
    # Only return if it looks legit (not random text)
    if all_caps_candidates:
        candidate = all_caps_candidates[0]
        # Only return if it's a real-looking brand name (has letters)
        if len(candidate) >= 3:
            return candidate
    
    # Return None if not confident (better to have no brand than wrong brand)
    return None


def extract_product_name(text: str) -> Optional[str]:
    """
    Extract product name from text.
    Heuristics:
    - Look for longer lines (product names)
    - Prefer lines with mixed case (brand is all caps)
    - Usually appear near the top
    """
    if not text:
        return None
    
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    # Look for lines that look like product names
    for line in lines[:15]:
        # Skip very short lines
        if len(line) < 3:
            continue
        # Skip pure numbers
        if re.match(r'^[0-9\W]+$', line):
            continue
        # Skip descriptions (these tend to be long and all caps)
        if len(line) > 40 and line.isupper():
            continue
        # Skip single all-caps words (likely brand, not product)
        if line.isupper() and len(line.split()) == 1:
            continue
        # This looks like a product name!
        return line
    
    return None

# STEP 7: DATE EXTRACTION (SAFETY-CRITICAL)
def extract_dates(back_text: str) -> Dict[str, Optional[str]]:
    """
    Extract expiry and manufacturing dates from back label.
    Safety-critical: never hallucinate dates.
    Only from back_text where dates actually appear.
    """
    if not back_text:
        return {"expiry_date": None, "mfg_date": None}
    
    patterns = {
        "expiry_date": re.compile(
            r'(?:exp|expiry|expires?|best\s*before|use\s*by)[:\s]*'
            r'([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}|[A-Za-z]+\s+[0-9]{4})',
            re.IGNORECASE
        ),
        "mfg_date": re.compile(
            r'(?:mfg|manufactured|prod|production|date\s*of)[:\s]*'
            r'([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}|[A-Za-z]+\s+[0-9]{4})',
            re.IGNORECASE
        ),
    }
    
    result = {"expiry_date": None, "mfg_date": None}
    
    for key, pattern in patterns.items():
        match = pattern.search(back_text)
        if match:
            raw_date = match.group(1)
            try:
                # Normalize numeric dates
                if re.match(r'^[0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}$', raw_date):
                    parts = re.split(r'[/-]', raw_date)
                    if len(parts) == 3:
                        if len(parts[2]) == 2:
                            parts[2] = "20" + parts[2]
                        result[key] = f"{parts[0]}/{parts[1]}/{parts[2]}"
                else:
                    # Keep text dates as-is
                    result[key] = raw_date
            except:
                # On parsing error, return what we found
                result[key] = raw_date
    
    # Explicitly return None if not found (never hallucinate)
    return result

# STEP 8: INGREDIENT & WARNING EXTRACTION
def extract_ingredients(back_text: str) -> List[str]:
    """
    Extract ingredient list from back label.
    Look for "Ingredients:" section and split by common delimiters.
    Best-effort, not guaranteed.
    """
    if not back_text:
        return []
    
    # Find "Ingredients:" header
    match = re.search(
        r'ingredients?[:\s]*\n?(.+?)(?:\n\s*\n|\n[A-Z][a-z]+:|$)',
        back_text,
        re.IGNORECASE | re.DOTALL
    )
    
    if not match:
        return []
    
    block = match.group(1)
    # Split by commas, semicolons, or newlines
    parts = re.split(r'[,;\n]+', block)
    
    ingredients = [
        p.strip().strip('•').strip('-').strip('*')
        for p in parts
        if p.strip() and len(p.strip()) > 2
    ]
    
    return ingredients[:30]  # Limit to first 30 items


def extract_warnings(back_text: str) -> List[str]:
    """
    Extract warning statements from back label.
    Look for lines containing warning keywords.
    """
    if not back_text:
        return []
    
    warnings = []
    lines = back_text.split('\n')
    
    for line in lines:
        if any(kw in line.lower() for kw in WARNING_KEYWORDS):
            cleaned = line.strip()
            if cleaned and len(cleaned) > 3:
                warnings.append(cleaned)
    
    return warnings

# STEP 9: CONFIDENCE SCORING (HONESTY LAYER)
def compute_confidence(front_text: str, back_text: str, extracted: Dict[str, Any]) -> float:
    """
    Score how confident we are in the results.
    Lenient scoring: reward for what IS found, don't penalize for what isn't.
    
    - product_name found → +0.40
    - brand found → +0.25 (optional, but good)
    - expiry_date found → +0.20
    - ingredients found → +0.10
    - warnings found → +0.05
    
    If product_name (core requirement) found, we start at 0.40 minimum.
    """
    score = 0.0
    
    # Product name is the core (required)
    if extracted.get("product_name"):
        score += 0.40
    else:
        return 0.0  # Without product name, confidence is 0
    
    # Brand is nice to have (optional)
    if extracted.get("brand"):
        score += 0.25
    
    # Expiry date is important for safety
    if extracted.get("expiry_date"):
        score += 0.20
    
    # Ingredients and warnings are helpful but not required
    if extracted.get("ingredients"):
        score += 0.10
    
    if extracted.get("warnings"):
        score += 0.05
    
    return min(score, 1.0)


# STEP 10: RESPONSE FORMATTING & EXTRACTION ORCHESTRATION
def extract_from_pipeline(
    front_text: str,
    back_text: str,
    full_text: Optional[str] = None
) -> Dict[str, Any]:
    """
    STEP 10: Main extraction orchestrator using Gemini AI.
    
    Input: cleaned front_text, back_text
    Output: structured schema matching requirements
    """
    
    try:
        # Combine front and back text for Gemini to analyze
        combined_text = f"{front_text}\n{back_text}".strip()
        
        if not combined_text or len(combined_text) < 5:
            return {
                "product_name": None,
                "brand": None,
                "expiry_date": None,
                "mfg_date": None,
                "ingredients": [],
                "warnings": [],
                "confidence": 0.0
            }
        
        # Use Gemini for intelligent extraction
        print(f"🤖 Using Gemini to extract product details...")
        gemini_result = extract_with_gemini(combined_text)
        
        # Compile results
        extracted = {
            "brand": gemini_result.get("brand"),
            "product_name": gemini_result.get("product_name"),
            "expiry_date": gemini_result.get("expiry_date"),
            "mfg_date": gemini_result.get("mfg_date"),
            "ingredients": gemini_result.get("ingredients", []),
            "warnings": gemini_result.get("warnings", [])
        }
        
        # Compute confidence based on what was extracted
        confidence = compute_confidence(front_text, back_text, extracted)
        
        # Format for output
        return {
            "product_name": extracted.get("product_name"),
            "brand": extracted.get("brand"),
            "expiry_date": extracted.get("expiry_date"),
            "mfg_date": extracted.get("mfg_date"),
            "ingredients": extracted.get("ingredients", []),
            "warnings": extracted.get("warnings", []),
            "confidence": confidence
        }
        
    except Exception as e:
        print(f"❌ Extraction failed: {e}")
        return {
            "product_name": None,
            "brand": None,
            "expiry_date": None,
            "mfg_date": None,
            "ingredients": [],
            "warnings": [],
            "confidence": 0.0,
            "failure_reason": str(e)
        }

