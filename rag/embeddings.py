"""Embedding backends for Audit-X RAG.

Provides a unified interface supporting HuggingFace `sentence-transformers`
when configured and installed, plus a deterministic zero-network L2-normalized
semantic vector encoder combining Unicode-aware word/subword hashing and bigram features.
"""

from __future__ import annotations

import hashlib
import os
import re
from typing import Sequence

import numpy as np

DEFAULT_DIM = 384
TOKEN_RE = re.compile(r"[a-z0-9_]+|[\u0C80-\u0CFF]+")


def tokenize_unicode(text: str) -> list[str]:
    """Tokenize English, SKU/SQL identifiers, and Kannada Unicode text cleanly."""
    return TOKEN_RE.findall(text.lower())


class DenseEmbedder:
    """Dual-backend dense text embedder returning L2-normalized vectors."""

    def __init__(
        self,
        backend: str | None = None,
        model_name: str | None = None,
        dim: int = DEFAULT_DIM,
    ) -> None:
        self.backend_pref = (backend or os.getenv("EMBEDDING_BACKEND", "hybrid-local")).lower()
        self.model_name = model_name or os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
        self.dim = dim
        self._st_model = None
        self.active_backend = "semantic-hash-384"

        if self.backend_pref in ("sentence-transformers", "st", "huggingface"):
            try:
                from sentence_transformers import SentenceTransformer

                self._st_model = SentenceTransformer(self.model_name)
                self.dim = self._st_model.get_sentence_embedding_dimension() or DEFAULT_DIM
                self.active_backend = f"sentence-transformers:{self.model_name}"
            except Exception:
                self._st_model = None

    def encode(self, texts: Sequence[str]) -> list[list[float]]:
        """Encode a sequence of texts into L2-normalized float vectors."""
        if not texts:
            return []
        if self._st_model is not None:
            vecs = self._st_model.encode(list(texts), normalize_embeddings=True)
            return [v.astype(float).tolist() for v in vecs]

        return [self._encode_local(t).tolist() for t in texts]

    def encode_query(self, query: str) -> list[float]:
        """Encode a single query string into an L2-normalized float vector."""
        return self.encode([query])[0]

    def _encode_local(self, text: str) -> np.ndarray:
        """Deterministic 384-dim signed feature projection over words, bigrams, & Kannada trigrams."""
        vec = np.zeros(self.dim, dtype=np.float32)
        tokens = tokenize_unicode(text)
        if not tokens:
            return vec

        # Domain synonym smoothing anchors for light conceptual alignment without network weights
        synonyms = {
            "delay": ["sla", "late", "timeout", "wait"],
            "sla": ["10", "minute", "picking", "delivery"],
            "shrinkage": ["dump", "damaged", "expired", "dad", "loss"],
            "inventory": ["stock", "oos", "reorder", "sku", "bin"],
            "rider": ["delivery", "captain", "sinchana", "fleet"],
            "picker": ["thrupthi", "aisle", "barcode", "rack"],
            "elaneer": ["tender", "coconut", "ಎಳನೀರು"],
            "ಎಳನೀರು": ["tender", "coconut", "elaneer"],
            "ಕೊಬ್ಬರಿ": ["copra", "coconut"],
            "rag": ["bm25", "vector", "rrf", "rerank", "retrieval"],
        }

        weighted_features: list[tuple[str, float]] = []
        for idx, tok in enumerate(tokens):
            weighted_features.append((f"w:{tok}", 1.8))
            for exp in synonyms.get(tok, ()):
                weighted_features.append((f"w:{exp}", 0.55))
            if idx + 1 < len(tokens):
                weighted_features.append((f"b:{tok}_{tokens[idx + 1]}", 1.25))
            # Subword character trigrams capture morphological stems + Kannada scripts cleanly
            padded = f"<{tok}>"
            for i in range(max(0, len(padded) - 2)):
                weighted_features.append((f"c:{padded[i:i+3]}", 0.55))

        for feat, weight in weighted_features:
            digest = hashlib.blake2b(feat.encode("utf-8"), digest_size=8).digest()
            idx = int.from_bytes(digest[:4], "little") % self.dim
            sign = 1.0 if (digest[4] & 1) == 0 else -1.0
            vec[idx] += sign * weight

        norm = float(np.linalg.norm(vec))
        if norm > 1e-8:
            vec /= norm
        return vec

