import json
import os
import re
import asyncio
from typing import List, Dict, Any

from openai import AsyncOpenAI
from models import AnalyzeResponse, RiskScores
from prompts import SYSTEM_PROMPT, build_user_prompt
from chunker import count_tokens, chunk_text, deduplicate_list

_OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1")
_MAX_CHUNK_TOKENS = int(os.getenv("MAX_CHUNK_TOKENS", "3500"))

# Ollama exposes an OpenAI-compatible endpoint at /v1.
# api_key is required by the SDK but unused by Ollama.
_client = AsyncOpenAI(
    base_url=f"{_OLLAMA_BASE_URL}/v1",
    api_key="ollama",
)


def _extract_json(raw: str) -> Dict[str, Any]:
    """Parse JSON from model output, handling markdown code fences gracefully."""
    # Strip ```json ... ``` or ``` ... ``` wrappers
    stripped = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.IGNORECASE)
    stripped = re.sub(r"\s*```$", "", stripped.strip())
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        # Last resort: find the first {...} block in the response
        match = re.search(r"\{[\s\S]*\}", stripped)
        if match:
            return json.loads(match.group())
        raise ValueError(f"No valid JSON found in model response: {raw[:200]}")


async def _call_ollama(user_prompt: str) -> Dict[str, Any]:
    response = await _client.chat.completions.create(
        model=_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        # 0.1: low temperature for deterministic legal analysis — suppresses
        # hallucination and produces near-identical output for the same chunk.
        temperature=0.1,
        max_tokens=2000,
        # response_format is supported by most Ollama models (llama3, mistral, etc.)
        response_format={"type": "json_object"},
    )
    return _extract_json(response.choices[0].message.content)


async def analyze_text(url: str, text: str) -> AnalyzeResponse:
    total_tokens = count_tokens(text)

    if total_tokens <= _MAX_CHUNK_TOKENS:
        prompt = build_user_prompt(url, text)
        result = await _call_ollama(prompt)
        return _build_response(result)

    chunks = chunk_text(text, _MAX_CHUNK_TOKENS)
    total = len(chunks)

    # Run all chunk analyses concurrently
    tasks = [
        _call_ollama(build_user_prompt(url, chunk, i + 1, total))
        for i, chunk in enumerate(chunks)
    ]
    partials = await asyncio.gather(*tasks)
    return _merge_results(list(partials))


def _merge_results(partials: List[Dict[str, Any]]) -> AnalyzeResponse:
    data_collection: List[str] = []
    data_sharing: List[str] = []
    user_rights: List[str] = []
    hidden_clauses: List[str] = []
    summaries: List[str] = []
    explanations: List[str] = []
    # Max not average: a single high-risk clause is enough to flag a document.
    max_privacy = 0
    max_legal = 0
    max_lock_in = 0

    for p in partials:
        data_collection.extend(p.get("data_collection") or [])
        data_sharing.extend(p.get("data_sharing") or [])
        user_rights.extend(p.get("user_rights") or [])
        hidden_clauses.extend(p.get("hidden_clauses") or [])
        if p.get("summary"):
            summaries.append(p["summary"])
        if p.get("plain_english_explanation"):
            explanations.append(p["plain_english_explanation"])
        scores = p.get("risk_scores") or {}
        max_privacy = max(max_privacy, int(scores.get("privacy", 0)))
        max_legal = max(max_legal, int(scores.get("legal", 0)))
        max_lock_in = max(max_lock_in, int(scores.get("lock_in", 0)))

    return AnalyzeResponse(
        summary=" ".join(summaries),
        data_collection=deduplicate_list(data_collection),
        data_sharing=deduplicate_list(data_sharing),
        user_rights=deduplicate_list(user_rights),
        hidden_clauses=deduplicate_list(hidden_clauses),
        risk_scores=RiskScores(privacy=max_privacy, legal=max_legal, lock_in=max_lock_in),
        plain_english_explanation=" ".join(explanations),
    )


def _build_response(result: Dict[str, Any]) -> AnalyzeResponse:
    scores = result.get("risk_scores") or {}
    return AnalyzeResponse(
        summary=result.get("summary", ""),
        data_collection=result.get("data_collection") or [],
        data_sharing=result.get("data_sharing") or [],
        user_rights=result.get("user_rights") or [],
        hidden_clauses=result.get("hidden_clauses") or [],
        risk_scores=RiskScores(
            privacy=int(scores.get("privacy", 0)),
            legal=int(scores.get("legal", 0)),
            lock_in=int(scores.get("lock_in", 0)),
        ),
        plain_english_explanation=result.get("plain_english_explanation", ""),
    )
