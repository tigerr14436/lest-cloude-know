
"""
API thông báo cá nhân và lời mời tham gia dự án/nhóm DevTask.

Các loại thông báo:
- task_assigned
- subtask_assigned
- group_invitation
- project_invitation

Lời mời dự án:
- Chỉ chủ dự án được gửi lời mời.
- Người được mời được xác định bằng Name Tag.
- Chấp nhận: thêm vào project_members với role="member".
- Không tự động cấp quyền Leader.
- Từ chối: không thêm vào dự án.

Lời mời nhóm:
- Giữ nguyên chức năng cũ.
- Khi chấp nhận, thêm vào dự án (nếu chưa có) và nhóm.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from sqlalchemy import (
    String,
    Text,
    Boolean,
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

    data: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        default=dict,
    )

    is_read: Mapped[bool] = mapped_column(
        Boolean,
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


class ProjectInvitation(Base):
    """
    Lời mời tham gia dự án.

    Khác GroupInvitation:
    - Không gắn với group_id.
    - Chấp nhận chỉ thêm vào dự án.
    - Vai trò mặc định luôn là member.
    """

    __tablename__ = "project_invitations"

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
# PYDANTIC SCHEMAS
# ============================================================

class InvitationResponse(BaseModel):
    action: Literal["accept", "reject"]


class GroupInvitationCreate(BaseModel):
    project_id: uuid.UUID
    group_id: uuid.UUID
    name_tag: str = Field(
        min_length=4,
        max_length=5,
    )


class ProjectInvitationCreate(BaseModel):
    project_id: uuid.UUID
    name_tag: str = Field(
        min_length=4,
        max_length=5,
    )


# ============================================================
# HELPERS
# ============================================================

def normalize_name_tag(value: str) -> str:
    """
    Chuẩn hóa Name Tag về dạng #ABCD.
    Chấp nhận cả ABCD và #ABCD.
    """

    normalized = (
        value.strip()
        .removeprefix("#")
        .upper()
    )

    if (
        len(normalized) != 4
        or not normalized.isascii()
        or not normalized.isalnum()
    ):
        raise HTTPException(
            status_code=422,
            detail="Name Tag phải có dạng #ABCD",
        )

    return f"#{normalized}"


async def find_user_by_name_tag(
    db: AsyncSession,
    name_tag: str,
) -> User:
    result = await db.execute(
        select(User).where(
            User.name_tag == name_tag
        )
    )

    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy tài khoản với Name Tag này",
        )

    return user


async def is_project_member(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Optional[ProjectMember]:

    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )

    return result.scalar_one_or_none()


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
    Không tự commit.
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

    return {
        "items": [
            serialize_notification(item)
            for item in items
        ],
        "unread_count": unread_result.scalar_one(),
    }


# ============================================================
# CREATE PROJECT INVITATION BY NAME TAG
# ============================================================

@router.post(
    "/project-invitations",
    status_code=201,
)
async def create_project_invitation(
    payload: ProjectInvitationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Chỉ chủ dự án được gửi lời mời tham gia dự án.
    """

    project = await db.get(
        Project,
        payload.project_id,
    )

    if project is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy dự án",
        )

    # Kiểm tra quyền chủ dự án.
    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Chỉ chủ dự án mới được mời thành viên vào dự án",
        )

    name_tag = normalize_name_tag(payload.name_tag)

    invitee = await find_user_by_name_tag(
        db,
        name_tag,
    )

    if invitee.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="Bạn không thể tự mời chính mình",
        )

    # Không mời người đã thuộc dự án.
    existing_member = await is_project_member(
        db,
        project.id,
        invitee.id,
    )

    if existing_member is not None:
        raise HTTPException(
            status_code=409,
            detail="Người dùng đã là thành viên của dự án",
        )

    # Kiểm tra lời mời đang chờ để tránh gửi trùng.
    pending_result = await db.execute(
        select(ProjectInvitation).where(
            ProjectInvitation.project_id == project.id,
            ProjectInvitation.invitee_id == invitee.id,
            ProjectInvitation.status == "pending",
        )
    )

    pending = pending_result.scalar_one_or_none()

    if pending is not None:
        raise HTTPException(
            status_code=409,
            detail="Người dùng đã có lời mời tham gia dự án đang chờ xử lý",
        )

    invitation = ProjectInvitation(
        project_id=project.id,
        inviter_id=current_user.id,
        invitee_id=invitee.id,
        status="pending",
    )

    db.add(invitation)
    await db.flush()

    notification = await create_notification(
        db=db,
        recipient_id=invitee.id,
        notification_type="project_invitation",
        title="Lời mời tham gia dự án",
        message=(
            f'{current_user.name} mời bạn tham gia '
            f'dự án "{project.name}"'
        ),
        data={
            "invitation_id": str(invitation.id),
            "project_id": str(project.id),
            "project_name": project.name,
            "inviter_id": str(current_user.id),
            "inviter_name": current_user.name,
            "invitee_id": str(invitee.id),
            "invitee_name": invitee.name,
            "name_tag": invitee.name_tag,
            "invitation_type": "project",
        },
    )

    invitation.notification_id = notification.id

    await db.commit()
    await db.refresh(invitation)

    return {
        "message": "Đã gửi lời mời tham gia dự án",
        "invitation_id": str(invitation.id),
        "status": invitation.status,
        "invitee": {
            "id": str(invitee.id),
            "name": invitee.name,
            "name_tag": invitee.name_tag,
        },
    }


# ============================================================
# ACCEPT / REJECT PROJECT INVITATION
# ============================================================

@router.post(
    "/project-invitations/{invitation_id}/respond"
)
async def respond_to_project_invitation(
    invitation_id: uuid.UUID,
    payload: InvitationResponse,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Chỉ tài khoản được mời mới có quyền xử lý lời mời.

    Chấp nhận:
    - Thêm ProjectMember.
    - role mặc định = member.
    - Không tự thêm vào nhóm.
    - Không tự cấp Leader.
    """

    result = await db.execute(
        select(ProjectInvitation)
        .where(
            ProjectInvitation.id == invitation_id
        )
        .with_for_update()
    )

    invitation = result.scalar_one_or_none()

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

    project = await db.get(
        Project,
        invitation.project_id,
    )

    if project is None:
        raise HTTPException(
            status_code=404,
            detail="Dự án không còn tồn tại",
        )

    if payload.action == "accept":

        existing_member = await is_project_member(
            db,
            invitation.project_id,
            current_user.id,
        )

        if existing_member is None:
            db.add(
                ProjectMember(
                    project_id=invitation.project_id,
                    user_id=current_user.id,
                    role="member",
                )
            )

        invitation.status = "accepted"

    else:
        invitation.status = "rejected"

    invitation.responded_at = datetime.now(timezone.utc)

    # Đánh dấu thông báo tương ứng đã đọc.
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
            "Bạn đã tham gia dự án với vai trò Member"
            if payload.action == "accept"
            else "Bạn đã từ chối lời mời tham gia dự án"
        ),
        "invitation_id": str(invitation.id),
        "status": invitation.status,
        "project_id": str(invitation.project_id),
        "role": (
            "member"
            if payload.action == "accept"
            else None
        ),
    }


# ============================================================
# CREATE GROUP INVITATION BY NAME TAG
# ============================================================

@router.post(
    "/invitations",
    status_code=201,
)
async def create_group_invitation(
    payload: GroupInvitationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from project_groups import (
        GroupMember,
        get_group,
        require_group_manager,
    )

    name_tag = normalize_name_tag(payload.name_tag)

    group = await get_group(
        db,
        payload.project_id,
        payload.group_id,
    )

    # Chỉ Owner hoặc Leader của nhóm được mời.
    await require_group_manager(
        db,
        payload.project_id,
        group,
        current_user.id,
    )

    project = await db.get(
        Project,
        payload.project_id,
    )

    if project is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy dự án",
        )

    invitee = await find_user_by_name_tag(
        db,
        name_tag,
    )

    if invitee.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="Bạn không thể tự mời chính mình",
        )

    existing_member = (
        await db.execute(
            select(GroupMember).where(
                GroupMember.group_id == group.id,
                GroupMember.user_id == invitee.id,
            )
        )
    ).scalar_one_or_none()

    if existing_member:
        raise HTTPException(
            status_code=409,
            detail="Người dùng đã là thành viên của nhóm",
        )

    pending = (
        await db.execute(
            select(GroupInvitation).where(
                GroupInvitation.project_id == payload.project_id,
                GroupInvitation.group_id == group.id,
                GroupInvitation.invitee_id == invitee.id,
                GroupInvitation.status == "pending",
            )
        )
    ).scalar_one_or_none()

    if pending:
        raise HTTPException(
            status_code=409,
            detail="Người dùng đã có lời mời đang chờ xử lý",
        )

    invitation = GroupInvitation(
        project_id=payload.project_id,
        group_id=group.id,
        inviter_id=current_user.id,
        invitee_id=invitee.id,
        status="pending",
    )

    db.add(invitation)
    await db.flush()

    notification = await create_notification(
        db=db,
        recipient_id=invitee.id,
        notification_type="group_invitation",
        title="Lời mời tham gia nhóm",
        message=(
            f'{current_user.name} mời bạn tham gia nhóm '
            f'"{group.name}" trong dự án "{project.name}"'
        ),
        data={
            "invitation_id": str(invitation.id),
            "project_id": str(project.id),
            "project_name": project.name,
            "group_id": str(group.id),
            "group_name": group.name,
            "inviter_id": str(current_user.id),
            "inviter_name": current_user.name,
            "invitee_id": str(invitee.id),
            "invitee_name": invitee.name,
            "name_tag": invitee.name_tag,
            "invitation_type": "group",
        },
    )

    invitation.notification_id = notification.id

    await db.commit()
    await db.refresh(invitation)

    return {
        "message": "Đã gửi lời mời tham gia nhóm",
        "invitation_id": str(invitation.id),
        "invitee": {
            "id": str(invitee.id),
            "name": invitee.name,
            "name_tag": invitee.name_tag,
        },
        "status": invitation.status,
    }


# ============================================================
# LIST PENDING INVITATIONS OF A GROUP
# ============================================================

@router.get("/invitations")
async def list_group_invitations(
    project_id: uuid.UUID,
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from project_groups import (
        get_group,
        require_group_manager,
    )

    group = await get_group(
        db,
        project_id,
        group_id,
    )

    await require_group_manager(
        db,
        project_id,
        group,
        current_user.id,
    )

    result = await db.execute(
        select(
            GroupInvitation,
            User,
        )
        .join(
            User,
            User.id == GroupInvitation.invitee_id,
        )
        .where(
            GroupInvitation.project_id == project_id,
            GroupInvitation.group_id == group_id,
            GroupInvitation.status == "pending",
        )
        .order_by(
            GroupInvitation.created_at.desc()
        )
    )

    rows = result.all()

    return [
        {
            "id": str(invitation.id),
            "name": user.name,
            "name_tag": user.name_tag,
            "created_at": (
                invitation.created_at.isoformat()
                if invitation.created_at
                else None
            ),
            "status": invitation.status,
        }
        for invitation, user in rows
    ]


# ============================================================
# MARK ONE NOTIFICATION AS READ
# ============================================================

@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await db.get(
        Notification,
        notification_id,
    )

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
    item = await db.get(
        Notification,
        notification_id,
    )

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
# ACCEPT / REJECT GROUP INVITATION
# ============================================================

@router.post("/invitations/{invitation_id}/respond")
async def respond_to_group_invitation(
    invitation_id: uuid.UUID,
    payload: InvitationResponse,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from project_groups import (
        ProjectGroup,
        GroupMember,
    )

    # Khóa bản ghi để tránh hai yêu cầu xử lý cùng một lời mời.
    result = await db.execute(
        select(GroupInvitation)
        .where(
            GroupInvitation.id == invitation_id
        )
        .with_for_update()
    )

    invitation = result.scalar_one_or_none()

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

    project = await db.get(
        Project,
        invitation.project_id,
    )

    group = await db.get(
        ProjectGroup,
        invitation.group_id,
    )

    if project is None:
        raise HTTPException(
            status_code=404,
            detail="Dự án không còn tồn tại",
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

        # Bước 1: thêm vào dự án nếu chưa phải thành viên.
        project_member = await is_project_member(
            db,
            invitation.project_id,
            current_user.id,
        )

        if project_member is None:
            db.add(
                ProjectMember(
                    project_id=invitation.project_id,
                    user_id=current_user.id,
                    role=(
                        "owner"
                        if project.owner_id == current_user.id
                        else "member"
                    ),
                )
            )

        # Bước 2: thêm vào nhóm nếu chưa phải thành viên.
        group_member = (
            await db.execute(
                select(GroupMember).where(
                    GroupMember.group_id == invitation.group_id,
                    GroupMember.user_id == current_user.id,
                )
            )
        ).scalar_one_or_none()

        if group_member is None:
            db.add(
                GroupMember(
                    group_id=invitation.group_id,
                    user_id=current_user.id,
                )
            )

        invitation.status = "accepted"

    else:
        invitation.status = "rejected"

    invitation.responded_at = datetime.now(timezone.utc)

    # Đánh dấu thông báo lời mời đã đọc.
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
            "Bạn đã tham gia dự án và nhóm"
            if payload.action == "accept"
            else "Bạn đã từ chối lời mời"
        ),
        "invitation_id": str(invitation.id),
        "status": invitation.status,
        "project_id": str(invitation.project_id),
        "group_id": str(invitation.group_id),
    }
