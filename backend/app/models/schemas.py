"""
NyayaAI – Pydantic Schemas
===========================
Request/response models for the API layer.
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum


class Language(str, Enum):
    """Supported languages for NyayaAI responses."""
    ENGLISH = "en"
    HINDI = "hi"


class AskRequest(BaseModel):
    """Incoming user query for legal assistance."""
    query: str = Field(
        ...,
        min_length=5,
        max_length=2000,
        description="The legal question or document text to analyse",
        examples=["What are my rights if a landlord refuses to return my security deposit?"],
    )
    language: Language = Field(
        default=Language.ENGLISH,
        description="Preferred response language",
    )


class SourceChunk(BaseModel):
    """A single retrieved source chunk for transparency."""
    text: str = Field(..., description="Retrieved text excerpt")
    law: str = Field(default="", description="Name of the law/act")
    section: str = Field(default="", description="Section number")
    source: str = Field(default="", description="Source document")
    category: str = Field(default="", description="Legal category")


class AskResponse(BaseModel):
    """Structured legal assistant response."""
    summary: str = Field(..., description="Plain-language explanation")
    relevant_law: str = Field(default="", description="Applicable law/act")
    your_rights: str = Field(default="", description="Rights of the citizen")
    next_steps: List[str] = Field(default_factory=list, description="Actionable next steps")
    disclaimer: str = Field(
        default="This is informational only and does not constitute legal advice. Please consult a qualified lawyer for your specific situation.",
        description="Legal disclaimer",
    )
    sources: List[SourceChunk] = Field(
        default_factory=list,
        description="Retrieved source chunks used to generate the answer",
    )
    language: Language = Field(default=Language.ENGLISH)


class FeedbackRequest(BaseModel):
    """User feedback on a response."""
    query: str = Field(..., description="Original query")
    rating: int = Field(..., ge=1, le=5, description="Rating from 1 to 5")
    comment: Optional[str] = Field(default=None, max_length=1000, description="Optional comment")


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = Field(default="ok")
    version: str = Field(default="1.0.0")
    service: str = Field(default="NyayaAI Legal Assistant")
