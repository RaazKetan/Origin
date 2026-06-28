"""GitHub Contributions API helpers (53x7 daily commit grid)."""

from typing import Optional

import httpx

from app.core import constants, secrets


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
