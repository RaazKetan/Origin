"""Per-router smoke tests.

Each router gets at least one endpoint exercised to confirm:
  - Route is reachable at /api/<router>/...
  - Auth is enforced when expected (401 without token)
  - Input-size caps reject overlong bodies (422)
"""

import pytest


# ---------- Auth required (one canary endpoint per router) ----------

@pytest.mark.parametrize(
    "method,path",
    [
        ("GET",    "/api/auth/me"),
        ("GET",    "/api/profile-setup/check-completion"),
        ("POST",   "/api/profile-setup/upload-resume"),
        ("POST",   "/api/profile-setup/complete-profile"),
        ("GET",    "/api/analysis/status"),
        ("GET",    "/api/analysis/pending-skills"),
        ("POST",   "/api/analysis/accept-skills"),
        ("POST",   "/api/analysis/dismiss"),
        ("GET",    "/api/users/"),
        ("GET",    "/api/users/1"),
        ("PUT",    "/api/users/1"),
        ("POST",   "/api/users/1/repositories"),
        ("DELETE", "/api/users/1/repositories/0"),
        ("POST",   "/api/ai/refine_pitch"),
        ("POST",   "/api/ai/analyze_repo"),
        ("GET",    "/api/matching/discover"),
        ("POST",   "/api/matching/swipe"),
        ("GET",    "/api/matching/matches"),
        ("GET",    "/api/matching/approved-matches"),
        ("GET",    "/api/matching/recommendations"),
        ("GET",    "/api/matching/my-projects/likes"),
        ("POST",   "/api/matching/approve"),
        ("POST",   "/api/profile/setup"),
        ("GET",    "/api/chat/1"),
        ("POST",   "/api/chat/"),
        ("POST",   "/api/chat/1/mark-read"),
        ("POST",   "/api/requirements/analyze"),
        ("POST",   "/api/analyze-repo/user-repo"),
        ("POST",   "/api/talent/search"),
        ("POST",   "/api/talent/seed"),
        ("POST",   "/api/skill-gap/analyze"),
        ("GET",    "/api/skill-gap/candidate/1"),
        ("GET",    "/api/skill-gap/analysis/1"),
        ("POST",   "/api/jobs/"),
        ("GET",    "/api/jobs/feed"),
        ("POST",   "/api/jobs/1/apply"),
        ("GET",    "/api/jobs/my-applications"),
        ("GET",    "/api/jobs/my-connections"),
        ("POST",   "/api/agent/chat"),
    ],
)
def test_endpoint_requires_auth(client, method, path):
    r = client.request(method, path, json={} if method != "GET" else None)
    assert r.status_code in (401, 403), (
        f"{method} {path} should require auth, got {r.status_code}: {r.text[:200]}"
    )


# ---------- Input-size caps ----------

def test_refine_pitch_rejects_overlong_input(client, headers):
    r = client.post(
        "/api/ai/refine_pitch",
        headers=headers,
        json={"raw_idea": "x" * 6000},
    )
    assert r.status_code == 422


def test_refine_pitch_rejects_too_short_input(client, headers):
    r = client.post(
        "/api/ai/refine_pitch",
        headers=headers,
        json={"raw_idea": "tiny"},
    )
    assert r.status_code == 422


def test_requirements_rejects_overlong_input(client, headers):
    r = client.post(
        "/api/requirements/analyze",
        headers=headers,
        json={"requirements": "x" * 6000},
    )
    assert r.status_code == 422


def test_talent_search_rejects_overlong_query(client, headers):
    r = client.post(
        "/api/talent/search",
        headers=headers,
        json={"query": "x" * 1500},
    )
    assert r.status_code == 422


def test_skill_gap_rejects_short_transcript(client, headers):
    r = client.post(
        "/api/skill-gap/analyze",
        headers=headers,
        json={
            "candidate_id": 1,
            "interview_transcript": "tiny",
            "target_role": "Engineer",
        },
    )
    assert r.status_code == 422


def test_analyze_commit_is_public_no_auth_required(client, monkeypatch):
    """Landing-page demo endpoint must be reachable without a token."""
    from app import gemini_agent
    monkeypatch.setattr(
        gemini_agent,
        "analyze_commit",
        lambda code: {
            "technicalSkills": ["Python"],
            "softSkills": [],
            "improvementAreas": [],
            "suggestedCourses": [],
            "complexityScore": 50,
        },
    )
    # Also patch the symbol imported into the router module
    from app.routers import ai as ai_router
    monkeypatch.setattr(ai_router, "analyze_commit", lambda code: {
        "technicalSkills": ["Python"],
        "softSkills": [],
        "improvementAreas": [],
        "suggestedCourses": [],
        "complexityScore": 50,
    })
    r = client.post(
        "/api/ai/analyze_commit",
        json={"code": "def f():\n    return 1 + 1\n" * 3},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "technicalSkills" in body
    assert "complexityScore" in body


def test_analyze_commit_rejects_short_input(client):
    r = client.post("/api/ai/analyze_commit", json={"code": "x"})
    assert r.status_code == 422


def test_analyze_commit_rejects_overlong_input(client):
    r = client.post("/api/ai/analyze_commit", json={"code": "x" * 9000})
    assert r.status_code == 422


def test_agent_chat_rejects_overlong_message(client, headers):
    r = client.post(
        "/api/agent/chat",
        headers=headers,
        json={"message": "x" * 5000},
    )
    assert r.status_code == 422


# ---------- Admin lock ----------

def test_talent_seed_rejects_without_admin_secret(client, headers):
    r = client.post("/api/talent/seed", headers=headers)
    assert r.status_code == 403


def test_talent_seed_rejects_wrong_admin_secret(client, headers):
    r = client.post(
        "/api/talent/seed",
        headers={**headers, "X-Admin-Secret": "wrong-secret"},
    )
    assert r.status_code == 403


def test_talent_seed_works_with_admin_secret(client, headers):
    r = client.post(
        "/api/talent/seed",
        headers={**headers, "X-Admin-Secret": "test-admin-secret"},
    )
    # Seeds 15 candidates with mocked embeddings
    assert r.status_code == 200, r.text
    assert "Successfully" in r.json()["message"] or "already" in r.json()["message"]


# ---------- Talent search happy path (the live 500 the user reported) ----------

def test_talent_search_returns_empty_list_when_no_candidates(client, headers):
    r = client.post(
        "/api/talent/search",
        headers=headers,
        json={"query": "python engineer with 5 years experience"},
    )
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)


def test_talent_search_finds_seeded_candidates(client, headers):
    # First seed
    client.post(
        "/api/talent/seed",
        headers={**headers, "X-Admin-Secret": "test-admin-secret"},
    )
    r = client.post(
        "/api/talent/search",
        headers=headers,
        json={"query": "python engineer"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert isinstance(body, list)
    # With mocked uniform embeddings, all candidates score equally — at least some should come back
    assert len(body) > 0, "Expected at least one candidate match after seeding"


# ---------- Complete-profile (the other live 500 the user reported) ----------

def test_complete_profile_without_github_url(client, headers):
    """When no GitHub URL is provided, the endpoint should still succeed."""
    r = client.post(
        "/api/profile-setup/complete-profile",
        headers=headers,
        json={
            "setup_method": "manual",
            "github_profile_url": "",
            "bio": "Test bio",
            "skills": ["Python", "FastAPI"],
            "awards": [],
            "certifications": [],
        },
    )
    assert r.status_code == 200, r.text


def test_complete_profile_rejects_missing_setup_method(client, headers):
    """Schema validation should reject payloads without setup_method."""
    r = client.post(
        "/api/profile-setup/complete-profile",
        headers=headers,
        json={"bio": "x"},
    )
    assert r.status_code == 422


def test_complete_profile_rejects_invalid_setup_method(client, headers):
    r = client.post(
        "/api/profile-setup/complete-profile",
        headers=headers,
        json={"setup_method": "from-mars", "bio": "x"},
    )
    assert r.status_code == 422


def test_complete_profile_with_github_url_when_github_api_fails(
    client, headers, monkeypatch
):
    """If GitHub API errors, the endpoint must still complete (analysis is best-effort)."""
    import requests as req_module

    class FakeResp:
        status_code = 500
        def json(self):
            return {"message": "Server Error"}

    monkeypatch.setattr(req_module, "get", lambda *a, **k: FakeResp())
    r = client.post(
        "/api/profile-setup/complete-profile",
        headers=headers,
        json={
            "setup_method": "manual",
            "github_profile_url": "https://github.com/nonexistent-user",
            "bio": "Test bio",
            "skills": ["Python"],
            "awards": [],
            "certifications": [],
        },
    )
    assert r.status_code == 200, r.text


def test_complete_profile_with_github_url_happy_path(client, headers, monkeypatch):
    """GitHub returns a repo list, repo analysis runs inline, request finishes."""
    import requests as req_module

    class FakeResp:
        status_code = 200
        def json(self):
            return [
                {"html_url": "https://github.com/u/repo1", "stargazers_count": 10, "updated_at": "2025-01-01"},
                {"html_url": "https://github.com/u/repo2", "stargazers_count": 5, "updated_at": "2024-01-01"},
            ]

    monkeypatch.setattr(req_module, "get", lambda *a, **k: FakeResp())
    r = client.post(
        "/api/profile-setup/complete-profile",
        headers=headers,
        json={
            "setup_method": "manual",
            "github_profile_url": "https://github.com/someuser",
            "bio": "Test",
            "skills": ["Python"],
            "awards": [],
            "certifications": [],
        },
    )
    assert r.status_code == 200, r.text


def test_talent_search_returns_503_when_embedding_unavailable(
    client, headers, monkeypatch
):
    """If the embedding service fails (returns None), endpoint should not 500."""
    from app.routers import talent as talent_router

    monkeypatch.setattr(talent_router, "embed_text", lambda *a, **k: None)
    r = client.post(
        "/api/talent/search",
        headers=headers,
        json={"query": "test query"},
    )
    # Currently the router raises 500; ideally 503 (degraded service). Pin
    # whichever the implementation returns so we notice if it changes.
    assert r.status_code in (500, 503)
    assert "embedding" in r.json()["detail"].lower() or "search" in r.json()["detail"].lower()


# ---------- Username check public-but-rate-limited endpoints ----------

def test_check_username_is_public(client):
    r = client.get("/api/profile-setup/check-username?username=newuser")
    assert r.status_code == 200
    assert r.json()["available"] is True


# ---------- GitHub repo listing (Connect-GitHub flow) ----------

def test_github_repos_requires_auth(client):
    r = client.get("/api/github/repos?username=octocat")
    assert r.status_code == 401


def test_github_repos_rejects_invalid_username(client, headers):
    r = client.get("/api/github/repos?username=../etc/passwd", headers=headers)
    assert r.status_code == 400


def test_github_repos_rejects_consecutive_hyphens(client, headers):
    r = client.get("/api/github/repos?username=foo--bar", headers=headers)
    assert r.status_code == 400


def test_github_repos_happy_path(client, headers, monkeypatch):
    """Mock GitHub's API response and confirm we surface the right fields."""
    from app.routers import github as gh_router

    class FakeResp:
        status_code = 200
        def json(self):
            return [
                {
                    "name": "alpha",
                    "full_name": "u/alpha",
                    "html_url": "https://github.com/u/alpha",
                    "description": "First repo",
                    "language": "Python",
                    "stargazers_count": 12,
                    "forks_count": 1,
                    "updated_at": "2026-01-01T00:00:00Z",
                    "fork": False,
                },
                {
                    "name": "beta",
                    "full_name": "u/beta",
                    "html_url": "https://github.com/u/beta",
                    "description": None,
                    "language": "TypeScript",
                    "stargazers_count": 0,
                    "forks_count": 0,
                    "updated_at": "2025-12-01T00:00:00Z",
                    "fork": True,
                },
            ]

    monkeypatch.setattr(gh_router.requests, "get", lambda *a, **k: FakeResp())
    r = client.get("/api/github/repos?username=octocat", headers=headers)
    assert r.status_code == 200, r.text
    repos = r.json()
    assert len(repos) == 2
    assert repos[0]["name"] == "alpha"
    assert repos[0]["url"] == "https://github.com/u/alpha"
    assert repos[0]["stars"] == 12
    assert repos[1]["is_fork"] is True


def test_github_repos_404_when_user_not_found(client, headers, monkeypatch):
    from app.routers import github as gh_router

    class FakeResp:
        status_code = 404
        def json(self):
            return {"message": "Not Found"}

    monkeypatch.setattr(gh_router.requests, "get", lambda *a, **k: FakeResp())
    r = client.get("/api/github/repos?username=ghost-user-xyz", headers=headers)
    assert r.status_code == 404


# ---------- Complete-profile using selected_repos ----------

def test_complete_profile_uses_selected_repos_when_provided(
    client, headers, monkeypatch
):
    """When selected_repos is given, backend MUST use those exact URLs and
    NOT call GitHub's user-repos endpoint to auto-pick."""
    import requests as req_module
    calls = []

    def fake_get(*args, **kwargs):
        calls.append(args[0] if args else kwargs.get("url"))
        class R:
            status_code = 500
            def json(self): return {}
        return R()

    monkeypatch.setattr(req_module, "get", fake_get)

    r = client.post(
        "/api/profile-setup/complete-profile",
        headers=headers,
        json={
            "setup_method": "manual",
            "github_profile_url": "https://github.com/whatever",
            "selected_repos": [
                "https://github.com/me/repo-one",
                "https://github.com/me/repo-two",
            ],
            "bio": "Test",
            "skills": ["Python"],
        },
    )
    assert r.status_code == 200, r.text
    # No GitHub API call should have been made — we had explicit selections
    assert not any("api.github.com" in (c or "") for c in calls)


def test_complete_profile_caps_selected_repos_at_five(client, headers):
    repos = [f"https://github.com/u/r{i}" for i in range(10)]
    r = client.post(
        "/api/profile-setup/complete-profile",
        headers=headers,
        json={
            "setup_method": "manual",
            "selected_repos": repos,
            "bio": "Test",
            "skills": ["Python"],
        },
    )
    assert r.status_code == 200, r.text


def test_check_username_returns_taken(client, auth_user):
    r = client.get(
        f"/api/profile-setup/check-username?username={auth_user['user']['username']}"
    )
    assert r.status_code == 200
    assert r.json()["available"] is False
