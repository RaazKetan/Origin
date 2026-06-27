"""Shared Gemini client. Migrated from the deprecated `google.generativeai`
package to `google.genai`. Single module-level Client so we don't pay
construction cost per request.
"""

import os
from typing import Iterable, Union

from google import genai
from google.genai import types


_client = genai.Client(api_key=(os.getenv("GEMINI_API_KEY") or "").strip())


def generate(model: str, contents: Union[str, Iterable]) -> str:
    """One-shot text generation. Returns the response text."""
    resp = _client.models.generate_content(model=model, contents=contents)
    return resp.text or ""


def embed(text: str, model: str = "gemini-embedding-001", task_type: str = "RETRIEVAL_DOCUMENT") -> list[float]:
    """Embed a single string. Returns the vector as a plain list."""
    cfg = types.EmbedContentConfig(task_type=task_type) if task_type else None
    resp = _client.models.embed_content(model=model, contents=text, config=cfg)
    return list(resp.embeddings[0].values)


# Backward-compat: gemini_agent.py imported the raw module — give it back a
# `client` attr so callers can drop in `from .llm import client` if they want
# the lower-level surface.
client = _client
