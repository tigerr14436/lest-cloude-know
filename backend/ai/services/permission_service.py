"""Kiểm tra quyền truy cập dữ liệu AI trong phạm vi dự án."""

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Project, ProjectMember
from project_groups import ProjectGroup, GroupMember


async def get_project_ai_permissions(
    db: AsyncSession,
    project_id: UUID,
    user_id: UUID,
) -> dict:
    """
    Xác định phạm vi dữ liệu AI mà người dùng được phép đọc.

    Quy tắc:
    - Chỉ người thuộc dự án hoặc chủ sở hữu dự án được truy cập.
    - Owner: xem tất cả nhóm thuộc dự án.
    - Leader: xem nhóm mình quản lý hoặc tham gia.
    - Member: xem nhóm mình tham gia.
    - Không cho phép truy cập nhóm thuộc dự án khác.
    """

    # 1. Kiểm tra dự án tồn tại.
    project = await db.get(Project, project_id)

    if project is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy dự án",
        )

    # 2. Kiểm tra thành viên dự án.
    membership_result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )

    membership = membership_result.scalar_one_or_none()

    # Project.owner_id là nguồn xác định chủ sở hữu thực tế.
    is_owner = project.owner_id == user_id

    if not is_owner and membership is None:
        raise HTTPException(
            status_code=403,
            detail="Bạn không thuộc dự án này",
        )

    # Không chấp nhận bản ghi ProjectMember gán role owner
    # cho tài khoản không phải chủ sở hữu thực tế.
    if (
        membership is not None
        and membership.role == "owner"
        and not is_owner
    ):
        raise HTTPException(
            status_code=403,
            detail="Thông tin quyền Owner không hợp lệ",
        )

    project_role = "owner" if is_owner else membership.role

    # 3. Lấy nhóm thuộc đúng dự án.
    groups_result = await db.execute(
        select(ProjectGroup).where(
            ProjectGroup.project_id == project_id
        )
    )

    groups = groups_result.scalars().all()

    all_group_ids = {
        group.id for group in groups
    }

    # 4. Xác định nhóm được truy cập.
    if is_owner:
        accessible_group_ids = all_group_ids

    elif all_group_ids:
        # Nhóm mà người dùng đã được thêm vào.
        member_group_result = await db.execute(
            select(GroupMember.group_id).where(
                GroupMember.user_id == user_id,
                GroupMember.group_id.in_(all_group_ids),
            )
        )

        accessible_group_ids = set(
            member_group_result.scalars().all()
        )

        # Leader được quyền truy cập nhóm mình quản lý,
        # kể cả khi chưa có bản ghi GroupMember.
        for group in groups:
            if group.leader_id == user_id:
                accessible_group_ids.add(group.id)

    else:
        accessible_group_ids = set()

    return {
        "project_id": project_id,
        "user_id": user_id,
        "is_owner": is_owner,
        "project_role": project_role,
        "accessible_group_ids": sorted(
            accessible_group_ids,
            key=str,
        ),
    }