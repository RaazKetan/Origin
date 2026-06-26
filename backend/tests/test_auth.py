def test_register_login_and_me(client):
    payload = {
        "username": "alice",
        "name": "Alice",
        "email": "alice@example.com",
        "password": "Secret123!",
    }
    r = client.post("/api/auth/register", json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["email"] == payload["email"]
    assert body["username"] == payload["username"]

    login = client.post(
        "/api/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    assert token

    me = client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert me.status_code == 200
    assert me.json()["email"] == payload["email"]


def test_register_rejects_duplicate_email(client):
    payload = {
        "username": "bob",
        "name": "Bob",
        "email": "bob@example.com",
        "password": "Secret123!",
    }
    r1 = client.post("/api/auth/register", json=payload)
    assert r1.status_code == 200

    payload["username"] = "bob2"
    r2 = client.post("/api/auth/register", json=payload)
    assert r2.status_code == 400


def test_register_rejects_duplicate_username(client):
    p1 = {
        "username": "charlie",
        "name": "Charlie",
        "email": "c1@example.com",
        "password": "Secret123!",
    }
    p2 = {**p1, "email": "c2@example.com"}
    assert client.post("/api/auth/register", json=p1).status_code == 200
    assert client.post("/api/auth/register", json=p2).status_code == 400


def test_login_with_wrong_password(client):
    payload = {
        "username": "dora",
        "name": "Dora",
        "email": "dora@example.com",
        "password": "Secret123!",
    }
    client.post("/api/auth/register", json=payload)
    bad = client.post(
        "/api/auth/login",
        json={"email": payload["email"], "password": "wrong-password"},
    )
    assert bad.status_code == 401


def test_me_requires_auth(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_oauth_login_rejects_unknown_provider(client):
    r = client.get("/api/auth/login/myspace", follow_redirects=False)
    assert r.status_code == 400


def test_oauth_callback_rejects_unknown_provider(client):
    r = client.get("/api/auth/callback/myspace", follow_redirects=False)
    assert r.status_code == 400


# ---------- Complete OAuth signup ----------
#
# The OAuth callback issues a short-lived `setup_token` JWT carrying
# {email, name, provider}. The frontend then POSTs to /complete-oauth-signup
# with the user's chosen username. These tests simulate that exchange so
# regressions like "Invalid token data" (frontend/backend contract drift)
# get caught.

def _mint_setup_token(email: str, name: str = "OAuth User", provider: str = "github"):
    """Build a setup_token the same way auth/callback/{provider} does."""
    from datetime import timedelta
    from app import auth as auth_module
    return auth_module.create_access_token(
        data={"email": email, "name": name, "provider": provider},
        expires_delta=timedelta(minutes=15),
    )


def test_complete_oauth_signup_happy_path(client):
    token = _mint_setup_token("oauth1@example.com", "OAuth One")
    r = client.post(
        "/api/auth/complete-oauth-signup",
        json={
            "setup_token": token,
            "username": "oauthone",
            # frontend sends placeholders here; backend must ignore them in favor of the token
            "email": "placeholder@example.com",
            "name": "Placeholder",
            "password": "",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_complete_oauth_signup_rejects_expired_token(client):
    from datetime import timedelta
    from app import auth as auth_module
    expired = auth_module.create_access_token(
        data={"email": "exp@example.com", "name": "Expired"},
        expires_delta=timedelta(seconds=-10),
    )
    r = client.post(
        "/api/auth/complete-oauth-signup",
        json={
            "setup_token": expired,
            "username": "expired",
            "email": "placeholder@example.com",
            "name": "p",
            "password": "",
        },
    )
    assert r.status_code == 401
    assert "expired" in r.json()["detail"].lower() or "invalid" in r.json()["detail"].lower()


def test_complete_oauth_signup_rejects_garbage_token(client):
    r = client.post(
        "/api/auth/complete-oauth-signup",
        json={
            "setup_token": "not.a.jwt",
            "username": "garbage",
            "email": "placeholder@example.com",
            "name": "p",
            "password": "",
        },
    )
    assert r.status_code == 401


def test_complete_oauth_signup_rejects_duplicate_username(client):
    # First, create a user via normal signup
    client.post(
        "/api/auth/register",
        json={
            "username": "taken_oauth",
            "name": "U",
            "email": "regular@example.com",
            "password": "TestPass123!",
        },
    )
    token = _mint_setup_token("new-oauth@example.com")
    r = client.post(
        "/api/auth/complete-oauth-signup",
        json={
            "setup_token": token,
            "username": "taken_oauth",
            "email": "placeholder@example.com",
            "name": "p",
            "password": "",
        },
    )
    assert r.status_code == 400
    assert "username" in r.json()["detail"].lower()


# ---------- Login by username OR email ----------

def test_login_by_username(client):
    payload = {
        "username": "loginbyuname",
        "name": "U",
        "email": "loginbyuname@example.com",
        "password": "TestPass123!",
    }
    assert client.post("/api/auth/register", json=payload).status_code == 200
    r = client.post(
        "/api/auth/login",
        json={"username": "loginbyuname", "password": "TestPass123!"},
    )
    assert r.status_code == 200, r.text
    assert "access_token" in r.json()


def test_login_by_email_still_works(client):
    payload = {
        "username": "loginbymail",
        "name": "U",
        "email": "loginbymail@example.com",
        "password": "TestPass123!",
    }
    assert client.post("/api/auth/register", json=payload).status_code == 200
    r = client.post(
        "/api/auth/login",
        json={"email": "loginbymail@example.com", "password": "TestPass123!"},
    )
    assert r.status_code == 200, r.text


def test_login_rejects_missing_identifier(client):
    r = client.post("/api/auth/login", json={"password": "x"})
    assert r.status_code == 400


# ---------- Forgot password / reset ----------

def test_forgot_password_returns_generic_for_unknown_user(client, monkeypatch):
    """No account enumeration: response is identical regardless of whether
    the identifier exists."""
    sent = []
    from app import email_send
    monkeypatch.setattr(email_send, "send_email", lambda **kw: (sent.append(kw), {"ok": True, "mode": "logged", "detail": ""})[1])

    r = client.post("/api/auth/forgot-password", json={"email": "no-such-user@example.com"})
    assert r.status_code == 200
    assert r.json()["ok"] is True
    assert sent == []  # no email attempted for unknown user


def test_forgot_password_emails_real_user(client, monkeypatch):
    sent = []
    from app import email_send
    def fake_send(**kw):
        sent.append(kw)
        return {"ok": True, "mode": "logged", "detail": ""}
    monkeypatch.setattr(email_send, "send_email", fake_send)

    client.post(
        "/api/auth/register",
        json={"username": "forgotme", "name": "F", "email": "forgotme@example.com", "password": "TestPass123!"},
    )
    r = client.post("/api/auth/forgot-password", json={"username": "forgotme"})
    assert r.status_code == 200
    assert len(sent) == 1
    assert sent[0]["to"] == "forgotme@example.com"
    assert "reset-password?token=" in sent[0]["text"]


def test_reset_password_happy_path(client, monkeypatch):
    sent = []
    from app import email_send
    monkeypatch.setattr(email_send, "send_email", lambda **kw: (sent.append(kw), {"ok": True})[1])

    client.post(
        "/api/auth/register",
        json={"username": "resetme", "name": "R", "email": "resetme@example.com", "password": "OldPass123!"},
    )
    client.post("/api/auth/forgot-password", json={"username": "resetme"})
    # Extract the token from the email we just intercepted
    import re
    text = sent[-1]["text"]
    m = re.search(r"token=([A-Za-z0-9_.-]+)", text)
    assert m, f"no token in email body: {text!r}"
    token = m.group(1)

    r = client.post(
        "/api/auth/reset-password",
        json={"token": token, "new_password": "NewPass456!"},
    )
    assert r.status_code == 200, r.text
    assert "access_token" in r.json()

    # Old password no longer works, new one does
    bad = client.post("/api/auth/login", json={"username": "resetme", "password": "OldPass123!"})
    assert bad.status_code == 401
    good = client.post("/api/auth/login", json={"username": "resetme", "password": "NewPass456!"})
    assert good.status_code == 200


def test_reset_password_rejects_short_password(client, monkeypatch):
    from app import email_send
    monkeypatch.setattr(email_send, "send_email", lambda **kw: {"ok": True})
    # Mint a valid reset token using the same code path the endpoint uses
    from datetime import timedelta
    from app import auth as auth_module
    token = auth_module.create_access_token(
        data={"sub": "1", "kind": "pwd-reset"},
        expires_delta=timedelta(minutes=10),
    )
    r = client.post("/api/auth/reset-password", json={"token": token, "new_password": "x"})
    assert r.status_code == 400


def test_reset_password_rejects_non_reset_token(client):
    """A regular login token must not be accepted as a reset token."""
    from datetime import timedelta
    from app import auth as auth_module
    bad_token = auth_module.create_access_token(
        data={"sub": "1"},  # missing kind=pwd-reset
        expires_delta=timedelta(minutes=10),
    )
    r = client.post(
        "/api/auth/reset-password",
        json={"token": bad_token, "new_password": "ValidPass123!"},
    )
    assert r.status_code == 401


def test_complete_oauth_signup_rejects_existing_email(client):
    # Pre-register the same email via password signup
    client.post(
        "/api/auth/register",
        json={
            "username": "preregistered",
            "name": "Pre",
            "email": "shared@example.com",
            "password": "TestPass123!",
        },
    )
    token = _mint_setup_token("shared@example.com")
    r = client.post(
        "/api/auth/complete-oauth-signup",
        json={
            "setup_token": token,
            "username": "shared_oauth",
            "email": "placeholder@example.com",
            "name": "p",
            "password": "",
        },
    )
    assert r.status_code == 400
    assert "email" in r.json()["detail"].lower()
