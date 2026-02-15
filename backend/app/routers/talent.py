from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from .. import models, auth
from ..database import get_db
from ..utils import embed_text
import math

router = APIRouter(prefix="/talent", tags=["Talent Sourcing"])


class TalentSearchRequest(BaseModel):
    query: str


class CandidateResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str]
    title: str
    location: Optional[str]
    experience_years: int
    current_company: Optional[str]
    current_role: Optional[str]
    work_history: List[dict]
    skills: List[str]
    certifications: List[str]
    education: List[dict]
    summary: str
    match_score: float

    class Config:
        from_attributes = True


@router.post("/search", response_model=List[CandidateResponse])
async def search_candidates(
    request: TalentSearchRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Search for candidates using natural language query.
    Uses vector similarity to find best matches.
    """
    try:
        print(f"Searching candidates for query: {request.query[:100]}...")

        # Generate embedding for the search query
        query_embedding = embed_text(request.query)
        print(
            f"Generated query embedding with {len(query_embedding) if query_embedding else 0} dimensions"
        )

        # Get all active candidates
        candidates = (
            db.query(models.Candidate).filter(models.Candidate.is_active == True).all()
        )
        print(f"Found {len(candidates)} active candidates")

        if not query_embedding:
            raise HTTPException(
                status_code=500, detail="Failed to generate search embedding"
            )

        # Calculate similarity scores
        results = []
        for candidate in candidates:
            if candidate.candidate_vector:
                try:
                    score = cosine_similarity(
                        query_embedding, candidate.candidate_vector
                    )
                    if score > 0.1:  # Only include relevant matches
                        results.append(
                            CandidateResponse(
                                id=candidate.id,
                                name=candidate.name,
                                email=candidate.email,
                                phone=candidate.phone,
                                title=candidate.title,
                                location=candidate.location,
                                experience_years=candidate.experience_years,
                                current_company=candidate.current_company,
                                current_role=candidate.current_role,
                                work_history=candidate.work_history or [],
                                skills=candidate.skills or [],
                                certifications=candidate.certifications or [],
                                education=candidate.education or [],
                                summary=candidate.summary or "",
                                match_score=round(score, 3),
                            )
                        )
                except Exception as e:
                    print(
                        f"Error calculating similarity for candidate {candidate.id}: {e}"
                    )

        # Sort by match score descending
        results.sort(key=lambda x: x.match_score, reverse=True)

        print(f"Returning {len(results)} matching candidates")
        return results[:20]  # Return top 20 matches

    except HTTPException:
        raise
    except Exception as e:
        print(f"Talent search failed: {e}")
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.post("/seed")
async def seed_candidates(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Seed database with dummy candidate data for testing.
    """
    try:
        # Check if candidates already exist
        existing_count = db.query(models.Candidate).count()
        if existing_count > 0:
            return {
                "message": f"Database already has {existing_count} candidates. Skipping seed."
            }

        dummy_candidates = [
            {
                "name": "Sarah Chen",
                "email": "sarah.chen@example.com",
                "phone": "+1-555-0101",
                "title": "Senior Full-Stack Engineer",
                "location": "San Francisco, CA",
                "experience_years": 8,
                "current_company": "TechCorp",
                "current_role": "Senior Software Engineer",
                "work_history": [
                    {
                        "company": "TechCorp",
                        "role": "Senior Software Engineer",
                        "duration": "2020-Present",
                        "description": "Lead development of microservices architecture using Node.js and React",
                    },
                    {
                        "company": "StartupXYZ",
                        "role": "Full-Stack Developer",
                        "duration": "2017-2020",
                        "description": "Built e-commerce platform with React, Node.js, and PostgreSQL",
                    },
                    {
                        "company": "WebAgency",
                        "role": "Junior Developer",
                        "duration": "2015-2017",
                        "description": "Developed client websites using JavaScript and PHP",
                    },
                ],
                "skills": [
                    "JavaScript",
                    "React",
                    "Node.js",
                    "TypeScript",
                    "PostgreSQL",
                    "AWS",
                    "Docker",
                    "Kubernetes",
                    "GraphQL",
                    "REST APIs",
                ],
                "certifications": [
                    "AWS Certified Solutions Architect",
                    "Google Cloud Professional",
                ],
                "education": [
                    {
                        "degree": "BS Computer Science",
                        "institution": "Stanford University",
                        "year": 2015,
                    }
                ],
                "summary": "Experienced full-stack engineer with 8 years building scalable web applications. Expert in React, Node.js, and cloud infrastructure. Led teams of 5+ developers and architected microservices for high-traffic applications.",
            },
            {
                "name": "Marcus Johnson",
                "email": "marcus.j@example.com",
                "phone": "+1-555-0102",
                "title": "Machine Learning Engineer",
                "location": "New York, NY",
                "experience_years": 6,
                "current_company": "AI Innovations",
                "current_role": "ML Engineer",
                "work_history": [
                    {
                        "company": "AI Innovations",
                        "role": "ML Engineer",
                        "duration": "2019-Present",
                        "description": "Developed recommendation systems and NLP models using TensorFlow and PyTorch",
                    },
                    {
                        "company": "DataCorp",
                        "role": "Data Scientist",
                        "duration": "2017-2019",
                        "description": "Built predictive models for customer analytics using Python and scikit-learn",
                    },
                ],
                "skills": [
                    "Python",
                    "TensorFlow",
                    "PyTorch",
                    "scikit-learn",
                    "Pandas",
                    "NumPy",
                    "SQL",
                    "AWS SageMaker",
                    "MLOps",
                    "Deep Learning",
                ],
                "certifications": [
                    "TensorFlow Developer Certificate",
                    "AWS Machine Learning Specialty",
                ],
                "education": [
                    {"degree": "MS Data Science", "institution": "MIT", "year": 2017},
                    {
                        "degree": "BS Mathematics",
                        "institution": "UC Berkeley",
                        "year": 2015,
                    },
                ],
                "summary": "Machine learning engineer specializing in NLP and recommendation systems. 6 years of experience deploying ML models to production. Strong background in deep learning and MLOps practices.",
            },
            {
                "name": "Priya Patel",
                "email": "priya.patel@example.com",
                "phone": "+1-555-0103",
                "title": "DevOps Engineer",
                "location": "Austin, TX",
                "experience_years": 5,
                "current_company": "CloudScale",
                "current_role": "Senior DevOps Engineer",
                "work_history": [
                    {
                        "company": "CloudScale",
                        "role": "Senior DevOps Engineer",
                        "duration": "2021-Present",
                        "description": "Managed Kubernetes clusters and CI/CD pipelines for 50+ microservices",
                    },
                    {
                        "company": "FinTech Solutions",
                        "role": "DevOps Engineer",
                        "duration": "2018-2021",
                        "description": "Automated infrastructure deployment using Terraform and Ansible",
                    },
                ],
                "skills": [
                    "Kubernetes",
                    "Docker",
                    "Terraform",
                    "AWS",
                    "Azure",
                    "Jenkins",
                    "GitLab CI",
                    "Prometheus",
                    "Grafana",
                    "Python",
                    "Bash",
                ],
                "certifications": [
                    "Certified Kubernetes Administrator",
                    "AWS DevOps Professional",
                    "HashiCorp Terraform Associate",
                ],
                "education": [
                    {
                        "degree": "BS Computer Engineering",
                        "institution": "University of Texas",
                        "year": 2018,
                    }
                ],
                "summary": "DevOps engineer with 5 years of experience in cloud infrastructure and automation. Expert in Kubernetes, Terraform, and CI/CD pipelines. Reduced deployment time by 70% through automation.",
            },
            {
                "name": "Alex Rodriguez",
                "email": "alex.r@example.com",
                "phone": "+1-555-0104",
                "title": "Mobile App Developer",
                "location": "Seattle, WA",
                "experience_years": 4,
                "current_company": "AppStudio",
                "current_role": "iOS Developer",
                "work_history": [
                    {
                        "company": "AppStudio",
                        "role": "iOS Developer",
                        "duration": "2020-Present",
                        "description": "Developed iOS apps using Swift and SwiftUI for 2M+ users",
                    },
                    {
                        "company": "MobileFirst",
                        "role": "Mobile Developer",
                        "duration": "2019-2020",
                        "description": "Built cross-platform apps using React Native",
                    },
                ],
                "skills": [
                    "Swift",
                    "SwiftUI",
                    "iOS",
                    "React Native",
                    "Firebase",
                    "REST APIs",
                    "Git",
                    "Xcode",
                    "TestFlight",
                ],
                "certifications": ["Apple Certified iOS Developer"],
                "education": [
                    {
                        "degree": "BS Software Engineering",
                        "institution": "University of Washington",
                        "year": 2019,
                    }
                ],
                "summary": "Mobile app developer with 4 years of experience building iOS applications. Published 10+ apps on the App Store with millions of downloads. Strong focus on UI/UX and performance optimization.",
            },
            {
                "name": "Emily Watson",
                "email": "emily.watson@example.com",
                "phone": "+1-555-0105",
                "title": "Backend Engineer",
                "location": "Boston, MA",
                "experience_years": 7,
                "current_company": "Enterprise Solutions",
                "current_role": "Senior Backend Engineer",
                "work_history": [
                    {
                        "company": "Enterprise Solutions",
                        "role": "Senior Backend Engineer",
                        "duration": "2019-Present",
                        "description": "Designed and implemented RESTful APIs using Java Spring Boot",
                    },
                    {
                        "company": "FinanceApp",
                        "role": "Backend Developer",
                        "duration": "2016-2019",
                        "description": "Built payment processing systems using Python and Django",
                    },
                ],
                "skills": [
                    "Java",
                    "Spring Boot",
                    "Python",
                    "Django",
                    "PostgreSQL",
                    "MongoDB",
                    "Redis",
                    "Kafka",
                    "Microservices",
                    "REST APIs",
                ],
                "certifications": [
                    "Oracle Certified Java Programmer",
                    "MongoDB Certified Developer",
                ],
                "education": [
                    {
                        "degree": "BS Computer Science",
                        "institution": "Boston University",
                        "year": 2016,
                    }
                ],
                "summary": "Backend engineer with 7 years of experience in distributed systems and API development. Expert in Java Spring Boot and microservices architecture. Handled systems processing 1M+ transactions daily.",
            },
            {
                "name": "David Kim",
                "email": "david.kim@example.com",
                "phone": "+1-555-0106",
                "title": "Frontend Developer",
                "location": "Los Angeles, CA",
                "experience_years": 3,
                "current_company": "DesignTech",
                "current_role": "Frontend Developer",
                "work_history": [
                    {
                        "company": "DesignTech",
                        "role": "Frontend Developer",
                        "duration": "2021-Present",
                        "description": "Built responsive web applications using React and TypeScript",
                    },
                    {
                        "company": "WebStudio",
                        "role": "Junior Frontend Developer",
                        "duration": "2020-2021",
                        "description": "Developed UI components using Vue.js",
                    },
                ],
                "skills": [
                    "React",
                    "TypeScript",
                    "JavaScript",
                    "HTML",
                    "CSS",
                    "Tailwind CSS",
                    "Redux",
                    "Next.js",
                    "Webpack",
                    "Git",
                ],
                "certifications": ["Meta Frontend Developer Professional Certificate"],
                "education": [
                    {
                        "degree": "BS Information Systems",
                        "institution": "UCLA",
                        "year": 2020,
                    }
                ],
                "summary": "Frontend developer with 3 years of experience creating modern web applications. Specialized in React and TypeScript. Strong eye for design and user experience.",
            },
            {
                "name": "Lisa Anderson",
                "email": "lisa.anderson@example.com",
                "phone": "+1-555-0107",
                "title": "Data Engineer",
                "location": "Chicago, IL",
                "experience_years": 6,
                "current_company": "DataFlow Inc",
                "current_role": "Senior Data Engineer",
                "work_history": [
                    {
                        "company": "DataFlow Inc",
                        "role": "Senior Data Engineer",
                        "duration": "2020-Present",
                        "description": "Built data pipelines processing 10TB+ daily using Apache Spark",
                    },
                    {
                        "company": "Analytics Corp",
                        "role": "Data Engineer",
                        "duration": "2017-2020",
                        "description": "Designed ETL workflows using Python and Airflow",
                    },
                ],
                "skills": [
                    "Python",
                    "Apache Spark",
                    "Airflow",
                    "SQL",
                    "AWS",
                    "Snowflake",
                    "dbt",
                    "Kafka",
                    "Hadoop",
                    "Data Warehousing",
                ],
                "certifications": [
                    "Databricks Certified Data Engineer",
                    "AWS Data Analytics Specialty",
                ],
                "education": [
                    {
                        "degree": "MS Data Engineering",
                        "institution": "Northwestern University",
                        "year": 2017,
                    }
                ],
                "summary": "Data engineer with 6 years of experience building scalable data pipelines. Expert in Apache Spark and cloud data platforms. Processed petabytes of data for analytics and ML.",
            },
            {
                "name": "James Wilson",
                "email": "james.wilson@example.com",
                "phone": "+1-555-0108",
                "title": "Security Engineer",
                "location": "Washington, DC",
                "experience_years": 9,
                "current_company": "SecureNet",
                "current_role": "Principal Security Engineer",
                "work_history": [
                    {
                        "company": "SecureNet",
                        "role": "Principal Security Engineer",
                        "duration": "2018-Present",
                        "description": "Led security architecture and penetration testing for enterprise applications",
                    },
                    {
                        "company": "CyberDefense",
                        "role": "Security Engineer",
                        "duration": "2014-2018",
                        "description": "Implemented security controls and conducted vulnerability assessments",
                    },
                ],
                "skills": [
                    "Penetration Testing",
                    "Security Architecture",
                    "Python",
                    "Burp Suite",
                    "Metasploit",
                    "OWASP",
                    "AWS Security",
                    "Cryptography",
                    "SIEM",
                ],
                "certifications": ["CISSP", "CEH", "OSCP", "AWS Security Specialty"],
                "education": [
                    {
                        "degree": "BS Cybersecurity",
                        "institution": "George Washington University",
                        "year": 2014,
                    }
                ],
                "summary": "Security engineer with 9 years of experience in application security and penetration testing. Multiple security certifications including CISSP and OSCP. Protected systems handling sensitive data for Fortune 500 companies.",
            },
            {
                "name": "Rachel Green",
                "email": "rachel.green@example.com",
                "phone": "+1-555-0109",
                "title": "QA Automation Engineer",
                "location": "Denver, CO",
                "experience_years": 5,
                "current_company": "TestPro",
                "current_role": "Senior QA Engineer",
                "work_history": [
                    {
                        "company": "TestPro",
                        "role": "Senior QA Engineer",
                        "duration": "2020-Present",
                        "description": "Developed automated test frameworks using Selenium and Cypress",
                    },
                    {
                        "company": "SoftwareHouse",
                        "role": "QA Engineer",
                        "duration": "2018-2020",
                        "description": "Created test plans and automated regression tests",
                    },
                ],
                "skills": [
                    "Selenium",
                    "Cypress",
                    "Python",
                    "JavaScript",
                    "TestNG",
                    "JUnit",
                    "Jenkins",
                    "API Testing",
                    "Performance Testing",
                    "Agile",
                ],
                "certifications": ["ISTQB Advanced Test Automation Engineer"],
                "education": [
                    {
                        "degree": "BS Computer Science",
                        "institution": "University of Colorado",
                        "year": 2018,
                    }
                ],
                "summary": "QA automation engineer with 5 years of experience in test automation. Built comprehensive test frameworks that reduced manual testing by 80%. Expert in Selenium and CI/CD integration.",
            },
            {
                "name": "Michael Brown",
                "email": "michael.brown@example.com",
                "phone": "+1-555-0110",
                "title": "Solutions Architect",
                "location": "Atlanta, GA",
                "experience_years": 10,
                "current_company": "CloudArchitects",
                "current_role": "Principal Solutions Architect",
                "work_history": [
                    {
                        "company": "CloudArchitects",
                        "role": "Principal Solutions Architect",
                        "duration": "2019-Present",
                        "description": "Designed cloud-native architectures for enterprise clients",
                    },
                    {
                        "company": "TechConsulting",
                        "role": "Solutions Architect",
                        "duration": "2015-2019",
                        "description": "Led technical design for large-scale system migrations",
                    },
                ],
                "skills": [
                    "AWS",
                    "Azure",
                    "System Design",
                    "Microservices",
                    "Serverless",
                    "Kubernetes",
                    "Terraform",
                    "Python",
                    "Java",
                    "Architecture Patterns",
                ],
                "certifications": [
                    "AWS Solutions Architect Professional",
                    "Azure Solutions Architect Expert",
                    "TOGAF Certified",
                ],
                "education": [
                    {
                        "degree": "MS Computer Science",
                        "institution": "Georgia Tech",
                        "year": 2013,
                    }
                ],
                "summary": "Solutions architect with 10 years of experience designing enterprise-scale systems. Led architecture for 50+ cloud migration projects. Expert in AWS, Azure, and microservices patterns.",
            },
            {
                "name": "Jennifer Lee",
                "email": "jennifer.lee@example.com",
                "phone": "+1-555-0111",
                "title": "Junior Software Engineer",
                "location": "Portland, OR",
                "experience_years": 1,
                "current_company": "StartupHub",
                "current_role": "Junior Software Engineer",
                "work_history": [
                    {
                        "company": "StartupHub",
                        "role": "Junior Software Engineer",
                        "duration": "2023-Present",
                        "description": "Developing features for web application using React and Node.js",
                    }
                ],
                "skills": [
                    "JavaScript",
                    "React",
                    "Node.js",
                    "HTML",
                    "CSS",
                    "Git",
                    "MongoDB",
                    "Express.js",
                ],
                "certifications": [],
                "education": [
                    {
                        "degree": "BS Computer Science",
                        "institution": "Portland State University",
                        "year": 2023,
                    }
                ],
                "summary": "Recent computer science graduate with 1 year of professional experience. Passionate about web development and eager to learn. Strong foundation in JavaScript and modern web frameworks.",
            },
            {
                "name": "Robert Taylor",
                "email": "robert.taylor@example.com",
                "phone": "+1-555-0112",
                "title": "Blockchain Developer",
                "location": "Miami, FL",
                "experience_years": 4,
                "current_company": "CryptoTech",
                "current_role": "Blockchain Developer",
                "work_history": [
                    {
                        "company": "CryptoTech",
                        "role": "Blockchain Developer",
                        "duration": "2021-Present",
                        "description": "Developed smart contracts using Solidity and Web3.js",
                    },
                    {
                        "company": "DeFi Solutions",
                        "role": "Smart Contract Developer",
                        "duration": "2019-2021",
                        "description": "Built DeFi protocols on Ethereum",
                    },
                ],
                "skills": [
                    "Solidity",
                    "Ethereum",
                    "Web3.js",
                    "Smart Contracts",
                    "JavaScript",
                    "Hardhat",
                    "Truffle",
                    "IPFS",
                    "DeFi",
                ],
                "certifications": ["Certified Blockchain Developer"],
                "education": [
                    {
                        "degree": "BS Computer Science",
                        "institution": "University of Miami",
                        "year": 2019,
                    }
                ],
                "summary": "Blockchain developer with 4 years of experience in smart contract development. Built and audited DeFi protocols handling $10M+ in TVL. Expert in Solidity and Ethereum ecosystem.",
            },
            {
                "name": "Amanda Martinez",
                "email": "amanda.martinez@example.com",
                "phone": "+1-555-0113",
                "title": "Product Engineer",
                "location": "San Diego, CA",
                "experience_years": 6,
                "current_company": "ProductCo",
                "current_role": "Senior Product Engineer",
                "work_history": [
                    {
                        "company": "ProductCo",
                        "role": "Senior Product Engineer",
                        "duration": "2020-Present",
                        "description": "Led development of customer-facing features using React and Python",
                    },
                    {
                        "company": "GrowthStartup",
                        "role": "Product Engineer",
                        "duration": "2017-2020",
                        "description": "Built analytics dashboard and A/B testing framework",
                    },
                ],
                "skills": [
                    "React",
                    "Python",
                    "TypeScript",
                    "PostgreSQL",
                    "Redis",
                    "AWS",
                    "Product Analytics",
                    "A/B Testing",
                    "Data Visualization",
                ],
                "certifications": ["Product Management Certificate"],
                "education": [
                    {
                        "degree": "BS Computer Science",
                        "institution": "UC San Diego",
                        "year": 2017,
                    }
                ],
                "summary": "Product engineer with 6 years of experience bridging technical and product domains. Strong focus on user metrics and data-driven development. Led features used by 500K+ users.",
            },
            {
                "name": "Kevin Zhang",
                "email": "kevin.zhang@example.com",
                "phone": "+1-555-0114",
                "title": "Site Reliability Engineer",
                "location": "San Jose, CA",
                "experience_years": 7,
                "current_company": "ReliableOps",
                "current_role": "Senior SRE",
                "work_history": [
                    {
                        "company": "ReliableOps",
                        "role": "Senior SRE",
                        "duration": "2019-Present",
                        "description": "Maintained 99.99% uptime for critical services handling 1B+ requests/day",
                    },
                    {
                        "company": "ScaleTech",
                        "role": "SRE",
                        "duration": "2016-2019",
                        "description": "Implemented monitoring and incident response systems",
                    },
                ],
                "skills": [
                    "Kubernetes",
                    "Prometheus",
                    "Grafana",
                    "Python",
                    "Go",
                    "Terraform",
                    "AWS",
                    "GCP",
                    "Incident Management",
                    "Monitoring",
                ],
                "certifications": ["Google Cloud Professional Cloud Architect", "CKA"],
                "education": [
                    {
                        "degree": "BS Computer Engineering",
                        "institution": "San Jose State University",
                        "year": 2016,
                    }
                ],
                "summary": "Site reliability engineer with 7 years of experience ensuring high availability of distributed systems. Expert in Kubernetes, monitoring, and incident response. Reduced MTTR by 60%.",
            },
            {
                "name": "Sophia Williams",
                "email": "sophia.williams@example.com",
                "phone": "+1-555-0115",
                "title": "AI Research Engineer",
                "location": "Cambridge, MA",
                "experience_years": 5,
                "current_company": "AI Research Lab",
                "current_role": "Research Engineer",
                "work_history": [
                    {
                        "company": "AI Research Lab",
                        "role": "Research Engineer",
                        "duration": "2020-Present",
                        "description": "Developed novel deep learning architectures for computer vision",
                    },
                    {
                        "company": "ML Innovations",
                        "role": "ML Engineer",
                        "duration": "2018-2020",
                        "description": "Implemented research papers and deployed models to production",
                    },
                ],
                "skills": [
                    "Python",
                    "PyTorch",
                    "TensorFlow",
                    "Computer Vision",
                    "NLP",
                    "Research",
                    "Deep Learning",
                    "CUDA",
                    "Model Optimization",
                ],
                "certifications": ["Published 5 papers in top-tier conferences"],
                "education": [
                    {
                        "degree": "PhD Computer Science (in progress)",
                        "institution": "MIT",
                        "year": 2025,
                    },
                    {
                        "degree": "MS Computer Science",
                        "institution": "Carnegie Mellon",
                        "year": 2018,
                    },
                ],
                "summary": "AI research engineer with 5 years of experience in deep learning research. Published papers in CVPR and NeurIPS. Expert in computer vision and model optimization.",
            },
        ]

        # Create candidates with embeddings
        created_count = 0
        for candidate_data in dummy_candidates:
            # Generate embedding from candidate summary and skills
            embedding_text = f"{candidate_data['title']} {candidate_data['summary']} {' '.join(candidate_data['skills'])}"
            candidate_vector = embed_text(embedding_text)

            candidate = models.Candidate(
                name=candidate_data["name"],
                email=candidate_data["email"],
                phone=candidate_data.get("phone"),
                title=candidate_data["title"],
                location=candidate_data.get("location"),
                experience_years=candidate_data["experience_years"],
                current_company=candidate_data.get("current_company"),
                current_role=candidate_data.get("current_role"),
                work_history=candidate_data["work_history"],
                skills=candidate_data["skills"],
                certifications=candidate_data.get("certifications", []),
                education=candidate_data["education"],
                summary=candidate_data["summary"],
                candidate_vector=candidate_vector,
                is_active=True,
            )
            db.add(candidate)
            created_count += 1

        db.commit()
        print(f"Successfully seeded {created_count} candidates")

        return {"message": f"Successfully seeded {created_count} candidates"}

    except Exception as e:
        db.rollback()
        print(f"Seed failed: {e}")
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Seed failed: {str(e)}")


def cosine_similarity(a, b):
    """Calculate cosine similarity between two vectors"""
    try:
        if not a or not b or len(a) != len(b):
            return 0.0

        dot_product = sum(x * y for x, y in zip(a, b))
        magnitude_a = math.sqrt(sum(x * x for x in a))
        magnitude_b = math.sqrt(sum(x * x for x in b))

        if magnitude_a == 0 or magnitude_b == 0:
            return 0.0

        return dot_product / (magnitude_a * magnitude_b)
    except Exception:
        return 0.0
