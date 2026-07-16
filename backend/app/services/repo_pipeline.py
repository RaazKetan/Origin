"""Scoring funnel Stages 0/1: cheap metadata for everyone, mechanical
full-tree analysis for the best repos. No LLM here except one difficulty
read at the end of Stage 1 (README + file list, never the whole codebase).

Stage 0 (API metadata, sub-cent): fork flags, authorship ratio, repo cadence,
external merged PRs.
Stage 1 (tarball download of top repos): vendored strip, LOC, tests + do
they assert, CI, build heuristic, tutorial heuristic.

ponytail decisions (each has a named upgrade path):
- tarball via codeload, not git clone: no git binary on serverless; authorship
  already comes from the contributors API. Upgrade: full clone + git-log
  authorship when we run on real workers.
- builds = manifest+lockfile heuristic: executing candidate code is RCE on our
  infra. Upgrade: sandboxed build runners.
- tutorial_similarity = name/README heuristics: no fingerprint corpus yet.
  Upgrade: MinHash against a tutorial corpus.
"""

import io
import re
import tarfile
from datetime import datetime, timezone

import httpx

from app.core import constants, secrets
from app.llm import generate
from app.services.json_parse import parse_json

MAX_TARBALL_BYTES = 50 * 1024 * 1024  # skip repos bigger than 50 MB compressed
MAX_EXTERNAL_PRS = 30

_VENDORED = re.compile(
    r"(^|/)(node_modules|vendor|dist|build|out|\.next|__pycache__|\.venv|venv|"
    r"site-packages|coverage|\.git)(/|$)|\.min\.(js|css)$|\.lock$|-lock\.(json|yaml)$"
)
_SOURCE_EXT = (
    ".py", ".js", ".jsx", ".ts", ".tsx", ".go", ".rs", ".java", ".kt", ".rb",
    ".c", ".cc", ".cpp", ".h", ".cs", ".swift", ".php", ".scala", ".sql",
)
_TEST_HINT = re.compile(r"(^|/)(tests?|__tests__|spec)(/|$)|[_.](test|spec)\.[a-z]+$|^test_")
_ASSERT_HINT = re.compile(r"\bassert\b|\bexpect\s*\(|\.should\b|assert_")
_CI_HINT = re.compile(r"^\.github/workflows/.+\.ya?ml$|^\.gitlab-ci\.yml$|^\.circleci/")
_MANIFEST = re.compile(
    r"(^|/)(package\.json|pyproject\.toml|requirements\.txt|go\.mod|Cargo\.toml|"
    r"pom\.xml|build\.gradle|Dockerfile|Makefile)$"
)
_LOCKFILE = re.compile(
    r"(^|/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|"
    r"Cargo\.lock|go\.sum|uv\.lock)$"
)
_TUTORIAL_NAME = re.compile(
    r"tutorial|bootcamp|course|udemy|freecodecamp|100.?days|learn[-_]|"
    r"^hello[-_]?world|starter[-_]?template|clone$",
    re.I,
)
_TUTORIAL_TEXT = re.compile(
    r"this (tutorial|course)|follow along|as taught in|udemy|coursera|"
    r"freecodecamp|codecademy|bootcamp assignment",
    re.I,
)


def _headers(token: str) -> dict:
    return {"Authorization": f"token {token}", "Accept": "application/vnd.github+json"}


# ---------------- Stage 0: metadata only ----------------

def cadence_score(commit_dates: list) -> int:
    """0-100. Incremental history scores high; one giant dump scores low.
    Metric: 1 - (share of commits inside the busiest 28-day window), floored
    so a genuinely young repo isn't zeroed."""
    if len(commit_dates) < 3:
        return 50  # not enough history to judge either way
    days = sorted(d.date() for d in commit_dates)
    span = (days[-1] - days[0]).days or 1
    if span <= 28:
        return 25  # everything inside one month
    window = max(
        sum(1 for d in days if 0 <= (d - start).days <= 28) for start in days
    )
    concentration = window / len(days)
    return max(10, min(100, round((1 - concentration) * 100) + 10))


def fetch_repo_cadence(owner_repo: str, token: str) -> int:
    try:
        with httpx.Client(timeout=12) as c:
            r = c.get(
                f"https://api.github.com/repos/{owner_repo}/commits",
                headers=_headers(token), params={"per_page": 100},
            )
        if r.status_code != 200:
            return 50
        dates = [
            datetime.fromisoformat(
                x["commit"]["author"]["date"].replace("Z", "+00:00")
            )
            for x in r.json()
            if x.get("commit", {}).get("author", {}).get("date")
        ]
        return cadence_score(dates)
    except Exception as e:
        print(f"[pipeline] cadence fetch failed for {owner_repo}: {e}")
        return 50


def fetch_external_merged_prs(username: str, token: str) -> list:
    """Merged PRs authored by the user into repos they don't own."""
    try:
        with httpx.Client(timeout=15) as c:
            r = c.get(
                "https://api.github.com/search/issues",
                headers=_headers(token),
                params={
                    "q": f"is:pr author:{username} is:merged",
                    "per_page": MAX_EXTERNAL_PRS,
                    "sort": "updated",
                },
            )
        if r.status_code != 200:
            print(f"[pipeline] PR search HTTP {r.status_code}")
            return []
        out = []
        for item in r.json().get("items", []):
            # repository_url: .../repos/{owner}/{name}
            parts = (item.get("repository_url") or "").rsplit("/", 2)
            if len(parts) < 3:
                continue
            owner, name = parts[-2], parts[-1]
            if owner.lower() == username.lower():
                continue
            out.append({
                "target_repo": f"{owner}/{name}",
                "pr_url": item.get("html_url") or "",
                "merged": True,
            })
        return out
    except Exception as e:
        print(f"[pipeline] PR search failed: {e}")
        return []


# ---------------- Stage 1: tarball mechanical analysis ----------------

def analyze_tree(members: list) -> dict:
    """Pure function over (path, size, text_sample) tuples — unit-testable."""
    loc = 0
    has_tests = tests_assert = has_ci = False
    manifest = lockfile = False
    tutorial_hits = 0

    for path, size, text in members:
        if _LOCKFILE.search(path):
            lockfile = True  # before the vendored skip — _VENDORED matches *.lock too
        if _VENDORED.search(path):
            continue
        if _CI_HINT.search(path):
            has_ci = True
        if _MANIFEST.search(path):
            manifest = True
        if _LOCKFILE.search(path):
            lockfile = True
        is_test = bool(_TEST_HINT.search(path))
        if is_test:
            has_tests = True
        if path.lower().startswith("readme") and text and _TUTORIAL_TEXT.search(text):
            tutorial_hits += 2
        if path.endswith(_SOURCE_EXT) and text:
            loc += text.count("\n") + 1
            if is_test and _ASSERT_HINT.search(text):
                tests_assert = True

    return {
        "authored_loc": loc,
        "has_tests": has_tests,
        "tests_assert": tests_assert,
        "has_ci": has_ci,
        "builds": manifest and lockfile,  # ponytail: heuristic, sandboxed runners later
        "tutorial_text_hits": tutorial_hits,
    }


def tutorial_similarity(repo_name: str, description: str, text_hits: int) -> int:
    """0-100 heuristic. ponytail: MinHash corpus fingerprinting later."""
    score = 0
    if _TUTORIAL_NAME.search(repo_name or ""):
        score += 50
    if _TUTORIAL_TEXT.search(description or ""):
        score += 30
    score += min(text_hits * 10, 30)
    return min(score, 100)


def download_and_analyze(owner_repo: str, token: str) -> dict | None:
    """Fetch the default-branch tarball and run the mechanical analysis."""
    try:
        with httpx.Client(timeout=60, follow_redirects=True) as c:
            r = c.get(
                f"https://api.github.com/repos/{owner_repo}/tarball",
                headers=_headers(token),
            )
        if r.status_code != 200 or len(r.content) > MAX_TARBALL_BYTES:
            print(f"[pipeline] tarball skip {owner_repo}: HTTP {r.status_code}, {len(r.content)}B")
            return None
        members = []
        with tarfile.open(fileobj=io.BytesIO(r.content), mode="r:gz") as tf:
            for m in tf.getmembers():
                if not m.isfile() or m.size > 512 * 1024:
                    continue
                # strip the leading "{owner}-{repo}-{sha}/" dir
                path = m.name.split("/", 1)[-1] if "/" in m.name else m.name
                text = None
                if path.endswith(_SOURCE_EXT) or path.lower().startswith("readme"):
                    try:
                        text = tf.extractfile(m).read().decode("utf-8", errors="ignore")
                    except Exception:
                        pass
                members.append((path, m.size, text))
        return analyze_tree(members)
    except Exception as e:
        print(f"[pipeline] tarball analysis failed for {owner_repo}: {e}")
        return None


def llm_difficulty(repo_name: str, description: str, tree: dict, file_list: list) -> dict:
    """One small LLM read: difficulty tier 1-8 + quality 0-100 from repo shape.
    Never the whole codebase."""
    prompt = (
        "Rate this repository for a fresher-SWE evaluation. Anchors: static "
        "hello-world/tutorial=1-2, standard CRUD app=3, app with real auth/"
        "infra/tests=4-5, distributed system/compiler/ML-from-scratch=7-8.\n"
        f"Repo: {repo_name}\nDescription: {description or 'n/a'}\n"
        f"Mechanical signals: {tree}\n"
        f"Files (sample): {file_list[:80]}\n"
        'Reply ONLY JSON: {"difficulty_tier": 1-8, "quality_score": 0-100}'
    )
    try:
        out = parse_json(generate(constants.GEMINI_MODEL, prompt))
        return {
            "difficulty_tier": max(1, min(8, int(out.get("difficulty_tier") or 1))),
            "quality_score": max(0, min(100, int(out.get("quality_score") or 0))),
        }
    except Exception as e:
        print(f"[pipeline] llm_difficulty skipped: {e}")
        return {"difficulty_tier": None, "quality_score": None}


# ---------------- Orchestration ----------------

def run_pipeline(db, user, max_stage1: int = 2) -> dict:
    """Stage 0 for all the user's repos, Stage 1 for the top few.
    Writes/updates Repo + ExternalContribution rows. Caller commits."""
    from app import models
    from app.services.github_api import fetch_candidate_repos

    username = (user.github_profile_url or "").rstrip("/").split("/")[-1]
    if not username:
        return {"error": "no github profile"}
    token = (user.github_access_token or "").strip() or secrets.GITHUB_TOKEN

    # Stage 0
    candidates = fetch_candidate_repos(username, user_token=user.github_access_token)
    prs = fetch_external_merged_prs(username, token)
    for pr in prs:
        exists = (
            db.query(models.ExternalContribution)
            .filter_by(user_id=user.id, pr_url=pr["pr_url"])
            .first()
        )
        if not exists:
            db.add(models.ExternalContribution(user_id=user.id, **pr))

    # Rank for Stage 1: non-fork, most owned work first
    ranked = sorted(
        (c for c in candidates if not c["github_details"]["fork"]),
        key=lambda c: (c["author_commit_count"], c["github_details"]["stars"]),
        reverse=True,
    )

    analyzed = []
    for i, cand in enumerate(ranked):
        owner_repo = f"{username}/{cand['name']}"
        row = (
            db.query(models.Repo)
            .filter_by(user_id=user.id, repo_name=owner_repo)
            .first()
        ) or models.Repo(user_id=user.id, repo_name=owner_repo)
        row.is_fork = cand["github_details"]["fork"]
        total = cand["total_commit_count"] or 0
        row.authorship_ratio = round(100 * cand["author_commit_count"] / total) if total else 0
        row.analyzed_at = datetime.now(timezone.utc)

        if i < max_stage1:  # Stage 1 only for the best repos
            row.cadence_score = fetch_repo_cadence(owner_repo, token)
            tree = download_and_analyze(owner_repo, token)
            if tree:
                row.authored_loc = tree["authored_loc"]
                row.has_tests = tree["has_tests"]
                row.tests_assert = tree["tests_assert"]
                row.has_ci = tree["has_ci"]
                row.builds = tree["builds"]
                row.tutorial_similarity = tutorial_similarity(
                    cand["name"], cand.get("description"), tree["tutorial_text_hits"]
                )
                judged = llm_difficulty(
                    owner_repo, cand.get("description"), tree,
                    [t for t in (cand.get("technologies") or [])],
                )
                row.difficulty_tier = judged["difficulty_tier"]
                row.quality_score = judged["quality_score"]
        db.add(row)
        analyzed.append(owner_repo)

    return {
        "repos_seen": len(candidates),
        "repos_written": len(analyzed),
        "stage1_analyzed": min(max_stage1, len(ranked)),
        "external_prs": len(prs),
    }
