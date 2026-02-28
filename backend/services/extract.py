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
        model = genai.GenerativeModel("gemini-2.5-flash")
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
    "Neutrogena", "Olay", "L'Oreal", "Maybelline", "Loreal",
    "Minimalist", "The Ordinary", "Mamaearth", "Himalaya", "Biotique",
    "Lakme", "Pond's", "Garnier", "Loreal Paris", "Plum",
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


def clean_ocr_text(text: str) -> str:
    """Remove [IMAGE X: filename.jpg] tags injected by OCR pipeline."""
    # Remove lines like [IMAGE 1: label_scan_1.jpg]
    cleaned = re.sub(r'\[IMAGE\s*\d+:\s*[^\]]+\]', '', text)
    # Remove duplicate blank lines left behind
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
    return cleaned.strip()


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

Return ONLY valid JSON. No markdown. No explanation. No code fences. Just the JSON object:"""


def _repair_json(raw: str) -> Dict[str, Any]:
    """
    Try multiple strategies to parse potentially truncated/broken JSON.
    Returns parsed dict or raises json.JSONDecodeError if all strategies fail.
    """

    # Strategy 1: direct parse
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Strategy 2: find the JSON object boundaries
    start = raw.find('{')
    if start == -1:
        raise json.JSONDecodeError("No JSON object found", raw, 0)
    raw = raw[start:]

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Strategy 3: truncated ingredients array — close it gracefully
    # Find last complete ingredient string before truncation
    # Pattern: find the last complete "..." string in ingredients array
    truncated = raw

    # Remove trailing incomplete string (unclosed quote)
    # Find last complete quoted string
    last_complete_quote = -1
    in_string = False
    escape_next = False
    for i, ch in enumerate(truncated):
        if escape_next:
            escape_next = False
            continue
        if ch == '\\':
            escape_next = True
            continue
        if ch == '"':
            if in_string:
                in_string = False
                last_complete_quote = i
            else:
                in_string = True

    if in_string and last_complete_quote != -1:
        # Truncate at the last complete string
        truncated = truncated[:last_complete_quote + 1]

    # Now close any unclosed structures
    # Count open brackets and braces
    depth_brace = 0
    depth_bracket = 0
    in_string = False
    escape_next = False
    for ch in truncated:
        if escape_next:
            escape_next = False
            continue
        if ch == '\\' and in_string:
            escape_next = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if not in_string:
            if ch == '{':
                depth_brace += 1
            elif ch == '}':
                depth_brace -= 1
            elif ch == '[':
                depth_bracket += 1
            elif ch == ']':
                depth_bracket -= 1

    # Add closing characters as needed
    closing = ''
    if depth_bracket > 0:
        closing += ']' * depth_bracket
    if depth_brace > 0:
        closing += '}' * depth_brace

    repaired = truncated + closing

    try:
        return json.loads(repaired)
    except json.JSONDecodeError:
        pass

    # Strategy 4: extract only known fields using regex on raw text
    # This is a last resort partial extraction
    result = {}

    pn = re.search(r'"product_name"\s*:\s*"([^"]+)"', raw)
    if pn:
        result["product_name"] = pn.group(1)

    br = re.search(r'"brand"\s*:\s*"([^"]+)"', raw)
    if br:
        result["brand"] = br.group(1)

    ex = re.search(r'"expiry_date"\s*:\s*"([^"]+)"', raw)
    if ex:
        result["expiry_date"] = ex.group(1)

    mg = re.search(r'"mfg_date"\s*:\s*"([^"]+)"', raw)
    if mg:
        result["mfg_date"] = mg.group(1)

    # Extract as many complete ingredients as possible
    ings = re.findall(r'"([A-Za-z][^"]{2,60})"', raw)
    # Filter out field names and other non-ingredient strings
    field_names = {"product_name", "brand", "expiry_date", "mfg_date", "ingredients", "warnings"}
    ings = [i for i in ings if i.lower() not in field_names and not i.startswith("0") and len(i) > 2]
    if ings:
        result["ingredients"] = ings[:30]

    if result:
        return result

    raise json.JSONDecodeError("All repair strategies failed", raw, 0)


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

    # Clean image tags before sending to Gemini
    cleaned_text = clean_ocr_text(ocr_text)
    prompt = GEMINI_PROMPT_TEMPLATE.format(ocr_text=cleaned_text[:3000])

    try:
        print("🤖 Sending to Gemini...")
        print(f"📝 TEXT BEING SENT TO GEMINI (first 500 chars):\n{cleaned_text[:500]}\n{'='*80}")
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.1,
                max_output_tokens=8192,  # Increased — gemini-2.5-flash uses thinking tokens
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

        result = _repair_json(raw)

        # If it's an array with single object, extract just the object
        if isinstance(result, list) and len(result) > 0:
            result = result[0]

        result["ingredients"] = result.get("ingredients") or []
        result["warnings"] = result.get("warnings") or []

        # If product_name still null, use heuristic on cleaned text
        if not result.get("product_name"):
            result["product_name"] = _heuristic_product_name(cleaned_text)

        print(f"✅ product_name={result.get('product_name')}, brand={result.get('brand')}")
        print(f"📊 ingredients count={len(result.get('ingredients', []))}")
        return result

    except json.JSONDecodeError as e:
        print(f"❌ JSON parse error after all repair attempts: {e} — falling back to regex")
        return _regex_fallback(cleaned_text)
    except Exception as e:
        print(f"❌ Gemini call failed: {e} — falling back to regex")
        return _regex_fallback(clean_ocr_text(ocr_text))


def _heuristic_product_name(text: str) -> str:
    """Pick the first meaningful line that looks like a product name."""
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    for line in lines[:20]:
        if len(line) < 3:
            continue
        # Skip image tags (should already be removed but just in case)
        if re.match(r'^\[IMAGE', line, re.IGNORECASE):
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

    # Clean image tags
    text = clean_ocr_text(text)

    # Brand — check known list first
    text_upper = text.upper()
    for brand in KNOWN_BRANDS:
        if brand.upper() in text_upper:
            result["brand"] = brand
            break

    # Expiry date
    exp = re.search(
        r'(?:exp(?:iry)?|best\s*before|use\s*by|bb|expiry\s*date)[:\s]*'
        r'([0-9]{1,2}[/\-][0-9]{1,2}(?:[/\-][0-9]{2,4})?|[A-Za-z]+\s+[0-9]{4})',
        text, re.IGNORECASE
    )
    if exp:
        result["expiry_date"] = exp.group(1)

    # Mfg date
    mfg = re.search(
        r'(?:mfg|manufactured|prod(?:uction)?|mfg\.\s*date)[:\s]*'
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
        score *= 0.5

    return {
        "product_name": extracted.get("product_name"),
        "brand":        extracted.get("brand"),
        "expiry_date":  extracted.get("expiry_date"),
        "mfg_date":     extracted.get("mfg_date"),
        "ingredients":  extracted.get("ingredients", []),
        "warnings":     extracted.get("warnings", []),
        "confidence":   round(min(score, 1.0), 3),
    }