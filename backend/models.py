# backend/models.py
"""
Modèles Pydantic pour l'API
"""
from pydantic import BaseModel


class ChatRequest(BaseModel):
    conversation_id: str
    user_id: str
    message: str
    history: list[dict]


class ChatResponse(BaseModel):
    answer: str
    chunk_ids: list[str]
    summary_updated: bool


class ProcessPDFRequest(BaseModel):
    document_id: str
    file_path: str
    visibility: str
    owner_user_id: str


class ProcessPDFResponse(BaseModel):
    chunks_created: int
    chunks: list[dict]