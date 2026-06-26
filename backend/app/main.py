from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
import os
from dotenv import load_dotenv
from .database import Base, engine
from .routers import (
    users,
    ai,
    auth,
    matching,
    profile,
    chat,
    requirements,
    analyze_repo,
    talent,
    skill_gap,
    profile_setup,
    analysis_status,
    jobs,
    agent,
    github as github_router,
)
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from .limiter import limiter


# Skip create_all when running on serverless against a pooled Postgres; the
# Alembic migration is the source of truth there. Keep it for local SQLite.
if not os.getenv("SKIP_DB_CREATE_ALL"):
    Base.metadata.create_all(bind=engine)
app = FastAPI(title="Origin API")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY env var is required and must not use the dev default.")

app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)

# CORS middleware for frontend.
# CORS_ORIGINS is a comma-separated list. If unset (local dev), allow the
# default Vite dev server origin.
_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
allow_origins = [o.strip() for o in _origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all routers under /api so the same FastAPI app works behind a
# Vercel rewrite (`/api/*` -> Python function) and any other reverse proxy.
# API_PREFIX defaults to /api; set it to "" to run the API at root locally.
API_PREFIX = os.getenv("API_PREFIX", "/api")

api_router = APIRouter(prefix=API_PREFIX)


@api_router.get("/health")
def health():
    return {"status": "ok"}


api_router.include_router(auth.router)
api_router.include_router(profile_setup.router)
api_router.include_router(analysis_status.router)
api_router.include_router(users.router)
api_router.include_router(ai.router)
api_router.include_router(ai.public_router)
api_router.include_router(matching.router)
api_router.include_router(profile.router)
api_router.include_router(chat.router)
api_router.include_router(requirements.router)
api_router.include_router(analyze_repo.router)
api_router.include_router(talent.router)
api_router.include_router(skill_gap.router)
api_router.include_router(jobs.router)
api_router.include_router(agent.router)
api_router.include_router(github_router.router)
app.include_router(api_router)
