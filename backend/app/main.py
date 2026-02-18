"""
NyayaAI – FastAPI Application
===============================
Main application module with all endpoints, middleware, and error handling.

Endpoints:
    POST /ask      – Submit a legal question and get a structured response.
    GET  /health   – Health check.
    POST /feedback – Submit user feedback.
"""

from __future__ import annotations

import json
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger

from app.config import settings
from app.models.schemas import (
    AskRequest,
    AskResponse,
    FeedbackRequest,
    HealthResponse,
    SourceChunk,
)
from app.rag.retriever import retriever
from app.services.llm_service import call_llm
from app.utils.security import sanitize_input, validate_query_length

# ── Configure logging ────────────────────────────────────────────────────
logger.add(
    "logs/nyayaai_{time}.log",
    rotation="10 MB",
    retention="7 days",
    level="INFO",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level:<8} | {name}:{function}:{line} - {message}",
)


# ── Simple in-memory rate limiter ────────────────────────────────────────
_rate_limit_store: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_MAX = 10       # max requests
RATE_LIMIT_WINDOW = 60    # per 60 seconds


def _check_rate_limit(client_ip: str) -> bool:
    """Return True if the client is within rate limits, False if exceeded."""
    now = time.time()
    timestamps = _rate_limit_store[client_ip]
    # Remove entries outside the window
    _rate_limit_store[client_ip] = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW]
    if len(_rate_limit_store[client_ip]) >= RATE_LIMIT_MAX:
        return False
    _rate_limit_store[client_ip].append(now)
    return True


# ── Lifespan (startup / shutdown) ────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the FAISS index on startup."""
    logger.info("NyayaAI starting up...")
    retriever.load_index()
    if retriever.is_loaded:
        logger.info("FAISS index loaded successfully ✓")
    else:
        logger.warning(
            "FAISS index not available. Run ingestion first: python -m app.rag.ingest"
        )
    yield
    logger.info("NyayaAI shutting down.")


# ── FastAPI app ──────────────────────────────────────────────────────────
app = FastAPI(
    title="NyayaAI – AI Legal Assistant for Indian Citizens",
    description=(
        "A multilingual RAG-powered legal assistant that explains Indian laws "
        "in simple language and provides actionable next steps."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Return service health status."""
    return HealthResponse(
        status="ok",
        version="1.0.0",
        service="NyayaAI Legal Assistant",
    )


@app.post("/ask", response_model=AskResponse, tags=["Legal Assistant"])
async def ask_question(body: AskRequest, request: Request):
    """
    Submit a legal question and receive a structured, bilingual response.

    The endpoint:
    1. Sanitises and validates the input.
    2. Retrieves relevant legal chunks from the FAISS index.
    3. Passes the context + query to the LLM via OpenRouter.
    4. Returns a structured response with disclaimer.
    """
    # Rate limit check
    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again later.")

    try:
        # ── 1. Sanitise & validate ───────────────────────────────────
        clean_query = sanitize_input(body.query)
        validate_query_length(
            clean_query,
            min_length=settings.MIN_QUERY_LENGTH,
            max_length=settings.MAX_QUERY_LENGTH,
        )

        logger.info(
            "Received query ({lang}): {q}",
            lang=body.language.value,
            q=clean_query[:100] + "..." if len(clean_query) > 100 else clean_query,
        )

        # ── 2. Retrieve relevant chunks ──────────────────────────────
        chunks = retriever.retrieve(clean_query)
        logger.info("Retrieved {n} chunks from FAISS.", n=len(chunks))

        # ── 3. Call LLM ──────────────────────────────────────────────
        llm_response = await call_llm(
            user_query=clean_query,
            context_chunks=chunks,
            language=body.language.value,
        )

        # ── 4. Build typed response ──────────────────────────────────
        sources = [
            SourceChunk(
                text=c["text"][:300] + "..." if len(c["text"]) > 300 else c["text"],
                law=c.get("law", ""),
                section=c.get("section", ""),
                source=c.get("source", ""),
                category=c.get("category", ""),
            )
            for c in chunks
        ]

        return AskResponse(
            summary=llm_response.get("summary", ""),
            relevant_law=llm_response.get("relevant_law", ""),
            your_rights=llm_response.get("your_rights", ""),
            next_steps=llm_response.get("next_steps", []),
            disclaimer=llm_response.get("disclaimer", AskResponse.model_fields["disclaimer"].default),
            sources=sources,
            language=body.language,
        )

    except ValueError as ve:
        logger.warning("Validation error: {err}", err=ve)
        raise HTTPException(status_code=422, detail=str(ve))
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error processing query: {err}", err=exc)
        raise HTTPException(
            status_code=500,
            detail="An internal error occurred while processing your query. Please try again.",
        )


@app.post("/feedback", tags=["Feedback"])
async def submit_feedback(body: FeedbackRequest, request: Request):
    """
    Submit feedback on a response. Stored as JSON lines for later analysis.
    """
    # Rate limit check
    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded.")

    try:
        feedback_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "query": body.query,
            "rating": body.rating,
            "comment": body.comment,
        }

        feedback_path = Path(settings.FEEDBACK_FILE)
        feedback_path.parent.mkdir(parents=True, exist_ok=True)

        with open(feedback_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(feedback_data, ensure_ascii=False) + "\n")

        logger.info("Feedback recorded: rating={r}", r=body.rating)
        return {"status": "success", "message": "Thank you for your feedback!"}

    except Exception as exc:
        logger.error("Error saving feedback: {err}", err=exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to save feedback. Please try again.",
        )


# ── Global exception handler ────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all exception handler for unhandled errors."""
    logger.error("Unhandled exception: {err}", err=exc)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An unexpected error occurred. Please try again later.",
        },
    )

