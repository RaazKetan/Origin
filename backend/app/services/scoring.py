import math
import re

from app import models


def _detected_tech(user: models.User) -> set:
    """Everything the pipeline/agent actually saw in the user's code."""
    seen = set()
    for r in (user.pending_repo_analysis or []):
        if isinstance(r, dict):
            for s in (r.get("skills_detected") or []) + (r.get("languages") or []) \
                     + (r.get("frameworks") or []):
                seen.add(str(s).lower())
    for lang in (user.top_languages or []):
        seen.add(str(lang).lower())
    return seen


def verified_skills(user: models.User) -> list:
    """Claims ∩ detected. Only these move merit."""
    detected = _detected_tech(user)
    return [s for s in (user.skills or []) if str(s).lower() in detected]


# ---------------- authenticity gate ----------------

def repo_gate(repo: models.Repo) -> float:
    """0-1 multiplier: fork_ok * (1 - tutorial) * authorship * cadence.
    Unmeasured factors are neutral (1.0), never punitive."""
    fork_ok = 0.2 if repo.is_fork else 1.0
    tut = 1 - (repo.tutorial_similarity or 0) / 100
    auth = (repo.authorship_ratio if repo.authorship_ratio is not None else 100) / 100
    cad = (repo.cadence_score if repo.cadence_score is not None else 50) / 100
    # cadence 0.5 is "no evidence either way" — map [0,1] -> [0.5,1] so only
    # a real dump pattern drags the gate, absence of history doesn't.
    cad = 0.5 + cad / 2
    return max(0.0, min(1.0, fork_ok * tut * auth * cad))


def _repo_score(repo: models.Repo) -> float:
    """quality * difficulty, each normalized to 0-1. Unjudged repos score 0
    here (they still exist; they just can't claim points without evidence)."""
    q = (repo.quality_score or 0) / 100
    d = (repo.difficulty_tier or 0) / 8
    return q * d


def _gpa_points(gpa_str: str) -> int:
    """Normalize '3.8/4.0', '8.5/10', '85%' -> 0-10 education points."""
    if not gpa_str:
        return 0
    m = re.match(r"\s*([\d.]+)\s*/\s*([\d.]+)", gpa_str)
    if m:
        num, den = float(m.group(1)), float(m.group(2))
        return round(min(num / den, 1.0) * 10) if den else 0
    m = re.match(r"\s*([\d.]+)\s*%", gpa_str)
    if m:
        return round(min(float(m.group(1)) / 100, 1.0) * 10)
    return 0


def _trajectory_points(grid: list) -> int:
    """0-6 from the contribution grid: recency (last quarter active) +
    consistency (activity not crammed into one burst)."""
    if not grid or sum(grid) == 0:
        return 0
    total = sum(grid)
    recent = sum(grid[-91:])  # last quarter of the 371-day grid
    recency = min(recent / max(total * 0.25, 1), 1.0) * 3
    weeks = [sum(grid[i:i + 7]) for i in range(0, len(grid), 7)]
    active_weeks = sum(1 for w in weeks if w > 0)
    consistency = min(active_weeks / 26, 1.0) * 3  # half the year active = full marks
    return round(recency + consistency)


def compute_merit(user: models.User, repos: list, external_prs: int) -> dict:
    """Master-plan formula. Returns breakdown incl. gate. Categories with no
    data source yet (internship/competitive/presence) contribute 0 and are
    listed as unscored — never fabricated."""
    scored = sorted(repos, key=_repo_score, reverse=True)
    top1, top2 = (scored + [None, None])[:2]

    best = 0.0
    gate = 1.0
    if top1 and _repo_score(top1) > 0:
        best = 0.7 * _repo_score(top1) + 0.3 * (_repo_score(top2) if top2 else 0)
        gate = 0.7 * repo_gate(top1) + 0.3 * (repo_gate(top2) if top2 else repo_gate(top1))

    external_pts = min(external_prs * 4, 15)  # ponytail: count-with-cap until grading ships
    langs = {str(l).lower() for l in (user.top_languages or [])}
    breadth_pts = min(len(langs), 5)

    github_block = (best * 25 + external_pts + breadth_pts) * gate

    breakdown = {
        "github": round(github_block, 1),
        "gate": round(gate, 3),
        "best_repo": round(best * 25, 1),
        "external_prs": external_pts,
        "breadth": breadth_pts,
        "education": _gpa_points(user.college_gpa),
        "trajectory": _trajectory_points(user.contribution_grid or []),
        "unscored": ["internship", "competitive", "presence"],
    }
    raw = github_block + breakdown["education"] + breakdown["trajectory"]
    breakdown["raw_merit"] = round(raw)
    return breakdown


def percentile_of(db, score: int) -> int:
    """Percentile among completed profiles. Small-pool safe."""
    total = db.query(models.User).filter(models.User.profile_completed == True).count()
    if total < 2:
        return 50
    below = (
        db.query(models.User)
        .filter(models.User.profile_completed == True,
                models.User.portfolio_score < score)
        .count()
    )
    return round(100 * below / total)


def _rank_for_percentile(p: int) -> str:
    if p >= 90: return "Expert"
    if p >= 65: return "Advanced"
    if p >= 30: return "Intermediate"
    return "Beginner"


def _rank_for(score: int) -> str:
    if score >= 80: return "Expert"
    if score >= 60: return "Advanced"
    if score >= 35: return "Intermediate"
    return "Beginner"


def recompute_portfolio(user: models.User, db=None) -> None:
    """In-place update of portfolio_score / rank / activity_score, plus a
    ScoreSnapshot when db is passed. Caller commits.

    Two modes:
    - Gate mode: Repo rows exist (pipeline ran) -> master-plan formula
      (best-repo ceiling * authenticity gate, verified skills only).
    - Fallback: no pipeline data yet -> the old capped heuristic, so fresh
      signups still get a sane starter score.
    """
    repos, external_prs = [], 0
    if db is not None and user.id is not None:
        repos = db.query(models.Repo).filter_by(user_id=user.id).all()
        external_prs = (
            db.query(models.ExternalContribution)
            .filter_by(user_id=user.id, merged=True)
            .count()
        )
        user.verified_skills = verified_skills(user)

    commits = int(user.contributions_total or 0)

    if any(_repo_score(r) > 0 for r in repos):
        breakdown = compute_merit(user, repos, external_prs)
        user.portfolio_score = max(0, min(breakdown["raw_merit"], 100))
        percentile = percentile_of(db, user.portfolio_score)
        user.portfolio_rank = _rank_for_percentile(percentile)
        gate_value = round(breakdown["gate"] * 100)
    else:
        vskills = user.verified_skills if db is not None else (user.skills or [])
        skill_pts = min(len(vskills or []) * 2, 20)
        repo_pts = min(len(user.github_selected_repos or []) * 4, 20)
        commit_pts = min(commits // 35, 30)
        agent_skills = set()
        for r in (user.pending_repo_analysis or []):
            if isinstance(r, dict):
                for s in r.get("skills_detected") or []:
                    agent_skills.add(str(s).lower())
        breakdown = {
            "mode": "fallback",
            "base": 10,
            "verified_skills": skill_pts,
            "repos": repo_pts,
            "commits": commit_pts,
            "agent_skills": min(len(agent_skills), 15),
            "resume": 5 if user.resume_url else 0,
        }
        total = sum(v for v in breakdown.values() if isinstance(v, int))
        user.portfolio_score = max(0, min(total, 100))
        user.portfolio_rank = _rank_for(user.portfolio_score)
        percentile = percentile_of(db, user.portfolio_score) if db is not None else None
        gate_value = None  # gate unmeasured without pipeline data

    user.activity_score = 30 + min(commits, 700) * 70 // 700

    if db is not None and user.id is not None:
        db.add(models.ScoreSnapshot(
            user_id=user.id,
            raw_merit=user.portfolio_score,
            gate_value=gate_value,
            component_breakdown=breakdown,
            percentile=percentile,
        ))


def compute_final_match_score(
    semantic_score: float,
    skill_overlap_score: float,
    real_work_score: float,
    readiness_score: float,
) -> float:
    """
    Compute the weighted final match score.
    Scores should be normalized to 0-100 range before calling this.
    """
    # Ensure inputs are valid
    semantic_score = max(0, min(100, semantic_score))
    skill_overlap_score = max(0, min(100, skill_overlap_score))
    real_work_score = max(0, min(100, real_work_score))
    readiness_score = max(0, min(100, readiness_score))

    score = (
        (0.50 * semantic_score)
        + (0.20 * skill_overlap_score)
        + (0.20 * real_work_score)
        + (0.10 * readiness_score)
    )
    return round(score, 2)


def compute_visibility_score(
    final_match_score: float,
    times_shown: int,
    is_fresh_user: bool = False,
    is_underexposed: bool = False,
) -> float:
    """
    Compute the dynamic visibility score for ranking in feeds.

    visibility_score = final_match_score - exposure_penalty + boosts
    exposure_penalty = log(1 + times_shown) * 5  (scaling factor to make it impactful)
    """
    # Exposure penalty: Logarithmic decay
    # times_shown = 0 -> penalty = 0
    # times_shown = 10 -> penalty = log(11) * 5 ~= 2.4 * 5 = 12
    # times_shown = 100 -> penalty = log(101) * 5 ~= 4.6 * 5 = 23
    exposure_penalty = math.log1p(times_shown) * 5.0

    fresh_boost = 5.0 if is_fresh_user else 0.0

    # Underexposed boost: If candidate has high match score but low exposure
    underexposed_boost = 5.0 if is_underexposed else 0.0

    visibility = final_match_score - exposure_penalty + fresh_boost + underexposed_boost
    return round(visibility, 2)
