"""Non-sensitive config: limits, model ids, fixed values, env-overridable URLs."""

import os

# --- Auth / JWT ---
JWT_ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_TTL_MIN = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
SETUP_TOKEN_TTL_MIN = 15

# --- Gemini ---
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_PRO_MODEL = os.getenv("GEMINI_PRO_MODEL", "gemini-2.5-pro")
EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIMS = 3072

# --- GitHub ---
GITHUB_GRAPHQL_URL = "https://api.github.com/graphql"
CONTRIBUTION_GRID_SIZE = 53 * 7
CONTRIBUTION_CACHE_HOURS = 6
MAX_SELECTED_REPOS = 5

# --- Resume upload ---
MAX_RESUME_BYTES = 2 * 1024 * 1024
PDF_MAGIC_BYTES = b"%PDF-"
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/tmp/uploads/resumes")

# --- Supabase storage ---
RESUME_BUCKET = "resumes"
RESUME_SIGNED_URL_TTL_SECS = 3600

# --- Chat ---
MAX_CHAT_MESSAGE_CHARS = 2000

# --- App URLs ---
BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:8000/api")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
