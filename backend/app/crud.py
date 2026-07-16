from sqlalchemy.orm import Session
from app import models


def get_all_users(db: Session):
    return db.query(models.User).filter(models.User.is_active == True).all()


def get_user_by_id(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()
