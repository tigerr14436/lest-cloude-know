"""Thực thi các đề xuất đã được Owner AI phê duyệt."""

import uuid
from datetime import date, datetime, time, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import (
    User,
    Project,
    ProjectMember,
    Task,
    ALLOWED_STATUS,
    ALLOWED_PRIORITY,
)

from project_groups import (
    ProjectGroup,
    GroupMember,
)

from group_kanban import GroupTask

from notifications import (
    ProjectInvitation,
    create_notification,
    find_user_by_email,
    find_user_by_name_tag,
    is_project_member,
    normalize_name_tag,
)

from ai.owner_models import OwnerAIActionProposal


class OwnerAIActionExecutor:
    """
    Chỉ thực thi đề xuất đã được Owner phê duyệt.

    Lưu ý:
    - Không tự commit transaction.
    - Router chịu trách nhiệm commit hoặc rollback.
    - Luôn kiểm tra lại Project.owner_id.
    - Không tin payload chỉ vì AI đã validation trước đó.
    """

    ALLOWED_ACTIONS = {
        "task_create",
        "task_update",
        "group_create",
        "group_update",
        "member_invite",
        "weekly_schedule_create",
    }

    def __init__(self, db: AsyncSession):
        self.db = db

    # =====================================================
    # COMMON VALIDATION
    # =====================================================

    @staticmethod
    def _uuid(value: Any, field_name: str) -> uuid.UUID:
        try:
            return uuid.UUID(str(value))
        except (ValueError, TypeError, AttributeError) as exc:
            raise ValueError(
                f"{field_name} không phải UUID hợp lệ."
            ) from exc

    @staticmethod
    def _text(
        value: Any,
        field_name: str,
        max_length: int = 255,
    ) -> str:
        if not isinstance(value, str):
            raise ValueError(f"{field_name} phải là chuỗi.")

        value = value.strip()

        if not value:
            raise ValueError(f"{field_name} không được để trống.")

        if len(value) > max_length:
            raise ValueError(
                f"{field_name} không được vượt quá "
                f"{max_length} ký tự."
            )

        return value

    @staticmethod
    def _deadline(value: Any) -> datetime | None:
        """
        Task.deadline là DateTime(timezone=True).

        Payload AI sử dụng YYYY-MM-DD.
        Quy ước ngày deadline là cuối ngày UTC.
        """

        if value is None:
            return None

        if isinstance(value, datetime):
            if value.tzinfo is None:
                raise ValueError(
                    "Deadline phải có thông tin múi giờ."
                )
            return value

        if not isinstance(value, str):
            raise ValueError("Deadline phải có dạng YYYY-MM-DD.")

        try:
            parsed = date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError(
                "Deadline không đúng định dạng YYYY-MM-DD."
            ) from exc

        return datetime.combine(
            parsed,
            time.max,
            tzinfo=timezone.utc,
        )

    async def _require_owner(
        self,
        project_id: uuid.UUID,
        owner_id: uuid.UUID,
    ) -> Project:
        project = await self.db.get(Project, project_id)

        if project is None:
            raise HTTPException(
                status_code=404,
                detail="Không tìm thấy dự án.",
            )

        if project.owner_id != owner_id:
            raise HTTPException(
                status_code=403,
                detail="Bạn không còn là chủ sở hữu dự án.",
            )

        return project

    async def _require_project_member(
        self,
        project_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> tuple[ProjectMember, User]:
        result = await self.db.execute(
            select(ProjectMember, User)
            .join(User, User.id == ProjectMember.user_id)
            .where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user_id,
            )
        )

        row = result.one_or_none()

        if row is None:
            raise ValueError(
                "Người dùng không còn thuộc dự án."
            )

        return row[0], row[1]

    async def _require_group(
        self,
        project_id: uuid.UUID,
        group_id: uuid.UUID,
    ) -> ProjectGroup:
        group = await self.db.get(ProjectGroup, group_id)

        if group is None or group.project_id != project_id:
            raise ValueError(
                "Nhóm không tồn tại trong dự án hiện tại."
            )

        return group

    # =====================================================
    # NOTIFICATION
    # =====================================================

    async def _notify_task_assignee(
        self,
        project: Project,
        owner: User,
        task: Task,
        assignee: User | None,
    ):
        if assignee is None or assignee.id == owner.id:
            return

        await create_notification(
            db=self.db,
            recipient_id=assignee.id,
            notification_type="task_assigned",
            title="Bạn được giao một Task mới",
            message=(
                f'{owner.name} đã giao cho bạn Task '
                f'"{task.title}"'
            ),
            data={
                "project_id": str(project.id),
                "task_id": str(task.id),
                "assignee_id": str(assignee.id),
                "assigned_by_id": str(owner.id),
                "assigned_by_name": owner.name,
                "project_name": project.name,
                "task_title": task.title,
            },
        )

    # =====================================================
    # TASK CREATE
    # =====================================================

    async def _create_task(
        self,
        project: Project,
        owner: User,
        payload: dict,
    ) -> Task:
        if not isinstance(payload, dict):
            raise ValueError("Payload tạo Task không hợp lệ.")

        allowed = {
            "title",
            "description",
            "priority",
            "deadline",
            "assignee_id",
            "group_id",
        }

        if set(payload) - allowed:
            raise ValueError(
                "Payload tạo Task chứa trường không được hỗ trợ."
            )

        title = self._text(payload.get("title"), "title")

        description = payload.get("description")

        if description is not None and not isinstance(
            description, str
        ):
            raise ValueError("Description không hợp lệ.")

        priority = payload.get("priority", "medium")

        if priority not in ALLOWED_PRIORITY:
            raise ValueError("Priority không hợp lệ.")

        assignee = None
        assignee_id = None

        if payload.get("assignee_id") is not None:
            assignee_id = self._uuid(
                payload["assignee_id"],
                "assignee_id",
            )

            _, assignee = await self._require_project_member(
                project.id,
                assignee_id,
            )

        group = None

        if payload.get("group_id") is not None:
            group_id = self._uuid(
                payload["group_id"],
                "group_id",
            )

            group = await self._require_group(
                project.id,
                group_id,
            )

        task = Task(
            project_id=project.id,
            title=title,
            description=description,
            status="todo",
            priority=priority,
            deadline=self._deadline(payload.get("deadline")),
            assignee_id=assignee.id if assignee else None,
            assignee=assignee.name if assignee else None,
        )

        self.db.add(task)
        await self.db.flush()

        # Một Task chỉ được liên kết với một Group.
        if group is not None:
            existing_link = await self.db.execute(
                select(GroupTask).where(
                    GroupTask.task_id == task.id
                )
            )

            if existing_link.scalar_one_or_none() is not None:
                raise ValueError(
                    "Task đã được liên kết với một nhóm khác."
                )

            self.db.add(
                GroupTask(
                    group_id=group.id,
                    task_id=task.id,
                )
            )

        await self._notify_task_assignee(
            project,
            owner,
            task,
            assignee,
        )

        await self.db.flush()
        return task

    # =====================================================
    # TASK UPDATE
    # =====================================================

    async def _update_task(
        self,
        project: Project,
        owner: User,
        payload: dict,
    ) -> Task:
        if not isinstance(payload, dict):
            raise ValueError("Payload cập nhật Task không hợp lệ.")

        task_id = self._uuid(
            payload.get("task_id"),
            "task_id",
        )

        result = await self.db.execute(
            select(Task)
            .where(
                Task.id == task_id,
                Task.project_id == project.id,
            )
            .with_for_update()
        )

        task = result.scalar_one_or_none()

        if task is None:
            raise ValueError(
                "Task không tồn tại trong dự án hiện tại."
            )

        updates = payload.get("updates")

        if not isinstance(updates, dict) or not updates:
            raise ValueError("Không có dữ liệu cập nhật Task.")

        allowed = {
            "title",
            "description",
            "status",
            "priority",
            "deadline",
            "assignee_id",
        }

        if set(updates) - allowed:
            raise ValueError(
                "Payload cập nhật Task chứa trường không được hỗ trợ."
            )

        old_assignee_id = task.assignee_id
        new_assignee = None

        if "title" in updates:
            task.title = self._text(
                updates["title"],
                "title",
            )

        if "description" in updates:
            description = updates["description"]

            if description is not None and not isinstance(
                description, str
            ):
                raise ValueError("Description không hợp lệ.")

            task.description = description

        if "status" in updates:
            if updates["status"] not in ALLOWED_STATUS:
                raise ValueError("Status không hợp lệ.")

            task.status = updates["status"]

        if "priority" in updates:
            if updates["priority"] not in ALLOWED_PRIORITY:
                raise ValueError("Priority không hợp lệ.")

            task.priority = updates["priority"]

        if "deadline" in updates:
            task.deadline = self._deadline(
                updates["deadline"]
            )

        if "assignee_id" in updates:
            new_id = updates["assignee_id"]

            if new_id is None:
                task.assignee_id = None
                task.assignee = None
            else:
                new_id = self._uuid(
                    new_id,
                    "assignee_id",
                )

                _, new_assignee = await self._require_project_member(
                    project.id,
                    new_id,
                )

                task.assignee_id = new_assignee.id
                task.assignee = new_assignee.name

        await self.db.flush()

        if (
            new_assignee is not None
            and new_assignee.id != old_assignee_id
        ):
            await self._notify_task_assignee(
                project,
                owner,
                task,
                new_assignee,
            )

        await self.db.flush()
        return task

    # =====================================================
    # GROUP CREATE
    # =====================================================

    async def _create_group(
        self,
        project: Project,
        payload: dict,
    ) -> ProjectGroup:
        if not isinstance(payload, dict):
            raise ValueError("Payload tạo Group không hợp lệ.")

        if set(payload) - {"name", "leader_id"}:
            raise ValueError(
                "Payload tạo Group chứa trường không được hỗ trợ."
            )

        name = self._text(payload.get("name"), "name")

        leader = None

        if payload.get("leader_id") is not None:
            leader_id = self._uuid(
                payload["leader_id"],
                "leader_id",
            )

            _, leader = await self._require_project_member(
                project.id,
                leader_id,
            )

        group = ProjectGroup(
            project_id=project.id,
            name=name,
            leader_id=leader.id if leader else None,
        )

        self.db.add(group)
        await self.db.flush()

        # Leader phải đồng thời là GroupMember.
        if leader is not None:
            self.db.add(
                GroupMember(
                    group_id=group.id,
                    user_id=leader.id,
                )
            )

        await self.db.flush()
        return group

    # =====================================================
    # GROUP UPDATE
    # =====================================================

    async def _update_group(
        self,
        project: Project,
        payload: dict,
    ) -> ProjectGroup:
        if not isinstance(payload, dict):
            raise ValueError("Payload cập nhật Group không hợp lệ.")

        group_id = self._uuid(
            payload.get("group_id"),
            "group_id",
        )

        group = await self._require_group(
            project.id,
            group_id,
        )

        updates = payload.get("updates")

        if not isinstance(updates, dict) or not updates:
            raise ValueError("Không có dữ liệu cập nhật Group.")

        if set(updates) - {"name", "leader_id"}:
            raise ValueError(
                "Payload cập nhật Group chứa trường không được hỗ trợ."
            )

        if "name" in updates:
            group.name = self._text(
                updates["name"],
                "name",
            )

        if "leader_id" in updates:
            leader_id = updates["leader_id"]

            if leader_id is None:
                group.leader_id = None
            else:
                leader_id = self._uuid(
                    leader_id,
                    "leader_id",
                )

                _, leader = await self._require_project_member(
                    project.id,
                    leader_id,
                )

                group.leader_id = leader.id

                existing = await self.db.execute(
                    select(GroupMember).where(
                        GroupMember.group_id == group.id,
                        GroupMember.user_id == leader.id,
                    )
                )

                if existing.scalar_one_or_none() is None:
                    self.db.add(
                        GroupMember(
                            group_id=group.id,
                            user_id=leader.id,
                        )
                    )

        await self.db.flush()
        return group

    # =====================================================
    # MEMBER INVITE
    # =====================================================

    async def _invite_member(
        self,
        project: Project,
        owner: User,
        payload: dict,
    ) -> dict:
        if not isinstance(payload, dict):
            raise ValueError("Payload mời thành viên không hợp lệ.")

        if set(payload) - {"email", "name_tag", "role"}:
            raise ValueError(
                "Payload mời thành viên chứa trường không được hỗ trợ."
            )

        if payload.get("role", "member") != "member":
            raise ValueError(
                "Người được mời chỉ có thể nhận vai trò Member."
            )

        email = payload.get("email")
        name_tag = payload.get("name_tag")

        has_email = isinstance(email, str) and bool(email.strip())
        has_name_tag = (
            isinstance(name_tag, str)
            and bool(name_tag.strip())
        )

        if has_email == has_name_tag:
            raise ValueError(
                "Phải cung cấp chính xác một trong hai: email hoặc Name Tag."
            )

        if has_name_tag:
            normalized_tag = normalize_name_tag(name_tag)
            invitee = await find_user_by_name_tag(
                self.db,
                normalized_tag,
            )
        else:
            invitee = await find_user_by_email(
                self.db,
                email,
            )

        if invitee.id == owner.id:
            raise ValueError(
                "Không thể mời chính chủ dự án."
            )

        existing_member = await is_project_member(
            self.db,
            project.id,
            invitee.id,
        )

        if existing_member is not None:
            raise ValueError(
                "Người dùng đã là thành viên của dự án."
            )

        pending_result = await self.db.execute(
            select(ProjectInvitation).where(
                ProjectInvitation.project_id == project.id,
                ProjectInvitation.invitee_id == invitee.id,
                ProjectInvitation.status == "pending",
            )
        )

        if pending_result.scalar_one_or_none() is not None:
            raise ValueError(
                "Người dùng đã có lời mời tham gia dự án đang chờ."
            )

        invitation = ProjectInvitation(
            project_id=project.id,
            inviter_id=owner.id,
            invitee_id=invitee.id,
            status="pending",
        )

        self.db.add(invitation)
        await self.db.flush()

        notification = await create_notification(
            db=self.db,
            recipient_id=invitee.id,
            notification_type="project_invitation",
            title="Lời mời tham gia dự án",
            message=(
                f'{owner.name} mời bạn tham gia '
                f'dự án "{project.name}"'
            ),
            data={
                "invitation_id": str(invitation.id),
                "project_id": str(project.id),
                "project_name": project.name,
                "inviter_id": str(owner.id),
                "inviter_name": owner.name,
                "invitee_id": str(invitee.id),
                "invitee_name": invitee.name,
                "name_tag": invitee.name_tag,
                "invitation_type": "project",
            },
        )

        invitation.notification_id = notification.id

        await self.db.flush()

        return {
            "invitation_id": str(invitation.id),
            "status": invitation.status,
            "invitee": {
                "id": str(invitee.id),
                "name": invitee.name,
                "name_tag": invitee.name_tag,
                "email": invitee.email,
            },
        }

    # =====================================================
    # WEEKLY TASK BATCH
    # =====================================================

    async def _create_weekly_tasks(
        self,
        project: Project,
        owner: User,
        payload: dict,
    ) -> dict:
        if not isinstance(payload, dict):
            raise ValueError("Payload kế hoạch tuần không hợp lệ.")

        start_date = payload.get("start_date")
        end_date = payload.get("end_date")
        tasks = payload.get("tasks")

        try:
            start = date.fromisoformat(start_date)
            end = date.fromisoformat(end_date)
        except (ValueError, TypeError) as exc:
            raise ValueError(
                "Ngày kế hoạch phải có dạng YYYY-MM-DD."
            ) from exc

        if end < start:
            raise ValueError(
                "Ngày kết thúc không được trước ngày bắt đầu."
            )

        if not isinstance(tasks, list) or not tasks:
            raise ValueError(
                "Kế hoạch phải có ít nhất một Task."
            )

        if len(tasks) > 30:
            raise ValueError(
                "Một kế hoạch không được vượt quá 30 Task."
            )

        created = []

        for index, item in enumerate(tasks, start=1):
            if not isinstance(item, dict):
                raise ValueError(
                    f"Task thứ {index} không hợp lệ."
                )

            task = await self._create_task(
                project,
                owner,
                item,
            )

            created.append({
                "task_id": str(task.id),
                "title": task.title,
            })

        return {
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "created_count": len(created),
            "tasks": created,
            "note": (
                "Đây là nhóm Task được tạo một lần, "
                "không phải lịch tự động lặp hằng tuần."
            ),
        }

    # =====================================================
    # MAIN EXECUTION
    # =====================================================

    async def execute(
        self,
        proposal: OwnerAIActionProposal,
        owner_id: uuid.UUID,
    ) -> dict:
        """
        Thực thi một proposal đã được duyệt.

        Hàm này không commit.
        Caller phải ghi execution log và commit cùng transaction.
        """

        if proposal.status != "approved":
            raise ValueError(
                "Chỉ đề xuất đã được Owner duyệt mới được thực thi."
            )

        if proposal.owner_id != owner_id:
            raise HTTPException(
                status_code=403,
                detail="Bạn không có quyền thực thi đề xuất này.",
            )

        project = await self._require_owner(
            proposal.project_id,
            owner_id,
        )

        owner = await self.db.get(User, owner_id)

        if owner is None:
            raise HTTPException(
                status_code=404,
                detail="Không tìm thấy tài khoản Owner.",
            )

        action_type = proposal.action_type
        payload = proposal.payload

        if action_type not in self.ALLOWED_ACTIONS:
            raise ValueError(
                "Loại hành động không được hỗ trợ."
            )

        if action_type == "task_create":
            task = await self._create_task(
                project,
                owner,
                payload,
            )

            return {
                "task_id": str(task.id),
                "title": task.title,
                "project_id": str(project.id),
            }

        if action_type == "task_update":
            task = await self._update_task(
                project,
                owner,
                payload,
            )

            return {
                "task_id": str(task.id),
                "title": task.title,
                "status": task.status,
                "priority": task.priority,
            }

        if action_type == "group_create":
            group = await self._create_group(
                project,
                payload,
            )

            return {
                "group_id": str(group.id),
                "name": group.name,
                "leader_id": (
                    str(group.leader_id)
                    if group.leader_id
                    else None
                ),
            }

        if action_type == "group_update":
            group = await self._update_group(
                project,
                payload,
            )

            return {
                "group_id": str(group.id),
                "name": group.name,
                "leader_id": (
                    str(group.leader_id)
                    if group.leader_id
                    else None
                ),
            }

        if action_type == "member_invite":
            return await self._invite_member(
                project,
                owner,
                payload,
            )

        if action_type == "weekly_schedule_create":
            return await self._create_weekly_tasks(
                project,
                owner,
                payload,
            )

        if action_type == "member_role_update":
            raise ValueError(
                "Chưa thể đổi vai trò bằng hành động này: "
                "Leader hiện được xác định theo từng Group "
                "qua ProjectGroup.leader_id. "
                "Hãy dùng group_update để chỉ định Leader cho nhóm."
            )

        raise ValueError("Hành động không được hỗ trợ.")