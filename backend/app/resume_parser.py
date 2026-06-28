"""
Resume Parser Utility

Uses Google Gemini AI to parse PDF resumes and extract structured information
including GitHub repositories, awards, skills, education, and certifications.
"""

import os
import io
import json
from typing import Dict
from dotenv import load_dotenv
import PyPDF2

from app.llm import generate

load_dotenv()

RESUME_PARSE_PROMPT = """
You are a resume parser. Extract structured information from the following resume text.
First, determine if the provided text is actually a resume (Curriculum Vitae). If it's a completely unrelated document, set "is_resume" to false. Otherwise, set it to true.

Resume Text:
{resume_text}

Extract and return a JSON object with the following structure:
{{
    "is_resume": boolean,
    "github_profile_url": "URL of the candidate's GitHub profile",
    "awards": ["list of awards, achievements, or extra-curricular activities"],
    "skills": ["list of technical skills, programming languages, frameworks, tools"],
    "college_name": "name of the college/university (most recent if multiple)",
    "college_gpa": "GPA if mentioned (e.g., '3.8/4.0' or '8.5/10')",
    "college_years": "years of attendance (e.g., '2020-2024')",
    "certifications": ["list of certifications or professional courses"]
}}

Important:
- For github_profile_url, extract the main GitHub profile link (e.g. github.com/username). If there's an individual repo link, strip the repo name off to get the profile.
- For awards, include hackathon wins, competitions, scholarships, leadership positions
- For skills, extract technical skills only (programming languages, frameworks, tools, technologies)
- If a field is not found, use an empty list [] or null
- Return ONLY valid JSON, no additional text or explanations
"""


def extract_text_from_pdf(file_content: bytes) -> str:
    """Extract text from PDF file"""
    try:
        pdf_file = io.BytesIO(file_content)
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        print(f"Error extracting text from PDF: {e}")
        return ""


async def parse_resume(file_content: bytes, filename: str) -> Dict:
    """
    Parse resume file and extract structured information using Gemini AI.

    Args:
        file_content: Binary content of the resume file
        filename: Name of the file (used to determine file type)

    Returns:
        Dictionary with extracted information:
        {
            "github_profile_url": str,
            "awards": List[str],
            "skills": List[str],
            "college_name": str,
            "college_gpa": str,
            "college_years": str,
            "certifications": List[str]
        }
    """
    try:
        if not filename.lower().endswith(".pdf"):
            raise ValueError(
                f"Unsupported file type: {filename}. Only PDF is supported."
            )
        resume_text = extract_text_from_pdf(file_content)

        if not resume_text or len(resume_text.strip()) < 50:
            raise ValueError(
                "Could not extract sufficient text from resume. Please check the file."
            )

        print(f"Extracted {len(resume_text)} characters from resume")

        # Use Gemini to parse the resume
        prompt = RESUME_PARSE_PROMPT.format(
            resume_text=resume_text[:10000]
        )  # Limit to 10k chars

        response_text = generate(
            os.getenv("GEMINI_MODEL", "gemini-2.5-flash"), prompt
        ).strip()

        # Clean up response (remove markdown code blocks if present)
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        elif response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]

        parsed_data = json.loads(response_text.strip())

        if not parsed_data.get("is_resume", True):
            raise ValueError(
                "The uploaded document does not appear to be a resume. Please upload a valid resume."
            )

        # Validate and set defaults
        result = {
            "github_profile_url": parsed_data.get("github_profile_url") or "",
            "awards": parsed_data.get("awards", []),
            "skills": parsed_data.get("skills", []),
            "college_name": parsed_data.get("college_name"),
            "college_gpa": parsed_data.get("college_gpa"),
            "college_years": parsed_data.get("college_years"),
            "certifications": parsed_data.get("certifications", []),
        }

        print(
            f"Successfully parsed resume: {len(result['skills'])} skills from profile {result.get('github_profile_url')}"
        )

        return result

    except json.JSONDecodeError as e:
        print(f"Failed to parse Gemini response as JSON: {e}")
        print(f"Response text: {response_text[:500]}")
        # Return empty structure
        return {
            "github_profile_url": "",
            "awards": [],
            "skills": [],
            "college_name": None,
            "college_gpa": None,
            "college_years": None,
            "certifications": [],
        }
    except ValueError:
        raise
    except Exception as e:
        print(f"Error parsing resume: {e}")
        import traceback

        traceback.print_exc()
        # Return empty structure
        return {
            "github_profile_url": "",
            "awards": [],
            "skills": [],
            "college_name": None,
            "college_gpa": None,
            "college_years": None,
            "certifications": [],
        }


def calculate_portfolio_score(repo_analyses: list) -> dict:
    """
    Calculate portfolio score (0-100) and rank based on GitHub repository analyses.

    Args:
        repo_analyses: List of repository analysis dictionaries from analyze_user_repository

    Returns:
        {
            "score": int (0-100),
            "rank": str ("Beginner", "Intermediate", "Advanced", "Expert"),
            "breakdown": {
                "repo_count": int,
                "total_commits": int,
                "languages_diversity": int,
                "skills_count": int
            }
        }
    """
    if not repo_analyses:
        return {
            "score": 0,
            "rank": "Beginner",
            "breakdown": {
                "repo_count": 0,
                "total_commits": 0,
                "languages_diversity": 0,
                "skills_count": 0,
            },
        }

    # Calculate metrics
    repo_count = len(repo_analyses)
    total_commits = sum(repo.get("commits_count", 0) for repo in repo_analyses)

    # Collect unique languages and skills
    all_languages = set()
    all_skills = set()
    for repo in repo_analyses:
        all_languages.update(repo.get("languages", []))
        all_skills.update(repo.get("skills_detected", []))

    languages_diversity = len(all_languages)
    skills_count = len(all_skills)

    # Scoring algorithm (0-100)
    score = 0

    # Repo count (max 20 points)
    # 1 repo = 4, 2 repos = 8, 3 repos = 12, 4 repos = 16, 5 repos = 20
    score += min(repo_count * 4, 20)

    # Commits (max 30 points)
    # 0-10 commits = 0-10 points, 10-50 = 10-20, 50-100 = 20-25, 100+ = 25-30
    if total_commits <= 10:
        score += total_commits
    elif total_commits <= 50:
        score += 10 + ((total_commits - 10) / 40) * 10
    elif total_commits <= 100:
        score += 20 + ((total_commits - 50) / 50) * 5
    else:
        score += 25 + min((total_commits - 100) / 100 * 5, 5)

    # Languages diversity (max 25 points)
    # 1-2 languages = 5-10, 3-4 = 10-15, 5-6 = 15-20, 7+ = 20-25
    score += min(languages_diversity * 3.5, 25)

    # Skills count (max 25 points)
    # Similar to languages
    score += min(skills_count * 2.5, 25)

    # Round to integer
    score = int(min(score, 100))

    # Determine rank
    if score >= 80:
        rank = "Expert"
    elif score >= 60:
        rank = "Advanced"
    elif score >= 35:
        rank = "Intermediate"
    else:
        rank = "Beginner"

    return {
        "score": score,
        "rank": rank,
        "breakdown": {
            "repo_count": repo_count,
            "total_commits": total_commits,
            "languages_diversity": languages_diversity,
            "skills_count": skills_count,
        },
    }
