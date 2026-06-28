from sqlalchemy.orm import Session
from app import models, schemas

def create_user(db: Session, user: schemas.UserCreate):
    db_user = models.User(**user.dict())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def create_project(db: Session, project: schemas.ProjectCreate, owner_id: int):
    project_dict = project.dict()
    project_dict["owner_id"] = owner_id
    db_project = models.Project(**project_dict)
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

def get_all_projects(db: Session):
    return db.query(models.Project).filter(models.Project.is_active == True).all()

def get_all_users(db: Session):
    return db.query(models.User).filter(models.User.is_active == True).all()

def get_user_by_id(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_project_by_id(db: Session, project_id: int):
    return db.query(models.Project).filter(models.Project.id == project_id).first()
