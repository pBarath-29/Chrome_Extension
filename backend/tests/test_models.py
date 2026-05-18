import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from pydantic import ValidationError
from models import AnalyzeRequest, AnalyzeResponse, RiskScores


def test_risk_scores_valid():
    scores = RiskScores(privacy=5, legal=3, lock_in=7)
    assert scores.privacy == 5
    assert scores.legal == 3
    assert scores.lock_in == 7


def test_analyze_response_defaults():
    response = AnalyzeResponse(
        summary="Test",
        data_collection=[],
        data_sharing=[],
        user_rights=[],
        hidden_clauses=[],
        risk_scores=RiskScores(privacy=0, legal=0, lock_in=0),
        plain_english_explanation="Test explanation.",
    )
    assert response.error is None


def test_analyze_request_requires_url_and_text():
    with pytest.raises(ValidationError):
        AnalyzeRequest(url="https://example.com")  # missing text


def test_analyze_response_full():
    response = AnalyzeResponse(
        summary="Test ToS",
        data_collection=["Email", "IP address"],
        data_sharing=["Ad partners"],
        user_rights=["Right to delete"],
        hidden_clauses=["Mandatory arbitration"],
        risk_scores=RiskScores(privacy=4, legal=6, lock_in=2),
        plain_english_explanation="Some explanation.",
    )
    assert response.risk_scores.privacy == 4
    assert "Email" in response.data_collection
