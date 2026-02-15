from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import schemas, models, auth
from ..database import get_db
from ..database import get_db

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.get("/{project_id}", response_model=list[schemas.ChatMessageResponse])
def list_messages(
    project_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    # Permit chat if user liked the project (or is owner)
    liked = (
        db.query(models.Swipe)
        .filter(
            models.Swipe.user_id == current_user.id,
            models.Swipe.project_id == project_id,
            models.Swipe.is_like == True,
            models.Swipe.approved_by_owner == True,
        )
        .first()
    )
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not (liked or (project and project.owner_id == current_user.id)):
        raise HTTPException(status_code=403, detail="Not permitted")

    return (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.project_id == project_id)
        .order_by(models.ChatMessage.created_at.asc())
        .all()
    )


@router.get("/notifications/{user_id}", response_model=list[dict])
def get_message_notifications(
    user_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get projects where user has unread messages
    notifications = []

    # Get projects owned by user that have new messages
    owned_projects = (
        db.query(models.Project).filter(models.Project.owner_id == user_id).all()
    )
    for project in owned_projects:
        # Count messages not from the owner
        msg_count = (
            db.query(models.ChatMessage)
            .filter(
                models.ChatMessage.project_id == project.id,
                models.ChatMessage.from_user_id != user_id,
            )
            .count()
        )

        if msg_count > 0:
            notifications.append(
                {
                    "project_id": project.id,
                    "project_title": project.title,
                    "message_count": msg_count,
                    "type": "owner",
                }
            )

    # Get projects user liked that have new messages from owner
    liked_projects = (
        db.query(models.Project)
        .join(models.Swipe, models.Project.id == models.Swipe.project_id)
        .filter(
            models.Swipe.user_id == user_id,
            models.Swipe.is_like == True,
            models.Swipe.approved_by_owner == True,
        )
        .all()
    )

    for project in liked_projects:
        # Count messages from the project owner
        msg_count = (
            db.query(models.ChatMessage)
            .filter(
                models.ChatMessage.project_id == project.id,
                models.ChatMessage.from_user_id == project.owner_id,
            )
            .count()
        )

        if msg_count > 0:
            notifications.append(
                {
                    "project_id": project.id,
                    "project_title": project.title,
                    "message_count": msg_count,
                    "type": "liker",
                }
            )

    return notifications


@router.post("/", response_model=schemas.ChatMessageResponse)
def send_message(
    msg: schemas.ChatMessageCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    project = (
        db.query(models.Project).filter(models.Project.id == msg.project_id).first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # same permission rule as above
    liked = (
        db.query(models.Swipe)
        .filter(
            models.Swipe.user_id == current_user.id,
            models.Swipe.project_id == msg.project_id,
            models.Swipe.is_like == True,
            models.Swipe.approved_by_owner == True,
        )
        .first()
    )
    if not (liked or project.owner_id == current_user.id):
        raise HTTPException(status_code=403, detail="Not permitted")

    # Monitor the message with Gemini
    # DISABLED: Too strict for initial greetings and conversation starters
    # Users should be able to say "hi" or start conversations naturally
    # try:
    #     monitoring_result = monitor_chat_message(
    #         msg.content,
    #         project.title,
    #         project.summary or ""
    #     )
    #
    #     # If message is not project-related, return a warning
    #     if not monitoring_result.get("is_project_related", True):
    #         warning = monitoring_result.get("warning", "")
    #         suggestion = monitoring_result.get("suggestion", "")
    #         raise HTTPException(
    #             status_code=400,
    #             detail=f"Message not project-related. {warning} {suggestion}".strip()
    #         )
    # except HTTPException:
    #     raise
    # except Exception as e:
    #     print(f"Chat monitoring failed: {e}")
    #     # Continue with message if monitoring fails

    db_msg = models.ChatMessage(
        project_id=msg.project_id,
        from_user_id=current_user.id,
        to_user_id=msg.to_user_id,
        content=msg.content,
    )
    db.add(db_msg)
    db.commit()
    db.refresh(db_msg)
    return db_msg


@router.post("/{project_id}/mark-read")
def mark_messages_read(
    project_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """Mark all messages in a project as read for the current user"""
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check permission
    liked = (
        db.query(models.Swipe)
        .filter(
            models.Swipe.user_id == current_user.id,
            models.Swipe.project_id == project_id,
            models.Swipe.is_like == True,
            models.Swipe.approved_by_owner == True,
        )
        .first()
    )
    if not (liked or project.owner_id == current_user.id):
        raise HTTPException(status_code=403, detail="Not permitted")

    # For now, we'll just return success since we don't have a read status field
    # In a real implementation, you'd update a read status field
    return {"status": "success", "message": "Messages marked as read"}
