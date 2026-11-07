
"""
DevTask: API quản lý nhóm dự án.

Chức năng:
- Tạo và xem danh sách nhóm.
- Phân công trưởng nhóm.
- Thêm và xóa thành viên.
- Xóa nhóm.
- Kiểm tra quyền Owner và Leader.
- Trả về Name Tag của thành viên để phục vụ trang tổng quan nhóm
  và chức năng mời thành viên bằng Name Tag.

Import và include_router trong main.py.
"""

import uuid

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from sqlalchemy import (
    ForeignKey,
    String,
    DateTime,
    UniqueConstraint,
    select,
    func,
)

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.ext.asyncio import AsyncSession

from database import Base, get_db
from models import User, Project, ProjectMember
from auth_deps import get_current_user


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/api/projects/{project_id}/groups",
    tags=["Project groups"],
)


# ============================================================
# DATABASE MODELS
# ============================================================

class ProjectGroup(Base):
    __tablename__ = "project_groups"

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

    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    leader_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )


class GroupMember(Base):
    __tablename__ = "group_members"

    __table_args__ = (
        UniqueConstraint(
            "group_id",
            "user_id",
            name="uq_group_member",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_groups.id", ondelete="CASCADE"),
        nullable=False,
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )


# ============================================================
# PYDANTIC SCHEMAS
# ============================================================

class GroupCreate(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=255,
    )


class GroupLeaderUpdate(BaseModel):
    user_id: Optional[uuid.UUID] = None


class GroupMemberAdd(BaseModel):
    user_id: uuid.UUID


# ============================================================
# MEMBERSHIP HELPERS
# ============================================================

async def membership(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
):
    """
    Lấy thông tin thành viên trong dự án.
    """

    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )

    return result.scalar_one_or_none()


async def require_member(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
):
    """
    Kiểm tra người dùng có thuộc dự án hay không.
    """

    member = await membership(
        db,
        project_id,
        user_id,
    )

    if not member:
        raise HTTPException(
            status_code=403,
            detail="Bạn không thuộc dự án",
        )

    return member


async def require_owner(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
):
    """
    Chỉ Owner dự án được thực hiện thao tác dành riêng cho Owner.
    """

    member = await require_member(
        db,
        project_id,
        user_id,
    )

    if member.role != "owner":
        raise HTTPException(
            status_code=403,
            detail="Chỉ chủ dự án được thực hiện",
        )

    return member


# ============================================================
# GROUP HELPERS
# ============================================================

async def get_group(
    db: AsyncSession,
    project_id: uuid.UUID,
    group_id: uuid.UUID,
):
    """
    Lấy nhóm và xác nhận nhóm thuộc đúng dự án.
    """

    group = await db.get(
        ProjectGroup,
        group_id,
    )

    if (
        not group
        or group.project_id != project_id
    ):
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy nhóm",
        )

    return group


async def require_group_manager(
    db: AsyncSession,
    project_id: uuid.UUID,
    group: ProjectGroup,
    user_id: uuid.UUID,
):
    """
    Kiểm tra quyền quản lý thành viên nhóm.

    Người có quyền:
    - Owner dự án.
    - Leader của nhóm.
    """

    member = await require_member(
        db,
        project_id,
        user_id,
    )

    if (
        member.role != "owner"
        and group.leader_id != user_id
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "Chỉ chủ dự án hoặc trưởng nhóm "
                "được quản lý thành viên"
            ),
        )

    return member


# ============================================================
# SERIALIZE GROUP
# ============================================================

async def serialize_group(
    db: AsyncSession,
    group: ProjectGroup,
):
    """
    Chuyển thông tin nhóm thành JSON.

    Bổ sung name_tag cho từng thành viên để:
    - Hiển thị Name Tag tại trang tổng quan nhóm.
    - Hiển thị thông tin thành viên.
    - Hỗ trợ tìm kiếm và đối chiếu tài khoản DevTask.
    """

    # Lấy thông tin Leader.
    leader = (
        await db.get(User, group.leader_id)
        if group.leader_id
        else None
    )

    # Lấy danh sách thành viên.
    result = await db.execute(
        select(User)
        .join(
            GroupMember,
            GroupMember.user_id == User.id,
        )
        .where(
            GroupMember.group_id == group.id
        )
        .order_by(User.name)
    )

    members = result.scalars().all()

    return {
        "id": str(group.id),

        "project_id": str(group.project_id),

        "name": group.name,

        "leader_id": (
            str(group.leader_id)
            if group.leader_id
            else None
        ),

        "leader": (
            leader.name
            if leader
            else None
        ),

        "leaderEmail": (
            leader.email
            if leader
            else None
        ),

        "members": [
            {
                "id": str(user.id),

                "name": user.name,

                "email": user.email,

                # BỔ SUNG: Name Tag của thành viên.
                "name_tag": user.name_tag,

                "status": "accepted",

                "role": (
                    "leader"
                    if user.id == group.leader_id
                    else "member"
                ),
            }
            for user in members
        ],
    }


# ============================================================
# LIST GROUPS
# ============================================================

@router.get("")
async def list_groups(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Lấy danh sách nhóm thuộc dự án.

    Chỉ thành viên dự án mới được xem.
    """

    await require_member(
        db,
        project_id,
        current_user.id,
    )

    result = await db.execute(
        select(ProjectGroup)
        .where(
            ProjectGroup.project_id == project_id
        )
        .order_by(
            ProjectGroup.created_at
        )
    )

    groups = result.scalars().all()

    return [
        await serialize_group(db, group)
        for group in groups
    ]


# ============================================================
# CREATE GROUP
# ============================================================

@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
)
async def create_group(
    project_id: uuid.UUID,
    payload: GroupCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Tạo nhóm mới.

    Chỉ Owner dự án được tạo nhóm.
    """

    await require_owner(
        db,
        project_id,
        current_user.id,
    )

    group_name = payload.name.strip()

    if not group_name:
        raise HTTPException(
            status_code=422,
            detail="Tên nhóm không được trống",
        )

    group = ProjectGroup(
        project_id=project_id,
        name=group_name,
    )

    db.add(group)

    await db.commit()
    await db.refresh(group)

    return await serialize_group(
        db,
        group,
    )


# ============================================================
# SET GROUP LEADER
# ============================================================

@router.put("/{group_id}/leader")
async def set_leader(
    project_id: uuid.UUID,
    group_id: uuid.UUID,
    payload: GroupLeaderUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Thiết lập hoặc thay đổi trưởng nhóm.

    Chỉ Owner dự án được thực hiện.
    Người được chọn làm Leader phải thuộc dự án.
    """

    await require_owner(
        db,
        project_id,
        current_user.id,
    )

    group = await get_group(
        db,
        project_id,
        group_id,
    )

    if payload.user_id:

        # Người được chọn phải thuộc dự án.
        await require_member(
            db,
            project_id,
            payload.user_id,
        )

        # Đảm bảo Leader cũng là thành viên nhóm.
        existing = (
            await db.execute(
                select(GroupMember).where(
                    GroupMember.group_id == group_id,
                    GroupMember.user_id == payload.user_id,
                )
            )
        ).scalar_one_or_none()

        if not existing:
            db.add(
                GroupMember(
                    group_id=group_id,
                    user_id=payload.user_id,
                )
            )

    group.leader_id = payload.user_id

    await db.commit()

    return await serialize_group(
        db,
        group,
    )


# ============================================================
# ADD GROUP MEMBER
# ============================================================

@router.post(
    "/{group_id}/members",
    status_code=status.HTTP_201_CREATED,
)
async def add_member(
    project_id: uuid.UUID,
    group_id: uuid.UUID,
    payload: GroupMemberAdd,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Thêm thành viên vào nhóm.

    Người được thêm phải là thành viên dự án.
    Chỉ Owner dự án hoặc Leader nhóm được thực hiện.

    Đối với tài khoản chưa thuộc dự án:
    sử dụng API mời bằng Name Tag trong notifications.py.
    """

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

    # Không cho thêm tài khoản ngoài dự án
    # bằng API thêm thành viên thông thường.
    await require_member(
        db,
        project_id,
        payload.user_id,
    )

    existing = (
        await db.execute(
            select(GroupMember).where(
                GroupMember.group_id == group_id,
                GroupMember.user_id == payload.user_id,
            )
        )
    ).scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Thành viên đã thuộc nhóm",
        )

    db.add(
        GroupMember(
            group_id=group_id,
            user_id=payload.user_id,
        )
    )

    await db.commit()

    return await serialize_group(
        db,
        group,
    )


# ============================================================
# REMOVE GROUP MEMBER
# ============================================================

@router.delete(
    "/{group_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_member(
    project_id: uuid.UUID,
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Xóa thành viên khỏi nhóm.

    Không cho xóa Leader khi chưa thay đổi Leader.
    Việc xóa khỏi nhóm không đồng nghĩa với xóa khỏi dự án.
    """

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

    if group.leader_id == user_id:
        raise HTTPException(
            status_code=409,
            detail=(
                "Hãy thay đổi trưởng nhóm "
                "trước khi gỡ người này"
            ),
        )

    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
        )
    )

    entry = result.scalar_one_or_none()

    if not entry:
        raise HTTPException(
            status_code=404,
            detail="Thành viên không thuộc nhóm",
        )

    await db.delete(entry)

    await db.commit()

    return None


# ============================================================
# DELETE GROUP
# ============================================================

@router.delete(
    "/{group_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_group(
    project_id: uuid.UUID,
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Xóa nhóm.

    Chỉ Owner dự án được xóa nhóm.
    Các bản ghi GroupMember được xóa trước.
    """

    await require_owner(
        db,
        project_id,
        current_user.id,
    )

    group = await get_group(
        db,
        project_id,
        group_id,
    )

    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id
        )
    )

    members = result.scalars().all()

    for entry in members:
        await db.delete(entry)

    await db.delete(group)

    await db.commit()

    return None
