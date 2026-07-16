from datetime import datetime, timedelta


def _pl():
    from app.services import repo_pipeline
    return repo_pipeline


def test_cadence_dump_vs_incremental():
    pl = _pl()
    base = datetime(2026, 1, 1)
    dump = [base + timedelta(hours=i) for i in range(50)]          # one burst
    steady = [base + timedelta(days=7 * i) for i in range(50)]     # a year of weekly work
    assert pl.cadence_score(dump) < 40
    assert pl.cadence_score(steady) > 70
    assert pl.cadence_score([base]) == 50  # too little history to judge


def test_analyze_tree_signals():
    pl = _pl()
    members = [
        ("src/app.py", 100, "def main():\n    pass\n" * 10),
        ("node_modules/x/index.js", 100, "junk\n" * 500),          # vendored: ignored
        ("tests/test_app.py", 50, "def test_x():\n    assert main() is None\n"),
        (".github/workflows/ci.yml", 10, None),
        ("package.json", 10, None),
        ("package-lock.json", 10, None),
        ("README.md", 10, "My real project."),
    ]
    out = pl.analyze_tree(members)
    assert out["has_tests"] and out["tests_assert"] and out["has_ci"] and out["builds"]
    assert 0 < out["authored_loc"] < 100  # vendored junk not counted


def test_tests_without_asserts_flagged():
    pl = _pl()
    out = pl.analyze_tree([("tests/test_x.py", 10, "def test_x():\n    print('ok')\n")])
    assert out["has_tests"] and not out["tests_assert"]


def test_tutorial_similarity_heuristic():
    pl = _pl()
    assert pl.tutorial_similarity("react-todo-tutorial", "", 0) >= 50
    assert pl.tutorial_similarity("raft-db", "distributed KV store", 0) == 0
    assert pl.tutorial_similarity("myapp", "built for this udemy course", 0) >= 30
