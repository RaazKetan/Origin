from types import SimpleNamespace

# NOTE: import app.services.scoring lazily inside each test. A module-level
# import would pull in app.database at collection time, before conftest's
# _isolated_db session fixture swaps in a temp SQLite path.


def _scoring():
    from app.services import scoring
    return scoring


def _user(**kw):
    base = dict(
        skills=[], github_selected_repos=[], contributions_total=0,
        pending_repo_analysis=None, resume_url=None,
        portfolio_score=None, portfolio_rank=None, activity_score=None,
    )
    base.update(kw)
    return SimpleNamespace(**base)


def test_empty_profile_is_base_score():
    u = _user()
    _scoring().recompute_portfolio(u)
    assert u.portfolio_score == 10
    assert u.portfolio_rank == "Beginner"


def test_connected_repos_move_score_off_placeholder():
    # 5 repos x 4 = +20, base 10 -> 30 (the old code stuck this at 50)
    u = _user(github_selected_repos=[{"url": f"r{i}"} for i in range(5)])
    _scoring().recompute_portfolio(u)
    assert u.portfolio_score == 30


def test_real_commits_count():
    # 350 commits -> 350 // 35 = 10, base 10 -> 20
    u = _user(contributions_total=350)
    _scoring().recompute_portfolio(u)
    assert u.portfolio_score == 20


def test_heavy_profile_is_expert():
    # 10 skills(+20), 5 repos(+20), 1000 commits(+28), resume(+5), base 10 = 83
    u = _user(
        skills=[f"s{i}" for i in range(10)],
        github_selected_repos=[{"url": f"r{i}"} for i in range(5)],
        contributions_total=1000,
        resume_url="x",
    )
    _scoring().recompute_portfolio(u)
    assert u.portfolio_score == 83
    assert u.portfolio_rank == "Expert"
    assert u.activity_score == 100


def test_caps_prevent_single_signal_domination():
    # 100 skills should cap at +20, not 200
    u = _user(skills=[f"s{i}" for i in range(100)])
    _scoring().recompute_portfolio(u)
    assert u.portfolio_score == 30  # base 10 + capped 20


def test_score_never_exceeds_100():
    u = _user(
        skills=[f"s{i}" for i in range(50)],
        github_selected_repos=[{"url": f"r{i}"} for i in range(50)],
        contributions_total=99999,
        resume_url="x",
        pending_repo_analysis=[{"skills_detected": [f"a{i}" for i in range(50)]}],
    )
    _scoring().recompute_portfolio(u)
    assert u.portfolio_score == 100
