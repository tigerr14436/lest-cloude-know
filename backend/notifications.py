
"""API thông báo cá nhân và lời mời tham gia nhóm DevTask."""

import uuid
from datetime import datetime
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import (
    String,
    Text,
    DateTime,
    ForeignKey,
    JSON,
    select,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.ext.asyncio import AsyncSession

from database import Base, get_db
from models import User, Project, ProjectMember
from auth_deps import get_current_user


router = APIRouter(
    prefix="/api/notifications",
    tags=["Notifications"],
)


# ============================================================
# DATABASE MODELS
# ============================================================

class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    recipient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    notification_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    # Dữ liệu điều hướng: project_id, task_id, subtask_id...
    data: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        default=dict,
    )

    is_read: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class GroupInvitation(Base):
    __tablename__ = "group_invitations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    inviter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    invitee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="pending",
        index=True,
    )

    notification_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notifications.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    responded_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )


# ============================================================
# HELPERS
# ============================================================

async def create_notification(
    db: AsyncSession,
    recipient_id: uuid.UUID,
    notification_type: str,
    title: str,
    message: str,
    data: Optional[dict] = None,
):
    """
    Tạo thông báo trong transaction hiện tại.
    Hàm này không tự commit để API gọi có thể
    lưu dữ liệu nghiệp vụ và thông báo cùng nhau.
    """

    if recipient_id is None:
        return None

    notification = Notification(
        recipient_id=recipient_id,
        notification_type=notification_type,
        title=title,
        message=message,
        data=data or {},
        is_read=False,
    )

    db.add(notification)
    await db.flush()

    return notification


def serialize_notification(item: Notification):
    return {
        "id": str(item.id),
        "type": item.notification_type,
        "title": item.title,
        "message": item.message,
        "data": item.data or {},
        "is_read": item.is_read,
        "created_at": (
            item.created_at.isoformat()
            if item.created_at
            else None
        ),
    }


# ============================================================
# LIST NOTIFICATIONS
# ============================================================

@router.get("")
async def list_notifications(
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification)
        .where(
            Notification.recipient_id == current_user.id
        )
        .order_by(
            Notification.created_at.desc()
        )
        .limit(limit)
    )

    items = result.scalars().all()

    unread_result = await db.execute(
        select(func.count())
        .select_from(Notification)
        .where(
            Notification.recipient_id == current_user.id,
            Notification.is_read.is_(False),
        )
    )

    unread_count = unread_result.scalar_one()

    return {
        "items": [
            serialize_notification(item)
            for item in items
        ],
        "unread_count": unread_count,
    }


# ============================================================
# MARK ONE NOTIFICATION AS READ
# ============================================================

@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await db.get(Notification, notification_id)

    if (
        item is None
        or item.recipient_id != current_user.id
    ):
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy thông báo",
        )

    item.is_read = True

    await db.commit()

    return {
        "message": "Đã đánh dấu thông báo đã đọc",
        "id": str(item.id),
    }


# ============================================================
# MARK ALL AS READ
# ============================================================

@router.patch("/read-all")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(
            Notification.recipient_id == current_user.id,
            Notification.is_read.is_(False),
        )
    )

    items = result.scalars().all()

    for item in items:
        item.is_read = True

    await db.commit()

    return {
        "message": "Đã đánh dấu tất cả thông báo đã đọc",
        "updated": len(items),
    }


# ============================================================
# DELETE NOTIFICATION
# ============================================================

@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await db.get(Notification, notification_id)

    if (
        item is None
        or item.recipient_id != current_user.id
    ):
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy thông báo",
        )

    await db.delete(item)
    await db.commit()

    return {
        "message": "Đã xóa thông báo",
    }


# ============================================================
# RESPOND TO GROUP INVITATION
# ============================================================

class InvitationResponse(BaseModel):
    action: Literal["accept", "reject"]


@router.post("/invitations/{invitation_id}/respond")
async def respond_to_invitation(
    invitation_id: uuid.UUID,
    payload: InvitationResponse,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Import tại thời điểm gọi để tránh vòng lặp import.
    from project_groups import (
        ProjectGroup,
        GroupMember,
        require_member,
    )

    invitation = await db.get(
        GroupInvitation,
        invitation_id,
    )

    if (
        invitation is None
        or invitation.invitee_id != current_user.id
    ):
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy lời mời",
        )

    if invitation.status != "pending":
        raise HTTPException(
            status_code=409,
            detail="Lời mời này đã được xử lý",
        )

    # Người nhận phải vẫn thuộc dự án.
    await require_member(
        db,
        invitation.project_id,
        current_user.id,
    )

    group = await db.get(
        ProjectGroup,
        invitation.group_id,
    )

    if (
        group is None
        or group.project_id != invitation.project_id
    ):
        raise HTTPException(
            status_code=404,
            detail="Nhóm không còn tồn tại",
        )

    if payload.action == "accept":
        existing = (
            await db.execute(
                select(GroupMember).where(
                    GroupMember.group_id == invitation.group_id,
                    GroupMember.user_id == current_user.id,
                )
            )
        ).scalar_one_or_none()

        if existing is None:
            db.add(
                GroupMember(
                    group_id=invitation.group_id,
                    user_id=current_user.id,
                )
            )

        invitation.status = "accepted"

    else:
        invitation.status = "rejected"

    invitation.responded_at = datetime.now().astimezone()

    if invitation.notification_id:
        notification = await db.get(
            Notification,
            invitation.notification_id,
        )

        if (
            notification is not None
            and notification.recipient_id == current_user.id
        ):
            notification.is_read = True

    await db.commit()

    return {
        "message": (
            "Bạn đã tham gia nhóm"
            if payload.action == "accept"
            else "Bạn đã từ chối lời mời"
        ),
        "invitation_id": str(invitation.id),
        "status": invitation.status,
        "group_id": str(invitation.group_id),
    }
