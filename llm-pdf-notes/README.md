# LLM PDF Notes

Full-stack PDF-to-notes application.

## Stack
- Frontend: HTML/CSS/JavaScript
- Backend: FastAPI + PyPDF
- LLM: OpenAI-compatible Chat Completions API

## Flow
PDF upload → text extraction → chunking → LLM section notes → consolidated Markdown notes.

## Run backend
```bash
cd llm-pdf-notes/backend
python -m venv .venv
# Windows: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
# copy .env.example to .env and set your API values
uvicorn main:app --reload --port 8000
```

Required `.env` values:
```env
LLM_API_KEY=your_api_key_here
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=your_model_name_here
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

## Run frontend
```bash
cd llm-pdf-notes/frontend
python -m http.server 5173
```
Open `http://localhost:5173`.

## Deploy
Backend (Render): root `llm-pdf-notes/backend`, build `pip install -r requirements.txt`, start `uvicorn main:app --host 0.0.0.0 --port $PORT`.

Frontend: deploy `llm-pdf-notes/frontend` as a static site. The frontend uses `http://localhost:8000` by default. For production set `window.PDF_NOTES_API_URL` before loading `app.js` and add the frontend domain to backend `ALLOWED_ORIGINS`.

## Notes
Text-based PDFs are supported. Scanned/image-only PDFs return a clear error and would need OCR.
