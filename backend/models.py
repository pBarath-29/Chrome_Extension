from typing import List, Optional
from pydantic import BaseModel


class AnalyzeRequest(BaseModel):
    url: str
    text: str


class RiskScores(BaseModel):
    privacy: int
    legal: int
    lock_in: int


class AnalyzeResponse(BaseModel):
    summary: str
    data_collection: List[str]
    data_sharing: List[str]
    user_rights: List[str]
    hidden_clauses: List[str]
    risk_scores: RiskScores
    plain_english_explanation: str
    error: Optional[str] = None
