"""Tolerant JSON extraction from Gemini responses."""

import json


def parse_json(text_or_resp) -> dict:
    """Accept a raw string or a legacy response object (.text/.candidates).
    Strips markdown fences and returns the parsed dict. Raises on failure."""
    text = text_or_resp if isinstance(text_or_resp, str) else None
    if text is None:
        if getattr(text_or_resp, "text", None):
            text = text_or_resp.text
        else:
            try:
                cand = text_or_resp.candidates[0]
                for p in getattr(cand.content, "parts", []) or []:
                    if getattr(p, "text", None):
                        text = p.text
                        break
            except Exception as e:
                print(f"Failed to access response candidates: {e}")

    if text:
        try:
            clean = text.strip()
            if clean.startswith("```json"):
                clean = clean[7:]
            elif clean.startswith("```"):
                clean = clean[3:]
            if clean.endswith("```"):
                clean = clean[:-3]
            return json.loads(clean.strip())
        except Exception as e:
            print(f"Failed to parse text as JSON: {e}")
            print(f"Text content: {text[:200]}...")

    raise ValueError("Gemini returned non-JSON or empty response")
