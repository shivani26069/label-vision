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
GEMINI_PROMPT_TEMPLATE = """You are a product label data extractor. Extract fields from this OCR text.

CRITICAL RULES:
- product_name: ALWAYS return something. If unsure, use the most prominent noun phrase. NEVER null.
- brand: Return brand/company name if found. null only if truly absent.
- expiry_date: Look for: exp, expiry, best before, use by, BB, EXP. Return the date string as-is.
- mfg_date: Look for: mfg, manufactured, prod, MFD. null if absent.
- ingredients: Split by commas or line breaks. Return array. [] if none found.
- warnings: Lines with: warning, caution, avoid, not suitable, allergen. Return array. [] if none.

EXAMPLES:
INPUT: TONYMOLY\\nCeramide Mochi Toner\\nEXP: 12/2026\\nIngredients: Water, Glycerin\\nWarning: Avoid eyes
OUTPUT: {{"product_name":"Ceramide Mochi Toner","brand":"TONYMOLY","expiry_date":"12/2026","mfg_date":null,"ingredients":["Water","Glycerin"],"warnings":["Avoid eyes"]}}

INPUT: Dove Beauty Bar\\nBest Before 06/2027\\nSodium Palmate, Water, Fragrance
OUTPUT: {{"product_name":"Dove Beauty Bar","brand":"Dove","expiry_date":"06/2027","mfg_date":null,"ingredients":["Sodium Palmate","Water","Fragrance"],"warnings":[]}}

NOW EXTRACT:
{ocr_text}

Return ONLY valid JSON, no markdown, no explanation:"""


def extract_with_gemini(ocr_text: str) -> Dict[str, Any]:
    empty = {
        "product_name": None, "brand": None,
        "expiry_date": None, "mfg_date": None,
        "ingredients": [], "warnings": [],
    }

    if not ocr_text or len(ocr_text.strip()) < 5:
        return empty
    if not model:
        print("⚠️ Gemini not available — using regex fallback")
        return empty

    prompt = GEMINI_PROMPT_TEMPLATE.format(ocr_text=ocr_text[:3000])

    try:
        print("🤖 Sending to Gemini...")
        print(f"📝 TEXT BEING SENT TO GEMINI (first 1000 chars):\n{ocr_text[:1000]}\n{'='*80}")
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.1,        # LOW temp = consistent, not creative
                max_output_tokens=4096, # INCREASED from 2048 to prevent cutoff
            ),
        )
        raw = response.text.strip()
        print(f"✅ Gemini raw (first 200): {raw[:200]}")
        print(f"📤 FULL GEMINI RESPONSE:\n{raw}\n{'='*80}")

        # Strip markdown fences if Gemini wraps in ```json ... ```
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0].strip()
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0].strip()

        # Find first [ ... ] (array) or { ... } (object) block in case there's any preamble
        match = re.search(r'[\[\{].*[\]\}]', raw, re.DOTALL)
        if match:
            raw = match.group(0)

        # Try to fix incomplete JSON with unterminated strings
        # Count unclosed quotes - if odd, add closing quote before closing brace
        try:
            result = json.loads(raw)
        except json.JSONDecodeError:
            # Try to repair: close any unterminated strings
            if raw.count('"') % 2 == 1:
                # Odd number of quotes = unterminated string
                # Find last opening quote and close it
                last_quote_pos = raw.rfind('"')
                if last_quote_pos > 0 and last_quote_pos < len(raw) - 1:
                    # Close the string and any unclosed JSON structures
                    repaired = raw[:last_quote_pos+1] + '}'
                    try:
                        result = json.loads(repaired)
                    except:
                        raise  # Re-raise if repair didn't work
            else:
                raise  # Re-raise original error

        # If it's an array with single object, extract just the object
        if isinstance(result, list) and len(result) > 0:
            result = result[0]
        
        result["ingredients"] = result.get("ingredients") or []
        result["warnings"] = result.get("warnings") or []

        # If product_name still null, use heuristic
        if not result.get("product_name"):
            result["product_name"] = _heuristic_product_name(ocr_text)

        print(f"✅ product_name={result.get('product_name')}, brand={result.get('brand')}")
        print(f"📊 FINAL EXTRACTED RESULT:\n{result}\n{'='*80}")
        return result

    except json.JSONDecodeError as e:
        print(f"❌ JSON parse error: {e} — falling back to regex")
        return _regex_fallback(ocr_text)
    except Exception as e:
        print(f"❌ Gemini call failed: {e} — falling back to regex")
        return _regex_fallback(ocr_text)


def _heuristic_product_name(text: str) -> str:
    """Pick the first meaningful line that looks like a product name."""
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    for line in lines[:20]:
        if len(line) < 3:
            continue
        if re.match(r'^[0-9\W]+$', line):   # skip pure numbers/symbols
            continue
        if re.match(r'^[0-9]{1,2}[/\-]', line):  # skip date lines
            continue
        if line.isupper() and len(line.split()) == 1:  # skip single brand word
            continue
        return line
    return "Unknown Product"


def _regex_fallback(text: str) -> Dict[str, Any]:
    """Pure regex extraction — runs when Gemini fails or is unavailable."""
    result = {
        "product_name": None, "brand": None,
        "expiry_date": None, "mfg_date": None,
        "ingredients": [], "warnings": [],
    }

    # Brand — check known list first
    text_upper = text.upper()
    for brand in KNOWN_BRANDS:
        if brand.upper() in text_upper:
            result["brand"] = brand
            break

    # Expiry date
    exp = re.search(
        r'(?:exp(?:iry)?|best\s*before|use\s*by|bb)[:\s]*'
        r'([0-9]{1,2}[/\-][0-9]{1,2}(?:[/\-][0-9]{2,4})?|[A-Za-z]+\s+[0-9]{4})',
        text, re.IGNORECASE
    )
    if exp:
        result["expiry_date"] = exp.group(1)

    # Mfg date
    mfg = re.search(
        r'(?:mfg|manufactured|prod(?:uction)?)[:\s]*'
        r'([0-9]{1,2}[/\-][0-9]{1,2}(?:[/\-][0-9]{2,4})?|[A-Za-z]+\s+[0-9]{4})',
        text, re.IGNORECASE
    )
    if mfg:
        result["mfg_date"] = mfg.group(1)

    # Ingredients block
    ing = re.search(
        r'ingredients?[:\s]*\n?(.+?)(?:\n\s*\n|\n[A-Z][a-z]+:|$)',
        text, re.IGNORECASE | re.DOTALL
    )
    if ing:
        parts = re.split(r'[,;\n]+', ing.group(1))
        result["ingredients"] = [
            p.strip().strip('•-*') for p in parts
            if p.strip() and len(p.strip()) > 2
        ][:30]

    # Warnings
    for line in text.split('\n'):
        if any(kw in line.lower() for kw in WARNING_KEYWORDS):
            cleaned = line.strip()
            if cleaned and len(cleaned) > 5:
                result["warnings"].append(cleaned)

    result["product_name"] = _heuristic_product_name(text)
    return result


def extract_from_pipeline(front_text, back_text, full_text=None):
    combined = f"{front_text}\n{back_text}".strip()
    if full_text:
        combined = f"{full_text}\n{combined}".strip()

    print(f"\n🔍 EXTRACT_FROM_PIPELINE INPUT TEXT:\n{combined}\n{'='*80}\n")

    if not combined or len(combined) < 5:
        return {
            "product_name": None, "brand": None,
            "expiry_date": None, "mfg_date": None,
            "ingredients": [], "warnings": [], "confidence": 0.0,
        }

    # Tier 1: Gemini (falls back to regex internally if it fails)
    extracted = extract_with_gemini(combined)

    # Tier 2: If Gemini still gave nothing useful, supplement with regex
    if not extracted.get("product_name") or extracted["product_name"] == "Unknown Product":
        print("⚠️ Supplementing with regex...")
        regex_result = _regex_fallback(combined)
        for field, value in regex_result.items():
            if not extracted.get(field) and value:
                extracted[field] = value

    # Better confidence scoring
    score = 0.0
    if extracted.get("product_name") and extracted["product_name"] != "Unknown Product":
        score += 0.35
    else:
        score += 0.10
    if extracted.get("brand"):
        score += 0.20
    if extracted.get("expiry_date"):
        score += 0.20
    if extracted.get("mfg_date"):
        score += 0.05
    if extracted.get("ingredients"):
        score += min(len(extracted["ingredients"]), 10) * 0.01
    if extracted.get("warnings"):
        score += 0.05
    if len(combined.strip()) < 50:
        score *= 0.5   # penalise bad scans

    return {
        "product_name": extracted.get("product_name"),
        "brand":        extracted.get("brand"),
        "expiry_date":  extracted.get("expiry_date"),
        "mfg_date":     extracted.get("mfg_date"),
        "ingredients":  extracted.get("ingredients", []),
        "warnings":     extracted.get("warnings", []),
        "confidence":   round(min(score, 1.0), 3),
    }
