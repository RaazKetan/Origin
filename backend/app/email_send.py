"""Tiny email helper. Sends via Resend (https://resend.com) when
RESEND_API_KEY is configured, otherwise logs the message to stdout so
local dev still works without an email account.

Why Resend: zero-config REST API, generous free tier, no extra Python dep
beyond httpx (already in requirements.txt).
"""

import os
import httpx


def send_email(*, to: str, subject: str, html: str, text: str | None = None) -> dict:
    """Returns {ok: bool, mode: 'sent' | 'logged' | 'error', detail: str}.

    Never raises — callers should treat email as best-effort. We don't want
    a flaky email provider to break the user-facing password-reset endpoint.
    """
    api_key = (os.getenv("RESEND_API_KEY") or "").strip()
    from_addr = (
        os.getenv("RESEND_FROM")
        or "Origin <onboarding@resend.dev>"  # Resend's default sandbox sender
    )

    if not api_key:
        # Dev fallback — log instead of send so the developer can copy the
        # reset link from the uvicorn console.
        print(f"[email-stub] to={to} subject={subject}\n{text or html}")
        return {"ok": True, "mode": "logged", "detail": "RESEND_API_KEY not set; logged to stdout"}

    try:
        with httpx.Client(timeout=10) as client:
            resp = client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": from_addr,
                    "to": [to],
                    "subject": subject,
                    "html": html,
                    **({"text": text} if text else {}),
                },
            )
        if resp.status_code >= 400:
            print(f"[email] Resend error {resp.status_code}: {resp.text[:300]}")
            return {"ok": False, "mode": "error", "detail": f"Resend returned {resp.status_code}"}
        return {"ok": True, "mode": "sent", "detail": resp.json().get("id", "")}
    except Exception as e:
        print(f"[email] Resend exception: {e}")
        return {"ok": False, "mode": "error", "detail": str(e)}
