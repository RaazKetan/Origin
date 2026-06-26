"""Pytest fixtures for the backend test suite.

Important: env vars MUST be set before `app.main` is imported, because
several modules read os.getenv at import time (DATABASE_URL, SECRET_KEY,
GEMINI_API_KEY). We import inside fixtures, not at module top, to honor that.
"""

import os
import tempfile
import pytest

# Required for SessionMiddleware and JWT — set before any app import.
os.environ.setdefault("SECRET_KEY", "test-secret-key-do-not-use-in-prod-32chars")
os.environ.setdefault("GEMINI_API_KEY", "dummy-test-key-not-used-due-to-mock")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
os.environ.setdefault("ADMIN_SECRET", "test-admin-secret")


@pytest.fixture(scope="session", autouse=True)
def _isolated_db():
    """Force a fresh SQLite DB per test session."""
    fd, path = tempfile.mkstemp(suffix=".db", prefix="conekt_test_")
    os.close(fd)
    os.environ["DATABASE_URL"] = f"sqlite:///{path}"
    yield
    try:
        os.unlink(path)
    except OSError:
        pass


@pytest.fixture(autouse=True)
def _mock_external_calls(monkeypatch):
    """Replace network-bound helpers with deterministic fakes.

    embed_text and the Gemini agent helpers hit Google's API in real runs.
    For tests we return small, well-shaped placeholders so router logic can
    be exercised without an API key or network.
    """
    from app import utils
    from app import gemini_agent
    from app import resume_parser
    from app.routers import requirements as requirements_router
    from app.routers import talent as talent_router

    fake_vector = [0.1] * 768

    def fake_embed(text, task_type="retrieval_document"):
        return list(fake_vector)

    monkeypatch.setattr(utils, "embed_text", fake_embed)
    # The routers import embed_text by name (`from ..utils import embed_text`),
    # so patching the original is not enough — patch every importer too.
    for mod_name in (
        "app.routers.profile_setup",
        "app.routers.profile",
        "app.routers.users",
        "app.routers.matching",
        "app.routers.requirements",
        "app.routers.talent",
        "app.routers.jobs",
        "app.routers.analysis_status",
        "app.background_jobs",
    ):
        import importlib
        try:
            mod = importlib.import_module(mod_name)
            if hasattr(mod, "embed_text"):
                monkeypatch.setattr(mod, "embed_text", fake_embed)
        except ImportError:
            pass

    # refine_pitch / analyze_repo / analyze_user_repos / analyze_user_repository
    monkeypatch.setattr(
        gemini_agent,
        "refine_pitch",
        lambda text: {"refined_pitch": text, "core_skills": ["python"]},
    )
    monkeypatch.setattr(
        gemini_agent,
        "analyze_repo",
        lambda readme, files: {"summary": "ok", "skills": []},
    )
    monkeypatch.setattr(
        gemini_agent,
        "analyze_user_repos",
        lambda username, repos: {
            "embedding_summary": "test summary",
            "core_skills": ["python", "react"],
        },
    )

    async def fake_analyze_user_repository(repo_url):
        return {
            "name": "fake-repo",
            "url": repo_url,
            "languages": ["Python"],
            "skills_detected": ["FastAPI"],
            "commits_count": 5,
        }

    monkeypatch.setattr(
        gemini_agent, "analyze_user_repository", fake_analyze_user_repository
    )

    # The background_jobs module imports analyze_user_repository inside the
    # function body via `from .gemini_agent import analyze_user_repository`,
    # so the monkeypatch on gemini_agent already covers it.

    # Resume parser: skip Gemini call entirely.
    async def fake_parse_resume(file_content, filename):
        return {
            "github_profile_url": "",
            "awards": [],
            "skills": ["Python"],
            "college_name": "Test U",
            "college_gpa": "4.0",
            "college_years": "2020-2024",
            "certifications": [],
        }

    monkeypatch.setattr(resume_parser, "parse_resume", fake_parse_resume)
    # profile_setup imports parse_resume by name
    from app.routers import profile_setup
    monkeypatch.setattr(profile_setup, "parse_resume", fake_parse_resume)


@pytest.fixture(autouse=True)
def _disable_rate_limit(monkeypatch):
    """SlowAPI rate limits would otherwise trip after 5-10 requests in a row."""
    from app.limiter import limiter
    limiter.enabled = False
    yield
    limiter.enabled = True


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    from app.main import app
    return TestClient(app)


def _register(client, suffix):
    payload = {
        "username": f"u{suffix}",
        "name": f"Tester {suffix}",
        "email": f"u{suffix}@example.com",
        "password": "TestPass123!",
    }
    r = client.post("/api/auth/register", json=payload)
    assert r.status_code == 200, r.text
    login = client.post(
        "/api/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    assert login.status_code == 200, login.text
    return login.json()["access_token"], r.json()


@pytest.fixture
def auth_token(client):
    import uuid
    token, _ = _register(client, suffix=uuid.uuid4().hex[:10])
    return token


@pytest.fixture
def auth_user(client):
    import uuid
    token, user = _register(client, suffix=uuid.uuid4().hex[:10])
    return {"token": token, "user": user, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture
def headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}
