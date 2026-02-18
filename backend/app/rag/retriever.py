"""
NyayaAI – RAG Retriever
=========================
Loads the persisted FAISS index and performs similarity search
to retrieve top-k relevant legal chunks for a given query.
"""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

import faiss
import numpy as np
from loguru import logger

from app.config import settings
from app.services.embedding_service import embedding_service


class Retriever:
    """
    Thread-safe singleton retriever that lazily loads the FAISS index.
    Returns the top-k most relevant chunks with their metadata.
    """

    _instance: Optional[Retriever] = None
    _lock = threading.Lock()

    def __new__(cls) -> Retriever:
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._index = None
                    cls._instance._texts = None
                    cls._instance._metadatas = None
                    cls._instance._loaded = False
        return cls._instance

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def load_index(self, index_path: str | None = None) -> None:
        """
        Load the FAISS index and associated data from disk.

        Args:
            index_path: Directory containing index.faiss, texts.npy, metadatas.npy.
        """
        index_path = index_path or settings.FAISS_INDEX_PATH
        idx_dir = Path(index_path)

        index_file = idx_dir / "index.faiss"
        texts_file = idx_dir / "texts.npy"
        metadatas_file = idx_dir / "metadatas.npy"

        if not index_file.exists():
            logger.warning(
                "FAISS index not found at {path}. Run the ingestion pipeline first: "
                "python -m app.rag.ingest",
                path=index_file,
            )
            return

        self._index = faiss.read_index(str(index_file))
        self._texts = np.load(str(texts_file), allow_pickle=True)
        self._metadatas = np.load(str(metadatas_file), allow_pickle=True)
        self._loaded = True

        logger.info(
            "FAISS index loaded: {n} vectors",
            n=self._index.ntotal,
        )

    def retrieve(
        self,
        query: str,
        top_k: int | None = None,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve the top-k most relevant chunks for the given query.

        Args:
            query: The user's search query.
            top_k: Number of chunks to retrieve (defaults to settings.TOP_K).

        Returns:
            List of dicts, each containing:
                - text:     The chunk text
                - law:      Associated law/act name
                - section:  Section identifier
                - source:   Source PDF filename
                - category: Legal category
                - score:    Similarity score (lower L2 distance = more similar)
        """
        if not self._loaded or self._index is None:
            logger.warning("Index not loaded. Attempting to load now...")
            self.load_index()
            if not self._loaded:
                logger.error("Failed to load index. Returning empty results.")
                return []

        top_k = top_k or settings.TOP_K

        # Embed the query
        query_embedding = embedding_service.embed_query(query)
        query_vector = np.array([query_embedding], dtype="float32")

        # Search FAISS
        distances, indices = self._index.search(query_vector, min(top_k, self._index.ntotal))

        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx == -1:  # FAISS returns -1 for empty slots
                continue
            meta = self._metadatas[idx] if isinstance(self._metadatas[idx], dict) else {}
            results.append(
                {
                    "text": str(self._texts[idx]),
                    "law": meta.get("law", ""),
                    "section": meta.get("section", ""),
                    "source": meta.get("source", ""),
                    "category": meta.get("category", ""),
                    "score": float(dist),
                }
            )

        logger.info(
            "Retrieved {n} chunks for query (top_k={k})",
            n=len(results),
            k=top_k,
        )
        return results


# ── Module-level convenience instance ────────────────────────────────────
retriever = Retriever()
