"""Sensitive credentials, sourced from the environment. Never commit values."""

import os

SECRET_KEY = os.getenv("SECRET_KEY", "")

GEMINI_API_KEY = (os.getenv("GEMINI_API_KEY") or "").strip()

GITHUB_TOKEN = (os.getenv("GITHUB_TOKEN") or "").strip()
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")

SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
SUPABASE_SERVICE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_SECRET_KEY")
    or ""
)

ADMIN_SECRET = os.getenv("ADMIN_SECRET", "")
