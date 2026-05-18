import pytest
import sys
import os
from unittest.mock import AsyncMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import analyzer
from analyzer import _build_response, _merge_results, analyze_text
from models import AnalyzeResponse
from conftest import SAMPLE_ANALYSIS


# ── _build_response ───────────────────────────────────────────────────────────

def test_build_response_with_full_result():
    result = _build_response(SAMPLE_ANALYSIS)
    assert isinstance(result, AnalyzeResponse)
    assert result.summary == SAMPLE_ANALYSIS["summary"]
    assert result.risk_scores.privacy == 6
    assert result.risk_scores.legal == 8
    assert "Email address" in result.data_collection


def test_build_response_missing_fields():
    result = _build_response({})
    assert result.summary == ""
    assert result.data_collection == []
    assert result.risk_scores.privacy == 0
    assert result.risk_scores.legal == 0
    assert result.risk_scores.lock_in == 0


# ── _merge_results ────────────────────────────────────────────────────────────

def test_merge_results_takes_max_risk_scores():
    partial_a = {"risk_scores": {"privacy": 3, "legal": 2, "lock_in": 1}}
    partial_b = {"risk_scores": {"privacy": 7, "legal": 4, "lock_in": 9}}
    result = _merge_results([partial_a, partial_b])
    assert result.risk_scores.privacy == 7
    assert result.risk_scores.legal == 4
    assert result.risk_scores.lock_in == 9


def test_merge_results_deduplicates_lists():
    partial_a = {
        "risk_scores": {"privacy": 1, "legal": 1, "lock_in": 1},
        "data_collection": ["Email address", "IP address"],
    }
    partial_b = {
        "risk_scores": {"privacy": 1, "legal": 1, "lock_in": 1},
        "data_collection": ["Email address", "Device information"],
    }
    result = _merge_results([partial_a, partial_b])
    # "Email address" appears in both — should be deduplicated
    email_count = sum(1 for item in result.data_collection if "Email" in item)
    assert email_count == 1
    assert any("IP" in item for item in result.data_collection)
    assert any("Device" in item for item in result.data_collection)


# ── analyze_text (integration with mocked LLM) ───────────────────────────────

@pytest.mark.asyncio
async def test_analyze_text_single_chunk():
    with patch.object(analyzer, "_call_ollama", new=AsyncMock(return_value=SAMPLE_ANALYSIS)):
        result = await analyze_text("https://example.com/tos", "A" * 100)
    assert isinstance(result, AnalyzeResponse)
    assert result.risk_scores.privacy == 6


@pytest.mark.asyncio
async def test_analyze_text_multi_chunk():
    # Force chunking by passing text that exceeds _MAX_CHUNK_TOKENS
    long_text = ("This is a sentence about data. " * 600)  # ~4500 tokens
    call_count = 0

    async def mock_call(prompt):
        nonlocal call_count
        call_count += 1
        return SAMPLE_ANALYSIS

    with patch.object(analyzer, "_call_ollama", new=mock_call):
        result = await analyze_text("https://example.com/tos", long_text)

    assert call_count > 1, "Expected multiple LLM calls for a long document"
    assert isinstance(result, AnalyzeResponse)
