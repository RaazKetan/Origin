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
