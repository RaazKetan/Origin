"""GitHub API helpers: contribution grid + candidate repo signals."""

from typing import List, Optional

import httpx

from app.core import constants, secrets

_REST = "https://api.github.com"


_QUERY = """
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { contributionCount date } }
      }
    }
  }
}
"""


def fetch_contribution_grid(username: str, user_token: Optional[str] = None) -> Optional[dict]:
    """Return {grid: [int x 371], total: int} or None on failure.

    Prefers the user's own OAuth token (their 5k/hr quota); falls back to
    the server PAT only when no user token is available.
    """
    token = (user_token or "").strip() or secrets.GITHUB_TOKEN
    if not token or not username:
        return None

    try:
        with httpx.Client(timeout=12) as client:
            resp = client.post(
                constants.GITHUB_GRAPHQL_URL,
                headers={
                    "Authorization": f"bearer {token}",
                    "Accept": "application/vnd.github+json",
                },
                json={"query": _QUERY, "variables": {"login": username}},
            )
        if resp.status_code != 200:
            print(f"[github_data] HTTP {resp.status_code}: {resp.text[:200]}")
            return None
        body = resp.json()
        if body.get("errors"):
            print(f"[github_data] GraphQL errors: {body['errors']}")
            return None
        user = (body.get("data") or {}).get("user")
        if not user:
            return None
        cal = user["contributionsCollection"]["contributionCalendar"]
    except Exception as e:
        print(f"[github_data] fetch failed: {type(e).__name__}: {e}")
        return None

    grid: list[int] = [
        int(d.get("contributionCount") or 0)
        for w in cal.get("weeks", [])
        for d in w.get("contributionDays", [])
    ]
    size = constants.CONTRIBUTION_GRID_SIZE
    if len(grid) > size:
        grid = grid[-size:]
    while len(grid) < size:
        grid.insert(0, 0)

    return {
        "grid": grid,
        "total": int(cal.get("totalContributions") or sum(grid)),
    }


def _gh_get(client: httpx.Client, path: str, token: str, **params):
    r = client.get(
        f"{_REST}{path}",
        headers={"Authorization": f"token {token}", "Accept": "application/vnd.github+json"},
        params=params or None,
    )
    return r.status_code, (r.json() if r.status_code == 200 else None)


def fetch_candidate_repos(
    username: str, user_token: Optional[str] = None, max_repos: int = 100
) -> List[dict]:
    """Repos with per-repo signals for LLM project selection: author vs total
    commit counts, contributor count, open-source vs self classification.

    ponytail: one extra contributors call per repo (author_commit_count is the
    whole point). Uses the user's OAuth quota; cap max_repos if it bites.
    """
    token = (user_token or "").strip() or secrets.GITHUB_TOKEN
    if not token or not username:
        return []

    projects: List[dict] = []
    try:
        with httpx.Client(timeout=12) as client:
            status, repos = _gh_get(
                client, f"/users/{username}/repos", token,
                sort="updated", per_page=min(max_repos, 100), type="all",
            )
            if status != 200 or not repos:
                if status != 200:
                    print(f"[github_api] repos HTTP {status}")
                return []

            for repo in repos:
                # Skip trivial forks (kept only if the fork itself got traction).
                if repo.get("fork") and repo.get("forks_count", 0) < 5:
                    continue

                _, contributors = _gh_get(
                    client, f"/repos/{username}/{repo.get('name')}/contributors",
                    token, per_page=100,
                )
                contributors = contributors or []
                total_commits = sum(int(c.get("contributions") or 0) for c in contributors)
                author_commits = next(
                    (int(c.get("contributions") or 0) for c in contributors
                     if (c.get("login") or "").lower() == username.lower()),
                    0,
                )
                n_contrib = len(contributors)
                projects.append({
                    "name": repo.get("name"),
                    "description": repo.get("description"),
                    "github_url": repo.get("html_url"),
                    "live_url": repo.get("homepage") or None,
                    "technologies": [repo.get("language")] if repo.get("language") else [],
                    "project_type": "open_source" if n_contrib > 1 else "self_project",
                    "contributor_count": n_contrib,
                    "author_commit_count": author_commits,
                    "total_commit_count": total_commits,
                    "github_details": {
                        "stars": repo.get("stargazers_count", 0),
                        "forks": repo.get("forks_count", 0),
                        "language": repo.get("language"),
                        "topics": repo.get("topics", []),
                        "open_issues": repo.get("open_issues_count", 0),
                        "size": repo.get("size", 0),
                        "fork": repo.get("fork", False),
                        "archived": repo.get("archived", False),
                        "created_at": repo.get("created_at"),
                        "updated_at": repo.get("updated_at"),
                    },
                })
    except Exception as e:
        print(f"[github_api] fetch_candidate_repos failed: {type(e).__name__}: {e}")
        return projects

    projects.sort(key=lambda p: p["github_details"]["stars"], reverse=True)
    return projects
