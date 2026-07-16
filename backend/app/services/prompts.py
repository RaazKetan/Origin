"""Shared Gemini prompts."""

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


# LLM prompt to pick a candidate's most impressive repos. Fill {top_n} and
# {projects_data} (from fetch_candidate_repos), then run through generate().
GITHUB_PROJECT_SELECTION_PROMPT = """You are an expert technical recruiter picking a candidate's most impressive GitHub projects for a software-engineering evaluation.

HARD REQUIREMENT: only select projects where author_commit_count >= 4. Never select projects with 1-3 commits (minimal involvement).

Select the TOP {top_n} most impressive projects. Fewer qualifying projects -> return all of them; never pad.

Priorities (highest first):
1. Author contribution level (high author_commit_count).
2. Meaningful contributions to popular open source (1000+ stars: React, Django, TensorFlow, Kubernetes, etc.) - a real bug fix/feature there beats a solo toy project.
3. Technical complexity and architecture.
4. Real-world impact (users, deployments).
5. Code quality, docs, maintenance.
6. Community engagement (stars/forks).
7. Modern, relevant tech stack.
8. Originality (not tutorial/classroom clones).

Avoid: 1-3 commit repos, "hello world"/basic-calculator tutorials, generic classroom names, dead repos with no activity.

Repository data:
{projects_data}

Sort by author_commit_count desc, drop anything < 4, select from the top. Return ONLY a JSON array of the selected project objects, each with: name, description, github_url, live_url, technologies (array), reason_for_project_selection, author_commit_count, total_commit_count, github_details (stars, forks, language, topics, open_issues, size, fork, archived, created_at, updated_at). No prose, valid JSON only."""
