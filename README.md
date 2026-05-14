# LabelVision

A mobile app that scans product labels using OCR and AI to extract structured information — product name, brand, expiry date, ingredients, and warnings — and reads results aloud for accessibility.

## What It Does

Point your camera at any product label, take one or more photos, and the app returns:

- Product name and brand
- Expiry and manufacture dates
- Full ingredients list
- Warnings and allergens
- Confidence score

Results are spoken aloud via text-to-speech, making the app usable without looking at the screen.

---

## Stack

| Layer | Technology |
|---|---|
| Mobile | React Native (Expo), Expo Router |
| Backend | FastAPI, Python 3.11+ |
| OCR | Tesseract (default), EasyOCR, PaddleOCR |
| Extraction | Gemini 2.5 Flash (primary), regex fallback |
| Database | PostgreSQL + SQLAlchemy |
| State | Zustand |

---

## Project Structure

```
label-vision/
├── backend/
│   ├── main.py                # FastAPI app, /scan and /scanMultiple endpoints
│   ├── models.py              # SQLAlchemy ScanHistory model
│   ├── database.py            # DB connection
│   └── services/
│       ├── ocr.py             # Tesseract / EasyOCR / PaddleOCR clients
│       ├── extract.py         # Gemini extraction + regex fallback
│       ├── image_validator.py # Image quality checks
│       ├── region_splitter.py # Front/back label region heuristics
│       ├── text_cleaner.py    # OCR noise removal
│       └── pipeline.py        # Full 10-step orchestration pipeline
└── create-anything/
    └── _/apps/mobile/
        └── src/
            ├── app/           # Expo Router screens (tabs: home, history, settings)
            ├── components/    # HapticButton, etc.
            └── utils/         # API client, scan store, TTS, haptics
```

---

## Setup

### Backend

**Requirements:** Python 3.11+, PostgreSQL, Tesseract OCR installed on the system.

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/labelvision
GOOGLE_API_KEY=your_gemini_api_key
OCR_ENGINE=tesseract            # or easyocr / paddleocr
CORS_ORIGINS=*
```

Create the database, then run:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Switching OCR engines:**

```env
OCR_ENGINE=easyocr              # Higher accuracy, slower
OCR_ENGINE=paddleocr            # Best for rotated/multilingual text
```

### Mobile

**Requirements:** Node.js, Expo CLI.

```bash
cd create-anything/_/apps/mobile
npm install
```

Set the backend URL in `.env`:

```env
EXPO_PUBLIC_API_BASE=http://<YOUR_LOCAL_IP>:8000
```

Start the dev server:

```bash
npx expo start
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/scan` | Upload a single image, returns extracted label data |
| `POST` | `/scanMultiple` | Upload up to 4 images, combines OCR before extraction |
| `GET` | `/history` | Paginated scan history |
| `GET` | `/history/{scan_id}` | Full detail for a single scan |

**Example:**

```bash
curl -X POST http://localhost:8000/scan -F "file=@label.jpg"
```

**Response:**

```json
{
  "product_name": "Ceramide Mochi Toner",
  "brand": "TONYMOLY",
  "expiry_date": "12/2026",
  "mfg_date": null,
  "ingredients": ["Water", "Glycerin", "Ceramide NP"],
  "warnings": ["Avoid contact with eyes"],
  "confidence": 0.82,
  "id": "a3f9c1b2"
}
```

---

## How Extraction Works

1. Image is validated for blur, brightness, and contrast
2. OCR runs on the full image (Tesseract/EasyOCR/PaddleOCR)
3. Raw text is cleaned and passed to Gemini 2.5 Flash with a structured prompt
4. If Gemini fails or is unavailable, a regex pipeline extracts fields as fallback
5. Confidence score is calculated from field coverage
6. Result is stored in PostgreSQL and returned to the app

---

## Accessibility

Voice announcements are on by default. The app speaks scan results, navigation cues, and error messages using `expo-speech`. Toggle in Settings → Voice Announcements.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `GOOGLE_API_KEY` | Recommended | Gemini API key for AI extraction |
| `OCR_ENGINE` | No | `tesseract` (default), `easyocr`, `paddleocr` |
| `CORS_ORIGINS` | No | Comma-separated allowed origins, default `*` |
| `EXPO_PUBLIC_API_BASE` | Yes (mobile) | Backend URL for the mobile app |

---

