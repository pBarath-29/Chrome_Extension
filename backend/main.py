import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from models import AnalyzeRequest, AnalyzeResponse
from analyzer import analyze_text

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

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


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest):
    text = request.text.strip()

    if len(text) < 100:
        raise HTTPException(status_code=400, detail="Text too short (minimum 100 characters).")

    # Hard cap to prevent runaway chunking on malformed input
    if len(text) > 500_000:
        text = text[:500_000]

    logger.info("Analyzing %s (%d chars)", request.url, len(text))

    try:
        return await analyze_text(request.url, text)
    except Exception as exc:
        logger.error("Analysis failed for %s: %s", request.url, exc)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("BACKEND_PORT", "8000"))
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)
