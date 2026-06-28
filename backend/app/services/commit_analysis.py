"""Single-commit skill analysis for the public landing-page demo."""

from app.core import constants
from app.llm import generate
from app.services.json_parse import parse_json


_PROMPT = (
    "You are Origin, an AI agent for tech recruitment. Analyze the following code "
    "commit/diff. Extract the technical skills demonstrated, soft skills (clarity, "
    "attention to detail), improvement areas, and suggest courses. Return ONLY a "
    "JSON object with keys: technicalSkills (string[]), softSkills (string[]), "
    "improvementAreas (string[]), suggestedCourses (array of {title, platform, reason}), "
    "complexityScore (0-100 integer).\n\nCode:\n"
)

_FALLBACK = {
    "technicalSkills": ["Algorithms", "Refactoring"],
    "softSkills": ["Communication"],
    "improvementAreas": ["Edge-case coverage"],
    "suggestedCourses": [
        {"title": "Patterns of Software", "platform": "MIT OCW", "reason": "Strengthens architectural reasoning"}
    ],
    "complexityScore": 60,
}


def analyze_commit(code_snippet: str) -> dict:
    try:
        text = generate(constants.GEMINI_MODEL, _PROMPT + (code_snippet or "")[:8000])
        return parse_json(text)
    except Exception as e:
        print(f"Gemini analyze_commit failed: {e}")
        return _FALLBACK
