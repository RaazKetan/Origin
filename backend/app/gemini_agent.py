import os
import json
import uuid
import asyncio
from types import SimpleNamespace
from datetime import datetime
from functools import partial

import google.generativeai as genai
from dotenv import load_dotenv

# Import ADK components for the legacy/existing repo analysis functions
from google.adk import Runner
from google.adk.sessions import InMemorySessionService
from .agents.github import create_github_agent

load_dotenv()
genai.configure(api_key=(os.getenv("GEMINI_API_KEY") or "").strip())

SYSTEM_PROMPT = """
Follow the structured schemas based on the input `task`.
Output JSON only, no explanations.

For task "refine_pitch":
- Analyze the raw project idea
- Refine it into a clear, professional pitch
- Identify key technical terms, complexity, and skills needed
- Return: {"refined_pitch": str, "key_terms": [str], "complexity": str, "skills_needed": [str]}

For task "analyze_repo":
- Analyze the README content and file list
- Extract project details
- Return: {"project_title": str, "project_summary": str, "primary_languages": [str], "frameworks_or_libraries": [str], "project_type": str, "detected_domains": [str], "required_skills": [str], "complexity_level": str, "estimated_collaboration_roles": [str]}

For task "semantic_search":
- Perform intelligent search on projects using natural language queries
- Understand context, intent, and provide relevant suggestions
- Return: {"results": list, "suggestions": list, "filters_applied": dict}
- results should be ranked by relevance to the query
- suggestions should help users refine their search
- filters_applied should show what filters were used
"""


def _parse_json_from_response(resp):
    text = None
    if getattr(resp, "text", None):
        text = resp.text
    else:
        try:
            cand = resp.candidates[0]
            parts = getattr(cand.content, "parts", []) or []
            for p in parts:
                t = getattr(p, "text", None)
                if t:
                    text = t
                    break
        except Exception as e:
            print(f"Failed to access response candidates: {e}")

    if text:
        try:
            clean_text = text.strip()
            if clean_text.startswith("```json"):
                clean_text = clean_text[7:]
            elif clean_text.startswith("```"):
                clean_text = clean_text[3:]
            if clean_text.endswith("```"):
                clean_text = clean_text[:-3]
            return json.loads(clean_text.strip())
        except Exception as e:
            print(f"Failed to parse text as JSON: {e}")
            print(f"Text content: {text[:200]}...")

    raise ValueError("Gemini returned non-JSON or empty response")


def refine_pitch(raw_idea: str):
    try:
        body = {"task": "refine_pitch", "raw_idea": raw_idea or ""}
        resp = genai.GenerativeModel(
            os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        ).generate_content([SYSTEM_PROMPT, json.dumps(body, ensure_ascii=False)])
        return _parse_json_from_response(resp)
    except Exception as e:
        print(f"Gemini refine_pitch failed: {e}")
        return {
            "refined_pitch": raw_idea or "",
            "key_terms": [],
            "complexity": "intermediate",
            "skills_needed": [],
        }


def analyze_repo(readme_text: str, files: list):
    body = {
        "task": "analyze_repo",
        "repo_url": "n/a",
        "readme": (readme_text or "")[:5000],
        "files": files[:5] if files else [],
    }
    resp = genai.GenerativeModel(
        os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    ).generate_content([SYSTEM_PROMPT, json.dumps(body, ensure_ascii=False)])
    return _parse_json_from_response(resp)


async def analyze_repo_url(repo_url: str, readme_text: str = None, files: list = None):
    # Ensure GOOGLE_API_KEY is set for ADK
    if "GOOGLE_API_KEY" not in os.environ:
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            os.environ["GOOGLE_API_KEY"] = api_key

    try:
        print(f"Analyzing repo: {repo_url}")

        # Try to use GitHub Agent first
        try:
            agent = create_github_agent()
            print("GitHub Agent initialized")

            session_service = InMemorySessionService()
            user_id = "user_" + str(uuid.uuid4())[:8]
            session_id = "session_" + str(uuid.uuid4())[:8]

            await session_service.create_session(
                app_name="agents", user_id=user_id, session_id=session_id
            )

            runner = Runner(
                app_name="agents", agent=agent, session_service=session_service
            )

            try:
                prompt = f"""
                Analyze the repository at {repo_url}.
                Use your tools to explore the codebase, read the README, and understand the project.
                
                Return a valid JSON object with the following structure:
                {{
                    "project_title": "Title",
                    "project_summary": "Detailed summary",
                    "repo_url": "{repo_url}",
                    "primary_languages": ["List", "of", "languages"],
                    "frameworks_or_libraries": ["List", "of", "frameworks"],
                    "project_type": "type e.g. Web App",
                    "detected_domains": ["domain1"],
                    "required_skills": ["skill1"],
                    "complexity_level": "beginner/intermediate/advanced",
                    "estimated_collaboration_roles": ["role1"]
                }}
                Output JSON only.
                """

                part = SimpleNamespace(text=prompt)
                msg = SimpleNamespace(role="user", parts=[part])

                print("Running GitHub Agent via Runner (Async)...")
                full_response_text = ""

                async for event in runner.run_async(
                    user_id=user_id, session_id=session_id, new_message=msg
                ):
                    if hasattr(event, "text") and event.text:
                        full_response_text += event.text
                    elif hasattr(event, "content"):
                        c = event.content
                        if hasattr(c, "parts"):
                            for p in c.parts:
                                if hasattr(p, "text") and p.text:
                                    full_response_text += p.text

                print(f"Agent raw response length: {len(full_response_text)}")
                if full_response_text:
                    dummy_resp = SimpleNamespace(text=full_response_text)
                    return _parse_json_from_response(dummy_resp)
            finally:
                if hasattr(runner, "close"):
                    print("Closing runner...")
                    await runner.close()

        except Exception as e:
            print(f"GitHub Agent failed or not available: {e}")
            import traceback

            traceback.print_exc()

        print(f"Falling back to legacy analysis for {repo_url}")

        loop = asyncio.get_running_loop()
        data = await loop.run_in_executor(
            None, partial(analyze_repo, readme_text or "", files or [])
        )

        print(f"Analysis result: {data}")

        if isinstance(data, dict):
            data.setdefault("repo_url", repo_url or "unknown")
            if not data.get("project_title") or data.get("project_title") == "Untitled":
                repo_name = repo_url.split("/")[-1] if "/" in repo_url else "Project"
                data["project_title"] = (
                    repo_name.replace("-", " ").replace("_", " ").title()
                )
        return data
    except Exception as e:
        print(f"Error analyzing repo {repo_url}: {e}")
        import traceback

        traceback.print_exc()

        repo_name = repo_url.split("/")[-1] if "/" in repo_url else "Project"
        return {
            "project_title": repo_name.replace("-", " ").replace("_", " ").title(),
            "project_summary": f"Repository: {repo_url}. Please add more details manually.",
            "repo_url": repo_url or "unknown",
            "primary_languages": [],
            "frameworks_or_libraries": [],
            "project_type": "unknown",
            "detected_domains": [],
            "required_skills": [],
            "complexity_level": "intermediate",
            "estimated_collaboration_roles": [],
        }


async def analyze_project_repo(repo_url: str):
    return await analyze_repo_url(repo_url)


async def analyze_user_repository(repo_url: str):
    # This is similar to analyze_repo_url but for user profile specific data
    # ... (keeping the implementation concise or reusing the logic if possible,
    # but the prompt structure was different in the original file.
    # I'll restore the original implementation for safety.)

    if "GOOGLE_API_KEY" not in os.environ:
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            os.environ["GOOGLE_API_KEY"] = api_key

    try:
        print(f"Analyzing user repository: {repo_url}")
        agent = create_github_agent()
        session_service = InMemorySessionService()
        user_id = "user_repo_" + str(uuid.uuid4())[:8]
        session_id = "session_" + str(uuid.uuid4())[:8]

        await session_service.create_session(
            app_name="agents", user_id=user_id, session_id=session_id
        )

        runner = Runner(app_name="agents", agent=agent, session_service=session_service)

        try:
            parts = repo_url.rstrip("/").split("/")
            repo_name = parts[-1] if parts else "repository"

            prompt = f"""
            Analyze the GitHub repository at {repo_url} to understand the user's contributions and skills.
            
            Return a valid JSON object with this exact structure:
            {{
                "url": "{repo_url}",
                "name": "{repo_name}",
                "commits_count": <number>,
                "contributions": "<brief description>",
                "skills_detected": ["skill1"],
                "languages": ["Python"],
                "frameworks": ["React"],
                "analysis_summary": "<summary>"
            }}
            Output JSON only.
            """

            part = SimpleNamespace(text=prompt)
            msg = SimpleNamespace(role="user", parts=[part])
            full_response_text = ""

            async for event in runner.run_async(
                user_id=user_id, session_id=session_id, new_message=msg
            ):
                if hasattr(event, "text") and event.text:
                    full_response_text += event.text
                elif hasattr(event, "content"):
                    c = event.content
                    if hasattr(c, "parts"):
                        for p in c.parts:
                            if hasattr(p, "text") and p.text:
                                full_response_text += p.text

            if full_response_text:
                dummy_resp = SimpleNamespace(text=full_response_text)
                result = _parse_json_from_response(dummy_resp)
                if isinstance(result, dict):
                    result.setdefault("url", repo_url)
                    result.setdefault("name", repo_name)
                    result["last_analyzed"] = datetime.utcnow().isoformat() + "Z"
                return result
            else:
                raise Exception("No response from GitHub agent")

        finally:
            if hasattr(runner, "close"):
                await runner.close()

    except Exception as e:
        print(f"Error analyzing user repository {repo_url}: {e}")
        parts = repo_url.rstrip("/").split("/")
        repo_name = parts[-1] if parts else "repository"
        return {
            "url": repo_url,
            "name": repo_name,
            "commits_count": 0,
            "contributions": "Analysis failed",
            "skills_detected": [],
            "languages": [],
            "frameworks": [],
            "last_analyzed": datetime.utcnow().isoformat() + "Z",
            "analysis_summary": f"Repository: {repo_url}. Analysis failed.",
        }


def analyze_user_repos(username: str, repos_meta: list):
    """
    Analyze a list of user repositories to extract skills and summary.
    """
    try:
        repo_descriptions = []
        for repo in repos_meta:
            name = repo.get("name", "unknown")
            desc = repo.get("description", "")
            langs = ", ".join(repo.get("languages", []))
            repo_descriptions.append(
                f"Repo: {name}\nDescription: {desc}\nLanguages: {langs}"
            )

        repos_text = "\n\n".join(repo_descriptions)

        prompt = f"""
        Analyze the following GitHub repositories for user '{username}':
        
        {repos_text}
        
        Based on these repositories, identify the user's core skills, primary programming languages, and provide a professional summary for their profile.
        
        Return a JSON object with the following structure:
        {{
            "core_skills": ["skill1", "skill2", ...],
            "embedding_summary": "A professional summary of the user's coding profile...",
            "estimated_experience_level": "Beginner/Intermediate/Advanced"
        }}
        """

        resp = genai.GenerativeModel(
            os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        ).generate_content(prompt)

        result = _parse_json_from_response(resp)
        return result

    except Exception as e:
        print(f"Error analyzing user repos for {username}: {e}")
        return {
            "core_skills": [],
            "embedding_summary": f"Developer profile for {username}.",
            "estimated_experience_level": "Unknown",
        }
