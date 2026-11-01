
"""Truy xuất dữ liệu dự án có kiểm soát quyền cho AI Agent."""

from collections import defaultdict
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Project, ProjectMember, Task, User
from project_groups import ProjectGroup, GroupMember
from group_kanban import GroupTask, Subtask

from ai.services.permission_service import (
    get_project_ai_permissions,
)


def serialize_datetime(value):
    """Chuyển datetime thành chuỗi ISO."""
    return value.isoformat() if value else None


async def build_project_context(
    db: AsyncSession,
    project_id: UUID,
    user_id: UUID,
) -> dict:
    """
    Tạo context dữ liệu dự án cho AI.

    Quy tắc:
    - Chỉ thành viên dự án mới được truy cập.
    - Tất cả thành viên nhìn thấy tất cả nhóm.
    - Tất cả thành viên nhìn thấy tất cả thành viên dự án.
    - Tất cả thành viên nhìn thấy tất cả Task.
    - Tất cả thành viên nhìn thấy Subtask thuộc các nhóm trong dự án.
    - Không tạo hoặc cập nhật dữ liệu database.
    """

    # 1. Kiểm tra quyền truy cập dự án.
    permissions = await get_project_ai_permissions(
        db=db,
        project_id=project_id,
        user_id=user_id,
    )

    project = await db.get(Project, project_id)

    if project is None:
        return {"error": "Không tìm thấy dự án"}

    project_data = {
        "id": str(project.id),
        "name": project.name,
        "description": project.description,
        "status": project.status,
        "start_date": serialize_datetime(project.start_date),
        "end_date": serialize_datetime(project.end_date),
    }

    # 2. Lấy tất cả nhóm thuộc dự án.
    groups_result = await db.execute(
        select(ProjectGroup).where(
            ProjectGroup.project_id == project_id
        )
    )

    all_groups = groups_result.scalars().all()

    all_group_ids = {
        group.id for group in all_groups
    }

    # Tất cả thành viên dự án được xem tất cả nhóm.
    accessible_group_ids = all_group_ids

    # 3. Truy xuất thông tin tất cả nhóm và thành viên từng nhóm.
    groups_data = []

    for group in all_groups:
        group_member_result = await db.execute(
            select(User)
            .join(
                GroupMember,
                GroupMember.user_id == User.id,
            )
            .where(
                GroupMember.group_id == group.id
            )
            .order_by(User.name.asc())
        )

        group_members = group_member_result.scalars().all()

        members_data = [
            {
                "id": str(user.id),
                "name": user.name,
            }
            for user in group_members
        ]

        groups_data.append({
            "id": str(group.id),
            "name": group.name,
            "leader_id": (
                str(group.leader_id)
                if group.leader_id else None
            ),
            "members": members_data,
        })

    # 4. Truy xuất tất cả thành viên thuộc dự án.
    member_result = await db.execute(
        select(User, ProjectMember.role)
        .join(
            ProjectMember,
            ProjectMember.user_id == User.id,
        )
        .where(
            ProjectMember.project_id == project_id
        )
        .order_by(User.name.asc())
    )

    members = [
        {
            "id": str(user.id),
            "name": user.name,
            "role": role,
        }
        for user, role in member_result.all()
    ]

    # 5. Lấy liên kết Task - Group trong dự án.
    links_result = await db.execute(
        select(GroupTask)
        .join(
            ProjectGroup,
            ProjectGroup.id == GroupTask.group_id,
        )
        .where(
            ProjectGroup.project_id == project_id
        )
    )

    # Một Task có thể liên kết với nhiều nhóm.
    task_group_map = defaultdict(set)

    for link in links_result.scalars().all():
        task_group_map[link.task_id].add(link.group_id)

    # 6. Truy xuất tất cả Task thuộc dự án.
    task_result = await db.execute(
        select(Task)
        .where(
            Task.project_id == project_id
        )
        .order_by(Task.created_at.desc())
    )

    all_tasks = task_result.scalars().all()

    tasks_data = []

    for task in all_tasks:
        assigned_group_ids = task_group_map.get(
            task.id,
            set(),
        )

        tasks_data.append({
            "id": str(task.id),
            "title": task.title,
            "description": task.description,
            "status": task.status,
            "priority": task.priority,
            "deadline": serialize_datetime(task.deadline),
            "assignee": task.assignee,
            "group_ids": [
                str(group_id)
                for group_id in assigned_group_ids
            ],
        })

    # 7. Truy xuất tất cả Subtask thuộc các nhóm trong dự án.
    subtasks_data = []

    if accessible_group_ids:
        subtask_result = await db.execute(
            select(Subtask)
            .where(
                Subtask.group_id.in_(
                    accessible_group_ids
                )
            )
            .order_by(Subtask.created_at.asc())
        )

        subtasks = subtask_result.scalars().all()

        for subtask in subtasks:
            assignee = None

            if subtask.assignee_id:
                assignee = await db.get(
                    User,
                    subtask.assignee_id,
                )

            subtasks_data.append({
                "id": str(subtask.id),
                "group_id": str(subtask.group_id),
                "task_id": str(subtask.task_id),
                "title": subtask.title,
                "description": subtask.description,
                "status": subtask.status,
                "priority": subtask.priority,
                "assignee_id": (
                    str(subtask.assignee_id)
                    if subtask.assignee_id else None
                ),
                "assignee_name": (
                    assignee.name if assignee else None
                ),
            })

    # 8. Trả về toàn bộ context cho AI.
    return {
        "project": project_data,

        "current_user": {
            "id": str(user_id),
            "role": permissions["project_role"],
            "is_owner": permissions["is_owner"],
        },

        "members": members,
        "groups": groups_data,
        "tasks": tasks_data,
        "subtasks": subtasks_data,

        "access_scope": {
            "accessible_group_ids": [
                str(group_id)
                for group_id in accessible_group_ids
            ],
        },
    }
