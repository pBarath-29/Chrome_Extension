import logging
import os
import time
from collections import defaultdict
from urllib.parse import urlparse

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from models import AnalyzeRequest, AnalyzeResponse
from analyzer import analyze_text

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

_OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1")

_rate_store: dict = defaultdict(list)
_RATE_LIMIT = 10
_RATE_WINDOW = 60

app = FastAPI(
    title="ToS Clarity API",
    description="AI-powered Terms of Service and Privacy Policy analyzer",
    version="1.0.0",
)

# Chrome extensions use chrome-extension:// origin — wildcard is required here.
# The server only binds to 127.0.0.1 so external traffic cannot reach it.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Content-Type"],
)


def _check_rate_limit(ip: str) -> bool:
    now = time.time()
    _rate_store[ip] = [t for t in _rate_store[ip] if now - t < _RATE_WINDOW]
    if len(_rate_store[ip]) >= _RATE_LIMIT:
        return False
    _rate_store[ip].append(now)
    return True


def _is_valid_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        return parsed.scheme in ("http", "https")
    except Exception:
        return False


@app.get("/health")
async def health():
    return {"status": "ok", "model": _OLLAMA_MODEL, "version": "1.0.0"}


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest, req: Request):
    client_ip = req.client.host if req.client else "unknown"

    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a moment.")

    if not _is_valid_url(request.url):
        raise HTTPException(status_code=400, detail="Invalid URL. Must be http or https.")

    text = request.text.strip()

    if len(text) < 100:
        raise HTTPException(status_code=400, detail="Text too short (minimum 100 characters).")

    truncated = False
    if len(text) > 500_000:
        text = text[:500_000]
        truncated = True

    logger.info("Analyzing %s (%d chars, truncated=%s)", request.url, len(text), truncated)

    result = await analyze_text(request.url, text)

    if truncated and not result.error:
        note = " (Note: document was truncated to 500,000 characters for analysis.)"
        result.plain_english_explanation = (result.plain_english_explanation or "") + note

    return result


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("BACKEND_PORT", "8000"))
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)
