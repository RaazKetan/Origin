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


def test_snapshot_written_when_db_passed(client, auth_user):
    from app.database import SessionLocal
    from app import models
    db = SessionLocal()
    try:
        u = db.query(models.User).filter_by(id=auth_user["user"]["id"]).first()
        before = db.query(models.ScoreSnapshot).filter_by(user_id=u.id).count()
        _scoring().recompute_portfolio(u, db=db)
        db.commit()
        snaps = db.query(models.ScoreSnapshot).filter_by(user_id=u.id).all()
        assert len(snaps) == before + 1
        assert snaps[-1].raw_merit == u.portfolio_score
        assert isinstance(snaps[-1].component_breakdown, dict)
    finally:
        db.close()


def test_gate_mode_ceiling_and_gate():
    from types import SimpleNamespace as NS
    sc = _scoring()
    mk = lambda **kw: NS(**{**dict(is_fork=False, tutorial_similarity=0,
        authorship_ratio=100, cadence_score=100, quality_score=None,
        difficulty_tier=None), **kw})
    # one excellent repo beats five mediocre: ceiling, not mean
    excellent = mk(quality_score=90, difficulty_tier=7)
    mediocre = [mk(quality_score=40, difficulty_tier=2) for _ in range(5)]
    u = NS(top_languages=["py"], college_gpa=None, contribution_grid=[],
           skills=[], pending_repo_analysis=None)
    one = sc.compute_merit(u, [excellent], external_prs=0)
    five = sc.compute_merit(u, mediocre, external_prs=0)
    assert one["raw_merit"] > five["raw_merit"]

    # forked tutorial collapses the gate no matter how polished
    faked = mk(quality_score=95, difficulty_tier=8, is_fork=True, tutorial_similarity=90)
    gated = sc.compute_merit(u, [faked], external_prs=0)
    assert gated["gate"] < 0.05
    assert gated["github"] < 2


def test_verified_skills_intersection():
    from types import SimpleNamespace as NS
    sc = _scoring()
    u = NS(skills=["Python", "React", "Blockchain"],
           pending_repo_analysis=[{"skills_detected": ["python"], "languages": ["JavaScript"], "frameworks": ["React"]}],
           top_languages=["Python"])
    v = sc.verified_skills(u)
    assert "Python" in v and "React" in v and "Blockchain" not in v
