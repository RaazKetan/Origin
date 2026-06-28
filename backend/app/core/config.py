"""Single source of truth for backend constants + env-driven settings."""

import os
from functools import lru_cache


class Settings:
    # --- Auth / JWT ---
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    JWT_ALGORITHM: str = os.getenv("ALGORITHM") or "HS256"
    ACCESS_TOKEN_TTL_MIN: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    SETUP_TOKEN_TTL_MIN: int = 15

    # --- Gemini ---
    GEMINI_API_KEY: str = (os.getenv("GEMINI_API_KEY") or "").strip()
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    GEMINI_PRO_MODEL: str = os.getenv("GEMINI_PRO_MODEL", "gemini-2.5-pro")
    EMBEDDING_MODEL: str = "gemini-embedding-001"
    EMBEDDING_DIMS: int = 3072

    # --- GitHub ---
    GITHUB_TOKEN: str = (os.getenv("GITHUB_TOKEN") or "").strip()
    GITHUB_CLIENT_ID: str = os.getenv("GITHUB_CLIENT_ID", "")
    GITHUB_CLIENT_SECRET: str = os.getenv("GITHUB_CLIENT_SECRET", "")
    CONTRIBUTION_GRID_SIZE: int = 53 * 7
    CONTRIBUTION_CACHE_HOURS: int = 6
    MAX_SELECTED_REPOS: int = 5

    # --- Google OAuth ---
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")

    # --- Resume upload ---
    MAX_RESUME_BYTES: int = 2 * 1024 * 1024
    PDF_MAGIC_BYTES: bytes = b"%PDF-"
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "/tmp/uploads/resumes")

    # --- Supabase Storage ---
    SUPABASE_URL: str = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    SUPABASE_SERVICE_KEY: str = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_SECRET_KEY")
        or ""
    )
    RESUME_BUCKET: str = "resumes"
    RESUME_SIGNED_URL_TTL_SECS: int = 3600

    # --- Chat ---
    MAX_CHAT_MESSAGE_CHARS: int = 2000

    # --- App URLs ---
    BACKEND_BASE_URL: str = os.getenv("BACKEND_BASE_URL", "http://localhost:8000/api")
    FRONTEND_BASE_URL: str = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")
    CORS_ORIGINS: list[str] = [
        o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()
    ]

    # --- Admin ---
    ADMIN_SECRET: str = os.getenv("ADMIN_SECRET", "")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
