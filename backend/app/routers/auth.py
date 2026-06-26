from datetime import timedelta
import os
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from .. import schemas, auth, models
from ..database import get_db
import secrets
from ..limiter import limiter

router = APIRouter(prefix="/auth", tags=["Authentication"])

BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:8000")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")


@router.post("/register", response_model=schemas.UserResponse)
@limiter.limit("10/minute")
def register(request: Request, user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check if username already exists
    existing_username = (
        db.query(models.User).filter(models.User.username == user.username).first()
    )
    if existing_username:
        raise HTTPException(
            status_code=400,
            detail="Username already taken. Please choose a different username.",
        )

    # Check if email already exists
    db_user = auth.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create new user with profile_completed = False
    hashed_password = auth.get_password_hash(user.password)
    db_user = models.User(
        username=user.username,
        name=user.name,
        email=user.email,
        password_hash=hashed_password,
        profile_completed=False,
        skills=[],  # Empty initially, filled during profile setup
        bio="",  # Empty initially, filled during profile setup
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.post("/login", response_model=schemas.Token)
@limiter.limit("10/minute")
def login(
    request: Request, user_credentials: schemas.UserLogin, db: Session = Depends(get_db)
):
    identifier = user_credentials.identifier
    if not identifier or not user_credentials.password:
        raise HTTPException(status_code=400, detail="Username/email and password are required")
    user = auth.authenticate_user(db, identifier, user_credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


# ---------- Password reset ----------

_RESET_TOKEN_TTL_MIN = 60


@router.post("/forgot-password")
@limiter.limit("3/minute")
def forgot_password(
    request: Request,
    body: schemas.ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """Issue a one-hour password-reset token and email it to the user.
    Always returns the same generic message so attackers can't enumerate
    accounts. The actual email send is best-effort (logged to stdout if
    RESEND_API_KEY isn't configured)."""
    from .. import email_send

    identifier = body.identifier
    generic = {"ok": True, "message": "If an account exists for that identifier, a reset link is on its way."}

    if not identifier:
        return generic

    user = auth.get_user_by_identifier(db, identifier)
    if not user:
        return generic  # don't leak account existence

    reset_token = auth.create_access_token(
        data={"sub": str(user.id), "kind": "pwd-reset"},
        expires_delta=timedelta(minutes=_RESET_TOKEN_TTL_MIN),
    )
    reset_url = f"{FRONTEND_BASE_URL.rstrip('/')}/reset-password?token={reset_token}"

    email_send.send_email(
        to=user.email,
        subject="Reset your origin password",
        html=(
            f"<p>Hi {user.name or user.username},</p>"
            f"<p>Click the link below to set a new password. This link expires in {_RESET_TOKEN_TTL_MIN} minutes.</p>"
            f'<p><a href="{reset_url}">{reset_url}</a></p>'
            f"<p>If you didn't request this, ignore this email.</p>"
        ),
        text=f"Reset your password: {reset_url}\nLink expires in {_RESET_TOKEN_TTL_MIN} minutes.",
    )
    return generic


@router.post("/reset-password", response_model=schemas.Token)
@limiter.limit("5/minute")
def reset_password(
    request: Request,
    body: schemas.ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    from jose import jwt, JWTError

    if not body.new_password or len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    try:
        payload = jwt.decode(body.token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired reset token: {e}")

    if payload.get("kind") != "pwd-reset":
        raise HTTPException(status_code=401, detail="Token is not a password-reset token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Reset token missing subject")

    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User no longer exists")

    user.password_hash = auth.get_password_hash(body.new_password)
    db.add(user)
    db.commit()
    db.refresh(user)

    # Log them straight in after a successful reset.
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=schemas.UserResponse)
@limiter.limit("30/minute")
def read_users_me(request: Request, current_user: models.User = Depends(auth.get_current_user)):
    return current_user


_PROVIDER_CRED_ENVS = {
    "google": ("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"),
    "github": ("GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"),
}


def _oauth_configured(provider: str) -> bool:
    envs = _PROVIDER_CRED_ENVS.get(provider)
    if not envs:
        return False
    cid, csec = envs
    return bool(os.getenv(cid)) and bool(os.getenv(csec))


@router.get("/login/{provider}")
@limiter.limit("10/minute")
async def login_via_oauth(request: Request, provider: str):
    if provider not in _PROVIDER_CRED_ENVS:
        raise HTTPException(status_code=400, detail="Unsupported provider")

    if not _oauth_configured(provider):
        # Fail fast so users don't end up on Google's "Missing client_id" page.
        # Server-side misconfig — make it visible.
        raise HTTPException(
            status_code=503,
            detail=(
                f"{provider.title()} sign-in is not configured on this server. "
                f"Admin must set {_PROVIDER_CRED_ENVS[provider][0]} and "
                f"{_PROVIDER_CRED_ENVS[provider][1]}."
            ),
        )

    redirect_uri = f"{BACKEND_BASE_URL}/auth/callback/{provider}"
    return await auth.oauth.create_client(provider).authorize_redirect(
        request, redirect_uri
    )


@router.get("/callback/{provider}")
@limiter.limit("10/minute")
async def auth_callback(request: Request, provider: str, db: Session = Depends(get_db)):
    if provider not in ["google", "github"]:
        raise HTTPException(status_code=400, detail="Unsupported provider")

    try:
        token = await auth.oauth.create_client(provider).authorize_access_token(request)
        if provider == "google":
            userinfo = token.get("userinfo")
            email = userinfo.get("email")
            name = userinfo.get("name")
        else:  # GitHub
            client = auth.oauth.create_client(provider)
            resp = await client.get("user", token=token)
            userinfo = resp.json()
            email = userinfo.get("email")
            # GitHub email might be null in public profile, try to fetch emails
            if not email:
                resp_emails = await client.get("user/emails", token=token)
                emails = resp_emails.json()
                primary_email = next((e for e in emails if e.get("primary")), None)
                if primary_email:
                    email = primary_email.get("email")
            name = userinfo.get("name") or userinfo.get("login")

        if not email:
            raise HTTPException(
                status_code=400, detail="Cannot fetch email from provider"
            )

        # GitHub: extract the access token to use for this user's API calls
        # later (their quota, not ours). `token` is a dict-like from Authlib.
        github_oauth_token = None
        if provider == "github":
            github_oauth_token = token.get("access_token") if hasattr(token, "get") else None

        # Check if user exists
        db_user = auth.get_user_by_email(db, email=email)

        if db_user:
            # Refresh the stored GitHub token on every login so we always
            # have the latest one (in case scopes were re-consented).
            if github_oauth_token:
                db_user.github_access_token = github_oauth_token
                db.add(db_user)
                db.commit()

            # User exists, log them in
            access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
            access_token = auth.create_access_token(
                data={"sub": str(db_user.id)}, expires_delta=access_token_expires
            )
            # Redirect to frontend with token
            return RedirectResponse(
                f"{FRONTEND_BASE_URL}/oauth-callback?token={access_token}"
            )
        else:
            # New user, generate a setup token. Carry the GitHub OAuth token
            # in the JWT so complete-oauth-signup can persist it on the new
            # user record (we don't have a user row yet, so nowhere else to
            # stash it for the few-minute gap).
            setup_payload = {"email": email, "name": name, "provider": provider}
            if github_oauth_token:
                setup_payload["gh_token"] = github_oauth_token
            setup_token = auth.create_access_token(
                data=setup_payload, expires_delta=timedelta(minutes=15)
            )
            return RedirectResponse(
                f"{FRONTEND_BASE_URL}/oauth-callback?setup_token={setup_token}"
            )

    except Exception as e:
        print(f"OAuth error: {e}")
        return RedirectResponse(f"{FRONTEND_BASE_URL}?error=oauth_failed")


class CompleteOAuthSignupRequest(schemas.UserCreate):
    setup_token: str


@router.post("/complete-oauth-signup", response_model=schemas.Token)
@limiter.limit("5/minute")
def complete_oauth_signup(
    request: Request,
    body_data: CompleteOAuthSignupRequest,
    db: Session = Depends(get_db),
):
    from jose import jwt, JWTError

    try:
        payload = jwt.decode(
            body_data.setup_token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM]
        )
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired setup token: {e}")

    # Trust the JWT for the email/name — it was issued by us after the OAuth
    # provider verified them. Frontend doesn't need to echo them back.
    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Setup token missing email claim")

    # Defensive: reject if the email in the token was already registered while
    # the user was choosing a username (race window).
    if auth.get_user_by_email(db, email=email):
        raise HTTPException(status_code=400, detail="Email already registered")

    # Username availability
    if (
        db.query(models.User)
        .filter(models.User.username == body_data.username)
        .first()
    ):
        raise HTTPException(status_code=400, detail="Username already taken")

    # OAuth users don't pick a password; generate a random one so the column
    # is non-null. They sign in via the provider afterwards.
    hashed_password = (
        auth.get_password_hash(body_data.password)
        if body_data.password
        else auth.get_password_hash(secrets.token_urlsafe(32))
    )

    db_user = models.User(
        username=body_data.username,
        name=body_data.name or payload.get("name", "Unknown"),
        email=email,
        password_hash=hashed_password,
        profile_completed=False,
        skills=[],
        bio="",
        # Carry the GitHub OAuth token through from the setup_token JWT (if
        # this signup came from GitHub OAuth). Lets us hit GitHub on the
        # user's own rate-limit later.
        github_access_token=payload.get("gh_token"),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": str(db_user.id)}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}
