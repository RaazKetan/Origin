import math

from . import models


def _rank_for(score: int) -> str:
    if score >= 80: return "Expert"
    if score >= 60: return "Advanced"
    if score >= 35: return "Intermediate"
    return "Beginner"


def recompute_portfolio(user: models.User) -> None:
    """In-place update of user.portfolio_score / rank / activity_score from
    REAL signals we already store on the row. Called from every state
    change that could move the score (profile-setup completion, contribution
    refresh, agent analysis finish) so the score never sticks at the
    placeholder when Gemini bombs silently.

    Signals (each capped so no single one dominates):
      - manually entered skills      up to +20  (2 pts each)
      - connected GitHub repos       up to +20  (4 pts each, cap 5)
      - real 12mo commits (GitHub)   up to +30  (1 pt per 35 commits)
      - agent-detected skills        up to +15
      - resume uploaded              +5
    Base 10, cap 100.

    Caller is responsible for db.commit().
    """
    manual_skill_pts = min(len(user.skills or []) * 2, 20)
    repo_pts = min(len(user.github_selected_repos or []) * 4, 20)
    commits = int(user.contributions_total or 0)
    commit_pts = min(commits // 35, 30)

    agent_skills = set()
    for r in (user.pending_repo_analysis or []):
        if isinstance(r, dict):
            for s in r.get("skills_detected") or []:
                agent_skills.add(str(s).lower())
    agent_skill_pts = min(len(agent_skills), 15)

    resume_pts = 5 if user.resume_url else 0

    total = 10 + manual_skill_pts + repo_pts + commit_pts + agent_skill_pts + resume_pts
    user.portfolio_score = max(0, min(total, 100))
    user.portfolio_rank = _rank_for(user.portfolio_score)
    user.activity_score = 30 + min(commits, 700) * 70 // 700


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
