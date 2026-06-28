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
    import importlib

    def patch_everywhere(symbol, fake, modules):
        """Patch a symbol in its source module and every module that imported
        it by name (routers bind `from app.services.x import fn` at import)."""
        for mod_name in modules:
            try:
                mod = importlib.import_module(mod_name)
            except ImportError:
                continue
            if hasattr(mod, symbol):
                monkeypatch.setattr(mod, symbol, fake)

    fake_vector = [0.1] * 768

    def fake_embed(text, task_type="retrieval_document"):
        return list(fake_vector)

    patch_everywhere("embed_text", fake_embed, [
        "app.services.embeddings",
        "app.routers.profile_setup", "app.routers.profile", "app.routers.users",
        "app.routers.matching", "app.routers.requirements", "app.routers.talent",
        "app.routers.jobs", "app.routers.analysis_status", "app.background_jobs",
        "app.agents.search", "app.seed_data",
    ])

    patch_everywhere("refine_pitch",
        lambda text: {"refined_pitch": text, "core_skills": ["python"]},
        ["app.services.pitch", "app.routers.ai", "app.routers.requirements"])

    patch_everywhere("analyze_repo",
        lambda readme, files: {"summary": "ok", "skills": []},
        ["app.services.repo_analysis", "app.routers.ai"])

    patch_everywhere("analyze_user_repos",
        lambda username, repos: {"embedding_summary": "test summary", "core_skills": ["python", "react"]},
        ["app.services.repo_analysis", "app.routers.profile"])

    async def fake_analyze_user_repository(repo_url):
        return {"name": "fake-repo", "url": repo_url, "languages": ["Python"],
                "skills_detected": ["FastAPI"], "commits_count": 5}

    patch_everywhere("analyze_user_repository", fake_analyze_user_repository,
        ["app.services.repo_analysis", "app.routers.analyze_repo", "app.background_jobs"])

    async def fake_parse_resume(file_content, filename):
        return {
            "github_profile_url": "", "awards": [], "skills": ["Python"],
            "college_name": "Test U", "college_gpa": "4.0",
            "college_years": "2020-2024", "certifications": [],
        }

    patch_everywhere("parse_resume", fake_parse_resume,
        ["app.services.resume", "app.routers.profile_setup"])


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
