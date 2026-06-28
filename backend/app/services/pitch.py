"""Project pitch refinement (Gemini)."""

import json

from app.core import constants
from app.llm import generate
from app.services.json_parse import parse_json
from app.services.prompts import SYSTEM_PROMPT


def refine_pitch(raw_idea: str) -> dict:
    try:
        body = {"task": "refine_pitch", "raw_idea": raw_idea or ""}
        text = generate(constants.GEMINI_MODEL, [SYSTEM_PROMPT, json.dumps(body, ensure_ascii=False)])
        return parse_json(text)
    except Exception as e:
        print(f"Gemini refine_pitch failed: {e}")
        return {
            "refined_pitch": raw_idea or "",
            "key_terms": [],
            "complexity": "intermediate",
            "skills_needed": [],
        }
