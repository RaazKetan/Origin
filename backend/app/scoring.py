import math


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
