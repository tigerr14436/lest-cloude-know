"""Truy xuất dữ liệu dự án có kiểm soát quyền cho AI Agent."""

from collections import defaultdict
from uuid import UUID

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from models import Project, ProjectMember, Task, User
from project_groups import ProjectGroup, GroupMember
from group_kanban import GroupTask, Subtask

from ai.services.permission_service import (
    get_project_ai_permissions,
)


def serialize_datetime(value):
    """Chuyển date hoặc datetime thành chuỗi ISO."""
    return value.isoformat() if value else None


async def build_project_context(
    db: AsyncSession,
    project_id: UUID,
    user_id: UUID,
) -> dict:
    """
    Tạo context dữ liệu dự án cho AI.

    Quy tắc:
    - Chỉ thành viên dự án hoặc Owner thực tế được truy cập.
    - Owner xem tất cả nhóm, Task và Subtask trong dự án.
    - Leader xem nhóm mình quản lý hoặc tham gia.
    - Member xem nhóm mình tham gia và Task được giao cho mình.
    - Thành viên chỉ xem Subtask thuộc nhóm được phép truy cập.
    - Không truy xuất dữ liệu từ dự án khác.
    - Hàm chỉ đọc dữ liệu, không thay đổi Database.
    """

    # =====================================================
    # 1. KIỂM TRA QUYỀN
    # =====================================================

    permissions = await get_project_ai_permissions(
        db=db,
        project_id=project_id,
        user_id=user_id,
    )

    project = await db.get(Project, project_id)

    if project is None:
        return {
            "error": "Không tìm thấy dự án"
        }

    is_owner = permissions["is_owner"]

    accessible_group_ids = set(
        permissions["accessible_group_ids"]
    )

    project_data = {
        "id": str(project.id),
        "name": project.name,
        "description": project.description,
        "status": project.status,
        "start_date": serialize_datetime(
            project.start_date
        ),
        "end_date": serialize_datetime(
            project.end_date
        ),
    }

    # =====================================================
    # 2. LẤY NHÓM TRONG PHẠM VI ĐƯỢC PHÉP
    # =====================================================

    if is_owner:
        groups_result = await db.execute(
            select(ProjectGroup).where(
                ProjectGroup.project_id == project_id
            )
        )

    elif accessible_group_ids:
        groups_result = await db.execute(
            select(ProjectGroup).where(
                ProjectGroup.project_id == project_id,
                ProjectGroup.id.in_(
                    accessible_group_ids
                ),
            )
        )

    else:
        groups_result = None

    accessible_groups = (
        groups_result.scalars().all()
        if groups_result is not None
        else []
    )

    # =====================================================
    # 3. LẤY THÀNH VIÊN CỦA NHỮNG NHÓM ĐƯỢC PHÉP
    # =====================================================

    groups_data = []

    visible_member_ids = {
        user_id
    }

    for group in accessible_groups:

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

        group_members = (
            group_member_result.scalars().all()
        )

        members_data = []

        for user in group_members:
            visible_member_ids.add(user.id)

            members_data.append({
                "id": str(user.id),
                "name": user.name,
            })

        # Leader có thể chưa nằm trong GroupMember.
        leader = None

        if group.leader_id:
            visible_member_ids.add(group.leader_id)

            leader = await db.get(
                User,
                group.leader_id,
            )

        groups_data.append({
            "id": str(group.id),
            "name": group.name,
            "leader_id": (
                str(group.leader_id)
                if group.leader_id
                else None
            ),
            "leader_name": (
                leader.name
                if leader
                else None
            ),
            "members": members_data,
        })

    # =====================================================
    # 4. LẤY DANH SÁCH THÀNH VIÊN
    # =====================================================

    if is_owner:
        member_query = (
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

    else:
        member_query = (
            select(User, ProjectMember.role)
            .join(
                ProjectMember,
                ProjectMember.user_id == User.id,
            )
            .where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id.in_(
                    visible_member_ids
                ),
            )
            .order_by(User.name.asc())
        )

    member_result = await db.execute(
        member_query
    )

    members = [
        {
            "id": str(user.id),
            "name": user.name,
            "role": role,
        }
        for user, role in member_result.all()
    ]

    # =====================================================
    # 5. LẤY LIÊN KẾT TASK - GROUP
    # =====================================================

    task_group_map = defaultdict(set)

    if is_owner:
        links_query = (
            select(GroupTask)
            .join(
                ProjectGroup,
                ProjectGroup.id == GroupTask.group_id,
            )
            .where(
                ProjectGroup.project_id == project_id
            )
        )

    elif accessible_group_ids:
        links_query = (
            select(GroupTask)
            .join(
                ProjectGroup,
                ProjectGroup.id == GroupTask.group_id,
            )
            .where(
                ProjectGroup.project_id == project_id,
                GroupTask.group_id.in_(
                    accessible_group_ids
                ),
            )
        )

    else:
        links_query = None

    if links_query is not None:
        links_result = await db.execute(
            links_query
        )

        for link in links_result.scalars().all():
            task_group_map[link.task_id].add(
                link.group_id
            )

    # =====================================================
    # 6. LẤY TASK THEO QUYỀN
    # =====================================================

    if is_owner:
        task_query = (
            select(Task)
            .where(
                Task.project_id == project_id
            )
        )

    else:
        accessible_task_ids = list(
            task_group_map.keys()
        )

        # Người dùng được xem:
        # - Task thuộc nhóm được truy cập.
        # - Task được giao trực tiếp cho mình.
        conditions = [
            Task.assignee_id == user_id
        ]

        if accessible_task_ids:
            conditions.append(
                Task.id.in_(accessible_task_ids)
            )

        task_query = (
            select(Task)
            .where(
                Task.project_id == project_id,
                or_(*conditions),
            )
        )

    task_result = await db.execute(
        task_query.order_by(
            Task.created_at.desc()
        )
    )

    all_tasks = task_result.scalars().all()

    tasks_data = []

    for task in all_tasks:

        assigned_group_ids = (
            task_group_map.get(task.id, set())
        )

        tasks_data.append({
            "id": str(task.id),
            "title": task.title,
            "description": task.description,
            "status": task.status,
            "priority": task.priority,
            "deadline": serialize_datetime(
                task.deadline
            ),
            "assignee": task.assignee,
            "assignee_id": (
                str(task.assignee_id)
                if task.assignee_id
                else None
            ),
            "group_ids": [
                str(group_id)
                for group_id in assigned_group_ids
            ],
        })

    # =====================================================
    # 7. LẤY SUBTASK THEO NHÓM ĐƯỢC PHÉP
    # =====================================================

    subtasks_data = []

    if accessible_group_ids:

        subtask_result = await db.execute(
            select(Subtask)
            .where(
                Subtask.group_id.in_(
                    accessible_group_ids
                )
            )
            .order_by(
                Subtask.created_at.asc()
            )
        )

        subtasks = (
            subtask_result.scalars().all()
        )

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
                    if subtask.assignee_id
                    else None
                ),
                "assignee_name": (
                    assignee.name
                    if assignee
                    else None
                ),
            })

    # =====================================================
    # 8. TRẢ VỀ CONTEXT CHO AI
    # =====================================================

    return {
        "project": project_data,

        "current_user": {
            "id": str(user_id),
            "role": permissions["project_role"],
            "is_owner": is_owner,
        },

        "members": members,
        "groups": groups_data,
        "tasks": tasks_data,
        "subtasks": subtasks_data,

        "access_scope": {
            "project_id": str(project_id),
            "project_role": permissions["project_role"],
            "is_owner": is_owner,
            "accessible_group_ids": [
                str(group_id)
                for group_id in sorted(
                    accessible_group_ids,
                    key=str,
                )
            ],
        },
    }