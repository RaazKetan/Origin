"""Supabase Storage for resume PDFs. Falls back to local disk in dev."""

import os
from typing import Optional

import httpx

from app.core import constants, secrets


def _creds() -> Optional[tuple[str, str]]:
    if secrets.SUPABASE_URL and secrets.SUPABASE_SERVICE_KEY:
        return secrets.SUPABASE_URL, secrets.SUPABASE_SERVICE_KEY
    return None


def _headers(key: str) -> dict:
    return {"Authorization": f"Bearer {key}", "apikey": key}


def _ensure_bucket(url: str, key: str) -> None:
    body = {
        "id": constants.RESUME_BUCKET,
        "name": constants.RESUME_BUCKET,
        "public": False,
        "file_size_limit": constants.MAX_RESUME_BYTES,
        "allowed_mime_types": ["application/pdf"],
    }
    try:
        with httpx.Client(timeout=10) as c:
            r = c.post(f"{url}/storage/v1/bucket", headers=_headers(key), json=body)
        if r.status_code not in (200, 201, 409):
            print(f"[storage] bucket create unexpected {r.status_code}: {r.text[:200]}")
    except Exception as e:
        print(f"[storage] bucket create failed (continuing): {e}")


def put_resume(user_id: int, filename: str, content: bytes) -> str:
    """Upload + return the storage path. Local file path in dev fallback."""
    creds = _creds()
    if not creds:
        os.makedirs(constants.UPLOAD_DIR, exist_ok=True)
        path = os.path.join(constants.UPLOAD_DIR, f"{user_id}_{filename}")
        with open(path, "wb") as f:
            f.write(content)
        return path

    url, key = creds
    _ensure_bucket(url, key)
    storage_path = f"users/{user_id}/{filename}"
    with httpx.Client(timeout=30) as c:
        r = c.post(
            f"{url}/storage/v1/object/{constants.RESUME_BUCKET}/{storage_path}",
            headers={**_headers(key), "Content-Type": "application/pdf", "x-upsert": "true"},
            content=content,
        )
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Supabase upload failed [{r.status_code}]: {r.text[:300]}")
    return storage_path


def signed_url(storage_path: str, expires_in: int = None) -> Optional[str]:
    """Short-lived signed download URL. None if storage isn't configured."""
    creds = _creds()
    if not creds or os.path.isabs(storage_path):
        return None
    url, key = creds
    ttl = expires_in or constants.RESUME_SIGNED_URL_TTL_SECS
    with httpx.Client(timeout=10) as c:
        r = c.post(
            f"{url}/storage/v1/object/sign/{constants.RESUME_BUCKET}/{storage_path}",
            headers=_headers(key),
            json={"expiresIn": ttl},
        )
    if r.status_code != 200:
        print(f"[storage] sign failed [{r.status_code}]: {r.text[:200]}")
        return None
    rel = r.json().get("signedURL") or r.json().get("signedUrl")
    return f"{url}/storage/v1{rel}" if rel else None
