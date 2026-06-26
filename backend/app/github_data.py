"""GitHub data helpers.

Currently exposes `fetch_contribution_grid(username)` which returns a
53-week × 7-day flat list of daily commit counts (oldest-first), suitable for
direct rendering as a heatmap. Uses GitHub's GraphQL Contributions API which
requires a personal access token (read:user is enough).

If GITHUB_TOKEN is missing or the call fails, returns None — callers should
treat the grid as optional, not fatal.
"""

import os
from typing import Optional

import httpx


GRAPHQL_URL = "https://api.github.com/graphql"
GRID_SIZE = 53 * 7  # 371 cells, what the design renders


def _server_token() -> Optional[str]:
    """Fallback bot token. Shared across all users — only used when we don't
    have a per-user OAuth token (email/Google signups, or older accounts)."""
    t = (os.getenv("GITHUB_TOKEN") or "").strip()
    return t or None


def fetch_contribution_grid(username: str, user_token: Optional[str] = None) -> Optional[dict]:
    """Return {grid: [int x 371], total: int} or None on failure.

    Prefers the user's own OAuth token (their 5k/hr quota). Falls back to
    the server token only when no user token is available — keeps a single
    PAT from being the bottleneck at scale.
    """
    token = (user_token or "").strip() or _server_token()
    if not token or not username:
        return None

    query = """
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
    try:
        with httpx.Client(timeout=12) as client:
            resp = client.post(
                GRAPHQL_URL,
                headers={
                    "Authorization": f"bearer {token}",
                    "Accept": "application/vnd.github+json",
                },
                json={"query": query, "variables": {"login": username}},
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
            return None  # user doesn't exist or token can't see them
        cal = user["contributionsCollection"]["contributionCalendar"]
        weeks = cal.get("weeks", [])
    except Exception as e:
        print(f"[github_data] fetch failed: {type(e).__name__}: {e}")
        return None

    # Flatten oldest-first, padded/truncated to 371 cells.
    grid: list[int] = []
    for w in weeks:
        for d in w.get("contributionDays", []):
            grid.append(int(d.get("contributionCount") or 0))
    # GitHub usually returns ~371 cells (~53 weeks); guard the size either way.
    if len(grid) > GRID_SIZE:
        grid = grid[-GRID_SIZE:]
    while len(grid) < GRID_SIZE:
        grid.insert(0, 0)

    return {
        "grid": grid,
        "total": int(cal.get("totalContributions") or sum(grid)),
    }
