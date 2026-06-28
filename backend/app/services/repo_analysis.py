"""Repository analysis: README/file extraction + Gemini skill detection.

Direct GitHub-API + Gemini calls only (no ADK/MCP — those leak anyio
cancel-scopes that kill the FastAPI request).
"""

import json
from datetime import datetime

import requests

from app.core import constants, secrets
from app.llm import generate
from app.services.json_parse import parse_json
from app.services.prompts import SYSTEM_PROMPT


def analyze_repo(readme_text: str, files: list) -> dict:
    body = {
        "task": "analyze_repo",
        "repo_url": "n/a",
        "readme": (readme_text or "")[:5000],
        "files": files[:5] if files else [],
    }
    text = generate(constants.GEMINI_MODEL, [SYSTEM_PROMPT, json.dumps(body, ensure_ascii=False)])
    return parse_json(text)


async def analyze_user_repository(repo_url: str) -> dict:
    """Single repo -> skills/languages/frameworks via GitHub API + Gemini."""
    parts = repo_url.rstrip("/").split("/")
    if len(parts) < 2:
        return _empty_repo_result(repo_url, "Could not parse repo URL.")
    owner, repo_name = parts[-2], parts[-1]

    headers = {"Accept": "application/vnd.github.v3+json"}
    if secrets.GITHUB_TOKEN:
        headers["Authorization"] = f"token {secrets.GITHUB_TOKEN}"

    languages: list = []
    readme_text = ""
    try:
        lr = requests.get(f"https://api.github.com/repos/{owner}/{repo_name}/languages", headers=headers, timeout=8)
        if lr.status_code == 200:
            languages = list((lr.json() or {}).keys())
        rr = requests.get(
            f"https://api.github.com/repos/{owner}/{repo_name}/readme",
            headers={**headers, "Accept": "application/vnd.github.v3.raw"},
            timeout=8,
        )
        if rr.status_code == 200:
            readme_text = rr.text[:5000]
    except Exception as e:
        print(f"[analyze_user_repository] GitHub fetch failed for {repo_url}: {e}")

    ai_summary, skills, frameworks = "", [], []
    try:
        ai = analyze_repo(readme_text, [])
        if isinstance(ai, dict):
            skills = ai.get("required_skills") or ai.get("skills") or []
            frameworks = ai.get("frameworks_or_libraries") or ai.get("frameworks") or []
            ai_summary = ai.get("project_summary") or ai.get("summary") or ""
    except Exception as e:
        print(f"[analyze_user_repository] Gemini call skipped: {type(e).__name__}: {e}")

    return {
        "url": repo_url,
        "name": repo_name,
        "commits_count": 0,
        "contributions": ai_summary or f"Public repo {owner}/{repo_name}",
        "skills_detected": skills,
        "languages": languages,
        "frameworks": frameworks,
        "last_analyzed": datetime.utcnow().isoformat() + "Z",
        "analysis_summary": ai_summary or f"Repository {owner}/{repo_name} with {len(languages)} languages.",
    }


def analyze_user_repos(username: str, repos_meta: list) -> dict:
    """Aggregate a user's repos into core skills + a profile summary."""
    try:
        blocks = [
            f"Repo: {r.get('name', 'unknown')}\nDescription: {r.get('description', '')}\n"
            f"Languages: {', '.join(r.get('languages', []))}"
            for r in repos_meta
        ]
        prompt = f"""
        Analyze the following GitHub repositories for user '{username}':

        {chr(10).join(blocks)}

        Based on these repositories, identify the user's core skills, primary programming languages, and provide a professional summary for their profile.

        Return a JSON object with the following structure:
        {{
            "core_skills": ["skill1", "skill2", ...],
            "embedding_summary": "A professional summary of the user's coding profile...",
            "estimated_experience_level": "Beginner/Intermediate/Advanced"
        }}
        """
        return parse_json(generate(constants.GEMINI_MODEL, prompt))
    except Exception as e:
        print(f"Error analyzing user repos for {username}: {e}")
        return {
            "core_skills": [],
            "embedding_summary": f"Developer profile for {username}.",
            "estimated_experience_level": "Unknown",
        }


def _empty_repo_result(repo_url: str, summary: str) -> dict:
    return {
        "url": repo_url, "name": repo_url, "commits_count": 0,
        "contributions": "Invalid URL", "skills_detected": [],
        "languages": [], "frameworks": [],
        "last_analyzed": datetime.utcnow().isoformat() + "Z",
        "analysis_summary": summary,
    }
