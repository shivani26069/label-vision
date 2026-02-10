# LabelVision Backend

FastAPI backend with DeepSeek OCR (via Hugging Face) and lightweight NLP extraction for product label safety.

## Setup

1. Install Python 3.11+ and create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your PostgreSQL URL and optional Hugging Face token
```

3. Ensure PostgreSQL is running and the database exists:
```sql
CREATE DATABASE labelvision;
```

4. Run the server:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Endpoints

- `GET /health` – health check
- `POST /scan` – upload an image (multipart/form-data: file) → returns structured scan data
- `GET /history?page=1&limit=20` – paginated scan list
- `GET /history/{scan_id}` – full details for a scan

## Mobile integration

- Set your mobile app’s API base URL to `http://<YOUR_IP>:8000`
- Ensure CORS_ORIGINS in `.env` includes your mobile app’s origin (e.g., `exp://192.168.1.*:8081`)

## Testing

```bash
# Upload a label image
curl -X POST "http://localhost:8000/scan" -F "file=@/path/to/label.jpg"

# Get history
curl "http://localhost:8000/history"
```

## OCR Model

Uses `deepseek-ai/DeepSeek-OCR` via Hugging Face Transformers. The model is downloaded on first run. For large-scale hosting, consider:
- Caching the model files
- Running on GPU (CUDA)
- Using a dedicated inference server

## Extensibility

- Swap OCR: implement a new class in `services/ocr.py` with the same interface.
- Improve extraction: enhance regex/rules in `services/extract.py` or plug in an LLM for complex labels.
