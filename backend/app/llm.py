"""Shared google-genai client + generate/embed helpers."""

from typing import Iterable, Union

from google import genai
from google.genai import types

from .core.config import settings


_client = genai.Client(api_key=settings.GEMINI_API_KEY)


def generate(model: str = None, contents: Union[str, Iterable] = "") -> str:
    """One-shot text generation."""
    resp = _client.models.generate_content(
        model=model or settings.GEMINI_MODEL,
        contents=contents,
    )
    return resp.text or ""


def embed(text: str, model: str = None, task_type: str = "RETRIEVAL_DOCUMENT") -> list[float]:
    """Embed a single string. Returns the vector as a plain list."""
    cfg = types.EmbedContentConfig(task_type=task_type) if task_type else None
    resp = _client.models.embed_content(
        model=model or settings.EMBEDDING_MODEL,
        contents=text,
        config=cfg,
    )
    return list(resp.embeddings[0].values)


client = _client
