"""
Resume Parser Utility

Uses Google Gemini AI to parse resume files (PDF, DOCX) and extract structured information
including GitHub repositories, awards, skills, education, and certifications.
"""

import os
import io
import json
import google.generativeai as genai
from typing import Dict
from dotenv import load_dotenv
import PyPDF2
from docx import Document

load_dotenv()
genai.configure(api_key=(os.getenv("GEMINI_API_KEY") or "").strip())

RESUME_PARSE_PROMPT = """
You are a resume parser. Extract structured information from the following resume text.

Resume Text:
{resume_text}

Extract and return a JSON object with the following structure:
{{
    "github_repos": ["list of GitHub repository URLs found in the resume"],
    "awards": ["list of awards, achievements, or extra-curricular activities"],
    "skills": ["list of technical skills, programming languages, frameworks, tools"],
    "college_name": "name of the college/university (most recent if multiple)",
    "college_gpa": "GPA if mentioned (e.g., '3.8/4.0' or '8.5/10')",
    "college_years": "years of attendance (e.g., '2020-2024')",
    "certifications": ["list of certifications or professional courses"]
}}

Important:
- For github_repos, look for URLs like github.com/username/repo
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


def extract_text_from_docx(file_content: bytes) -> str:
    """Extract text from DOCX file"""
    try:
        doc_file = io.BytesIO(file_content)
        doc = Document(doc_file)
        text = ""
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
        return text.strip()
    except Exception as e:
        print(f"Error extracting text from DOCX: {e}")
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
            "github_repos": List[str],
            "awards": List[str],
            "skills": List[str],
            "college_name": str,
            "college_gpa": str,
            "college_years": str,
            "certifications": List[str]
        }
    """
    try:
        # Extract text based on file type
        filename_lower = filename.lower()
        if filename_lower.endswith(".pdf"):
            resume_text = extract_text_from_pdf(file_content)
        elif filename_lower.endswith(".docx"):
            resume_text = extract_text_from_docx(file_content)
        else:
            raise ValueError(
                f"Unsupported file type: {filename}. Only PDF and DOCX are supported."
            )

        if not resume_text or len(resume_text.strip()) < 50:
            raise ValueError(
                "Could not extract sufficient text from resume. Please check the file."
            )

        print(f"Extracted {len(resume_text)} characters from resume")

        # Use Gemini to parse the resume
        prompt = RESUME_PARSE_PROMPT.format(
            resume_text=resume_text[:10000]
        )  # Limit to 10k chars

        response = genai.GenerativeModel(
            os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        ).generate_content(prompt)

        # Parse JSON response
        response_text = response.text.strip()

        # Clean up response (remove markdown code blocks if present)
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        elif response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]

        parsed_data = json.loads(response_text.strip())

        # Validate and set defaults
        result = {
            "github_repos": parsed_data.get("github_repos", []),
            "awards": parsed_data.get("awards", []),
            "skills": parsed_data.get("skills", []),
            "college_name": parsed_data.get("college_name"),
            "college_gpa": parsed_data.get("college_gpa"),
            "college_years": parsed_data.get("college_years"),
            "certifications": parsed_data.get("certifications", []),
        }

        print(
            f"Successfully parsed resume: {len(result['skills'])} skills, {len(result['github_repos'])} repos"
        )

        return result

    except json.JSONDecodeError as e:
        print(f"Failed to parse Gemini response as JSON: {e}")
        print(f"Response text: {response_text[:500]}")
        # Return empty structure
        return {
            "github_repos": [],
            "awards": [],
            "skills": [],
            "college_name": None,
            "college_gpa": None,
            "college_years": None,
            "certifications": [],
        }
    except Exception as e:
        print(f"Error parsing resume: {e}")
        import traceback

        traceback.print_exc()
        # Return empty structure
        return {
            "github_repos": [],
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
