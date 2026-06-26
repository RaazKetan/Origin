"""Vercel Python entrypoint.

Vercel's Python runtime auto-detects an ASGI `app` variable in this module
and serves the FastAPI application from /api/*. The repo's existing backend
code lives under ../backend so we add it to sys.path before importing.
"""

import os
import sys

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_BACKEND_DIR = os.path.join(_REPO_ROOT, "backend")
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from app.main import app  # noqa: E402

__all__ = ["app"]
