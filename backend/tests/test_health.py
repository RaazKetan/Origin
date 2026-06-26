def test_health_is_public_and_ok(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_unknown_route_returns_404(client):
    r = client.get("/api/does-not-exist")
    assert r.status_code == 404


def test_root_route_outside_api_prefix_returns_404(client):
    # Routes used to live at /auth/login etc. Make sure the legacy path is gone.
    r = client.post("/auth/login", json={"email": "x@x.com", "password": "x"})
    assert r.status_code == 404
