
"""Kiểm tra quyền truy cập dữ liệu AI trong phạm vi dự án."""

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import ProjectMember
from project_groups import ProjectGroup, GroupMember


async def get_project_ai_permissions(
    db: AsyncSession,
    project_id: UUID,
    user_id: UUID,
) -> dict:
    """
    Xác định phạm vi dữ liệu AI mà user được phép đọc.

    Quy tắc:
    - Owner: xem toàn bộ dữ liệu dự án và tất cả nhóm.
    - Member: xem dữ liệu dự án và dữ liệu các nhóm mình tham gia.
    - Leader: được xem dữ liệu nhóm mình quản lý.
    """

    membership_result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    membership = membership_result.scalar_one_or_none()

    if membership is None:
        raise HTTPException(
            status_code=403,
            detail="Bạn không thuộc dự án này",
        )

    is_owner = membership.role == "owner"

    groups_result = await db.execute(
        select(ProjectGroup).where(
            ProjectGroup.project_id == project_id
        )
    )
    groups = groups_result.scalars().all()

    group_ids = [group.id for group in groups]

    if is_owner:
        accessible_group_ids = group_ids
    else:
        member_group_result = await db.execute(
            select(GroupMember.group_id).where(
                GroupMember.user_id == user_id,
                GroupMember.group_id.in_(group_ids),
            )
        )

        accessible_group_ids = set(
            member_group_result.scalars().all()
        )

        # Bảo vệ trường hợp Leader được gán nhưng chưa có
        # bản ghi GroupMember tương ứng.
        for group in groups:
            if group.leader_id == user_id:
                accessible_group_ids.add(group.id)

        accessible_group_ids = list(accessible_group_ids)

    return {
        "project_id": project_id,
        "user_id": user_id,
        "is_owner": is_owner,
        "project_role": membership.role,
        "accessible_group_ids": accessible_group_ids,
    }
