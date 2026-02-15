from sqlalchemy.orm import Session
from .database import SessionLocal
from . import models, auth
from app.utils import embed_text


def seed_database():
    db = SessionLocal()

    # Clear existing data
    db.query(models.Swipe).delete()
    db.query(models.Project).delete()
    db.query(models.User).delete()
    db.query(models.Candidate).delete()
    db.commit()

    # Create dummy users with diverse Unsplash avatars
    users_data = [
        {
            "username": "arjun_sharma",
            "name": "Arjun Sharma",
            "email": "arjun@example.com",
            "password": "arjun123",
            "skills": ["Python", "Django", "React", "PostgreSQL", "AWS"],
            "bio": "Full-stack developer from Bangalore, passionate about building scalable web applications. I love working on fintech and e-commerce projects.",
            "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face&auto=format",
        },
        {
            "username": "priya_patel",
            "name": "Priya Patel",
            "email": "priya@example.com",
            "password": "priya123",
            "skills": ["React", "TypeScript", "Node.js", "MongoDB", "Express"],
            "bio": "Frontend developer from Mumbai, specializing in React and modern JavaScript. I enjoy creating beautiful user interfaces and have experience in EdTech startups.",
            "avatar_url": "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face&auto=format",
        },
        {
            "username": "rajesh_kumar",
            "name": "Rajesh Kumar",
            "email": "rajesh@example.com",
            "password": "rajesh123",
            "skills": ["Java", "Spring Boot", "Microservices", "Docker", "Kubernetes"],
            "bio": "Backend developer from Delhi with expertise in Java and microservices architecture. I work on enterprise applications and love solving complex technical challenges.",
            "avatar_url": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face&auto=format",
        },
        {
            "username": "anita_desai",
            "name": "Anita Desai",
            "email": "anita@example.com",
            "password": "anita123",
            "skills": [
                "Python",
                "Machine Learning",
                "TensorFlow",
                "Pandas",
                "Scikit-learn",
            ],
            "bio": "Data scientist from Pune, passionate about AI and machine learning. I specialize in computer vision and NLP, and love working on healthcare tech projects.",
            "avatar_url": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face&auto=format",
        },
        {
            "username": "vikram_singh",
            "name": "Vikram Singh",
            "email": "vikram@example.com",
            "password": "vikram123",
            "skills": ["React Native", "Flutter", "iOS", "Android", "Firebase"],
            "bio": "Mobile app developer from Chennai, building cross-platform applications. I have experience in fintech and social media apps, and love creating smooth user experiences.",
            "avatar_url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face&auto=format",
        },
        {
            "username": "sneha_reddy",
            "name": "Sneha Reddy",
            "email": "sneha@example.com",
            "password": "sneha123",
            "skills": ["Solidity", "Web3", "React", "TypeScript", "Ethereum"],
            "bio": "Blockchain developer from Hyderabad, passionate about DeFi and Web3. I build smart contracts and dApps, and love exploring the future of decentralized finance.",
            "avatar_url": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face&auto=format",
        },
        {
            "username": "rohit_verma",
            "name": "Rohit Verma",
            "email": "rohit@example.com",
            "password": "rohit123",
            "skills": ["JavaScript", "Vue.js", "Nuxt.js", "CSS", "Figma"],
            "bio": "Frontend developer from Kolkata, specializing in Vue.js and modern web technologies. I create pixel-perfect designs and love working on creative projects.",
            "avatar_url": "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=150&h=150&fit=crop&crop=face&auto=format",
        },
        {
            "username": "kavya_joshi",
            "name": "Kavya Joshi",
            "email": "kavya@example.com",
            "password": "kavya123",
            "skills": ["Python", "Django", "FastAPI", "PostgreSQL", "Redis"],
            "bio": "Backend developer from Ahmedabad, building robust APIs and microservices. I specialize in Python and have experience in e-commerce and fintech platforms.",
            "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face&auto=format",
        },
    ]

    users = []
    for user_data in users_data:
        hashed_password = auth.get_password_hash(user_data["password"])
        user = models.User(
            username=user_data["username"],
            name=user_data["name"],
            email=user_data["email"],
            password_hash=hashed_password,
            skills=user_data["skills"],
            bio=user_data["bio"],
            avatar_url=user_data["avatar_url"],
            org_type="college",
            org_name="Example University",
            github_profile_url=f"https://github.com/{user_data['username']}",
            github_selected_repos=[
                {"url": f"https://github.com/{user_data['username']}/demo-repo"}
            ],
            activity_score=70,
            top_languages=user_data["skills"][:2],
            top_frameworks=["React"] if "React" in user_data["skills"] else [],
        )
        db.add(user)
        users.append(user)

    db.commit()

    # Create 5 projects for each user (40 total projects)
    projects_data = []

    # Project templates for variety
    project_templates = [
        {
            "title": "AI Study Planner",
            "summary": "An intelligent study planner that uses machine learning to optimize study schedules based on learning patterns and exam dates.",
            "languages": ["Python", "JavaScript"],
            "frameworks": ["FastAPI", "React", "TensorFlow"],
            "project_type": "Web Application",
            "domains": ["AI", "Education", "Productivity"],
            "skills": ["Python", "FastAPI", "React", "Machine Learning", "PostgreSQL"],
            "complexity": "intermediate",
            "roles": ["Backend Developer", "Frontend Developer", "ML Engineer"],
        },
        {
            "title": "Campus Events Hub",
            "summary": "A portal for discovering and organizing campus events with RSVP and notifications.",
            "languages": ["TypeScript", "JavaScript"],
            "frameworks": ["React", "Node.js"],
            "project_type": "Web Application",
            "domains": ["Community", "Events"],
            "skills": ["React", "TypeScript", "Node.js", "MongoDB"],
            "complexity": "beginner",
            "roles": ["Frontend Developer", "Backend Developer"],
        },
        {
            "title": "EcoTracker Mobile App",
            "summary": "A mobile app that helps users track their carbon footprint and suggests eco-friendly alternatives for daily activities.",
            "languages": ["Dart", "JavaScript"],
            "frameworks": ["Flutter", "Node.js"],
            "project_type": "Mobile Application",
            "domains": ["Environment", "Mobile", "Sustainability"],
            "skills": ["Flutter", "Dart", "Node.js", "MongoDB", "UI/UX"],
            "complexity": "beginner",
            "roles": ["Mobile Developer", "Backend Developer", "UI Designer"],
        },
        {
            "title": "DeFi Portfolio Manager",
            "summary": "A decentralized finance portfolio management tool that tracks investments across multiple DeFi protocols and provides analytics.",
            "languages": ["Solidity", "TypeScript"],
            "frameworks": ["React", "Web3.js", "Hardhat"],
            "project_type": "Web Application",
            "domains": ["Blockchain", "Finance", "DeFi"],
            "skills": ["Solidity", "Web3", "React", "TypeScript", "Ethereum"],
            "complexity": "advanced",
            "roles": [
                "Blockchain Developer",
                "Frontend Developer",
                "Smart Contract Developer",
            ],
        },
        {
            "title": "Real-time Chat Application",
            "summary": "A modern chat application with real-time messaging, file sharing, and video calls using WebRTC.",
            "languages": ["TypeScript", "Python"],
            "frameworks": ["React", "FastAPI", "Socket.io"],
            "project_type": "Web Application",
            "domains": ["Communication", "Real-time", "WebRTC"],
            "skills": ["React", "TypeScript", "FastAPI", "WebRTC", "Socket.io"],
            "complexity": "intermediate",
            "roles": [
                "Full-stack Developer",
                "Frontend Developer",
                "Backend Developer",
            ],
        },
        {
            "title": "Fitness Tracker with AI",
            "summary": "A comprehensive fitness tracking app that uses computer vision to analyze workout form and provide personalized recommendations.",
            "languages": ["Python", "Swift", "Kotlin"],
            "frameworks": ["TensorFlow", "iOS", "Android"],
            "project_type": "Mobile Application",
            "domains": ["Health", "AI", "Mobile", "Computer Vision"],
            "skills": ["Python", "TensorFlow", "iOS", "Android", "Computer Vision"],
            "complexity": "advanced",
            "roles": ["ML Engineer", "Mobile Developer", "Computer Vision Engineer"],
        },
        {
            "title": "Open Source Learning Platform",
            "summary": "A collaborative learning platform where students can create and share interactive coding tutorials and exercises.",
            "languages": ["Python", "JavaScript", "TypeScript"],
            "frameworks": ["Django", "React", "PostgreSQL"],
            "project_type": "Web Application",
            "domains": ["Education", "Open Source", "Collaboration"],
            "skills": ["Python", "Django", "React", "TypeScript", "PostgreSQL"],
            "complexity": "intermediate",
            "roles": [
                "Full-stack Developer",
                "Frontend Developer",
                "Backend Developer",
            ],
        },
        {
            "title": "E-commerce Analytics Dashboard",
            "summary": "A comprehensive analytics dashboard for e-commerce businesses to track sales, customer behavior, and inventory management.",
            "languages": ["Python", "JavaScript"],
            "frameworks": ["Django", "React", "Chart.js"],
            "project_type": "Web Application",
            "domains": ["E-commerce", "Analytics", "Business"],
            "skills": ["Python", "Django", "React", "Data Visualization", "PostgreSQL"],
            "complexity": "intermediate",
            "roles": ["Full-stack Developer", "Data Analyst", "UI/UX Designer"],
        },
        {
            "title": "Smart Home IoT Controller",
            "summary": "An IoT application to control and monitor smart home devices with voice commands and mobile app integration.",
            "languages": ["Python", "JavaScript", "C++"],
            "frameworks": ["Flask", "React Native", "Arduino"],
            "project_type": "IoT Application",
            "domains": ["IoT", "Smart Home", "Automation"],
            "skills": ["Python", "IoT", "React Native", "Arduino", "MQTT"],
            "complexity": "advanced",
            "roles": ["IoT Developer", "Mobile Developer", "Hardware Engineer"],
        },
        {
            "title": "Social Media Analytics Tool",
            "summary": "A tool to analyze social media engagement, track trends, and provide insights for content creators and businesses.",
            "languages": ["Python", "JavaScript"],
            "frameworks": ["FastAPI", "Vue.js", "Pandas"],
            "project_type": "Web Application",
            "domains": ["Social Media", "Analytics", "Marketing"],
            "skills": [
                "Python",
                "FastAPI",
                "Vue.js",
                "Data Analysis",
                "API Integration",
            ],
            "complexity": "intermediate",
            "roles": ["Backend Developer", "Frontend Developer", "Data Scientist"],
        },
    ]

    # Create 5 projects for each user
    for user in users:
        for i in range(5):
            template = project_templates[i % len(project_templates)]
            project_data = {
                "title": f"{template['title']} v{i + 1}",
                "summary": template["summary"],
                "repo_url": f"https://github.com/{user.username}/{template['title'].lower().replace(' ', '-')}-v{i + 1}",
                "languages": template["languages"],
                "frameworks": template["frameworks"],
                "project_type": template["project_type"],
                "domains": template["domains"],
                "skills": template["skills"],
                "complexity": template["complexity"],
                "roles": template["roles"],
                "owner_id": user.id,
            }
            projects_data.append(project_data)

    for project_data in projects_data:
        project = models.Project(**project_data)
        db.add(project)

    db.commit()

    # Seed candidates for Talent Search feature
    print("Seeding candidates...")
    candidates_data = [
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
    ]

    for candidate_data in candidates_data:
        # Generate embedding from candidate summary and skills
        embedding_text = f"{candidate_data['title']} {candidate_data['summary']} {' '.join(candidate_data['skills'])}"
        print(f"  → Generating embedding for {candidate_data['name']}...")
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

    db.commit()
    db.close()

    print("✅ Database seeded successfully with users, projects, and candidates!")


if __name__ == "__main__":
    seed_database()
