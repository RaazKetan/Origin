"""Supabase Storage for resume PDFs.

Bucket is auto-created on first upload with the constraints baked in:
- private (signed-URL access only)
- 2 MiB file-size limit
- application/pdf MIME only

Falls back to local disk if SUPABASE_URL / service-role key are missing
(dev without Supabase configured).
"""

import os
from typing import Optional

import httpx


BUCKET = "resumes"
MAX_BYTES = 2 * 1024 * 1024  # 2 MB — also enforced bucket-side


def _creds() -> Optional[tuple[str, str]]:
    url = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SECRET_KEY")
    return (url, key) if url and key else None


def _h(key: str) -> dict:
    return {"Authorization": f"Bearer {key}", "apikey": key}


def _ensure_bucket(url: str, key: str) -> None:
    """Idempotent — POSTing an existing bucket returns 409, which we ignore."""
    body = {
        "id": BUCKET,
        "name": BUCKET,
        "public": False,
        "file_size_limit": MAX_BYTES,
        "allowed_mime_types": ["application/pdf"],
    }
    try:
        with httpx.Client(timeout=10) as c:
            r = c.post(f"{url}/storage/v1/bucket", headers=_h(key), json=body)
        if r.status_code not in (200, 201, 409):
            print(f"[storage] bucket create unexpected {r.status_code}: {r.text[:200]}")
    except Exception as e:
        print(f"[storage] bucket create failed (continuing): {e}")


def put_resume(user_id: int, filename: str, content: bytes) -> str:
    """Upload + return the storage path (e.g. 'users/3/abc.pdf').
    Path — not URL — is what we persist. URLs are minted on demand by signed_url()."""
    creds = _creds()
    if not creds:
        # Local-disk fallback for dev
        upload_dir = os.getenv("UPLOAD_DIR", "/tmp/uploads/resumes")
        os.makedirs(upload_dir, exist_ok=True)
        path = os.path.join(upload_dir, f"{user_id}_{filename}")
        with open(path, "wb") as f:
            f.write(content)
        return path

    url, key = creds
    _ensure_bucket(url, key)

    # Stable per-user path so re-uploads replace the old file (upsert).
    storage_path = f"users/{user_id}/{filename}"
    with httpx.Client(timeout=30) as c:
        r = c.post(
            f"{url}/storage/v1/object/{BUCKET}/{storage_path}",
            headers={**_h(key), "Content-Type": "application/pdf", "x-upsert": "true"},
            content=content,
        )
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Supabase upload failed [{r.status_code}]: {r.text[:300]}")
    return storage_path


def signed_url(storage_path: str, expires_in: int = 3600) -> Optional[str]:
    """Mint a short-lived signed URL for download. None if storage isn't
    configured (the path is a local file in that case)."""
    creds = _creds()
    if not creds or os.path.isabs(storage_path):
        return None
    url, key = creds
    with httpx.Client(timeout=10) as c:
        r = c.post(
            f"{url}/storage/v1/object/sign/{BUCKET}/{storage_path}",
            headers=_h(key),
            json={"expiresIn": expires_in},
        )
    if r.status_code != 200:
        print(f"[storage] sign failed [{r.status_code}]: {r.text[:200]}")
        return None
    rel = r.json().get("signedURL") or r.json().get("signedUrl")
    return f"{url}/storage/v1{rel}" if rel else None
