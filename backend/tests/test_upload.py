"""File-upload hardening tests for /api/profile-setup/upload-resume."""

MIN_PDF = b"%PDF-1.4\n%test\ntrailer\n<<>>\n%%EOF\n"


def _post_file(client, headers, content, filename="resume.pdf", content_type="application/pdf"):
    return client.post(
        "/api/profile-setup/upload-resume",
        headers=headers,
        files={"file": (filename, content, content_type)},
    )


def test_upload_requires_auth(client):
    r = _post_file(client, {}, MIN_PDF)
    assert r.status_code == 401


def test_upload_accepts_valid_pdf(client, headers):
    r = _post_file(client, headers, MIN_PDF)
    # parse_resume is mocked to succeed, so we expect 200
    assert r.status_code == 200, r.text


def test_upload_rejects_docx(client, headers):
    r = _post_file(
        client,
        headers,
        b"PK\x03\x04 some-zip-bytes",
        filename="resume.docx",
        content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    assert r.status_code == 400
    assert "PDF" in r.json()["detail"]


def test_upload_rejects_oversize_file(client, headers):
    too_big = MIN_PDF + (b"\x00" * (2 * 1024 * 1024 + 1))
    r = _post_file(client, headers, too_big)
    assert r.status_code == 413
    assert "too large" in r.json()["detail"].lower()


def test_upload_rejects_empty_file(client, headers):
    r = _post_file(client, headers, b"")
    assert r.status_code == 400


def test_upload_rejects_pdf_extension_but_wrong_content(client, headers):
    # A .pdf file that isn't actually a PDF (no %PDF- magic) must be rejected.
    r = _post_file(client, headers, b"this is just text masquerading as pdf")
    assert r.status_code == 400
    assert "valid PDF" in r.json()["detail"]


def test_upload_rejects_wrong_content_type_header(client, headers):
    r = _post_file(
        client, headers, MIN_PDF, filename="resume.pdf", content_type="image/png"
    )
    assert r.status_code == 400
