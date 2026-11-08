
"""Thực thi các đề xuất đã được Owner AI phê duyệt."""

import re
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
    Thực thi các đề xuất đã được Owner AI phê duyệt.

    Nguyên tắc:
    - Chỉ Owner của dự án mới được thực thi.
    - Luôn kiểm tra lại quyền và dữ liệu tại thời điểm thực thi.
    - Không tin payload chỉ vì AI đã validation trước đó.
    - Không tự commit transaction.
    - Router chịu trách nhiệm commit hoặc rollback.
    - Task thuộc Group được liên kết thông qua bảng GroupTask.
    """

    ALLOWED_ACTIONS = {
        "task_create",
        "task_update",
        "group_create",
        "group_update",
        "member_invite",
        "member_role_update",
        "weekly_schedule_create",
        "project_setup_create",
    }

    MAX_TASKS_PER_PROPOSAL = 30
    MAX_GROUPS_PER_SETUP = 10

    def __init__(self, db: AsyncSession):
        self.db = db

    # =====================================================
    # 1. COMMON VALIDATION
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
            raise ValueError(
                f"{field_name} phải là chuỗi."
            )

        value = value.strip()

        if not value:
            raise ValueError(
                f"{field_name} không được để trống."
            )

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
            raise ValueError(
                "Deadline phải có dạng YYYY-MM-DD."
            )

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

    @staticmethod
    def _check_allowed_keys(
        payload: dict,
        allowed: set[str],
        field_name: str = "Payload",
    ):
        if not isinstance(payload, dict):
            raise ValueError(
                f"{field_name} phải là object."
            )

        unknown = set(payload.keys()) - allowed

        if unknown:
            raise ValueError(
                f"{field_name} chứa trường không được hỗ trợ: "
                + ", ".join(sorted(str(key) for key in unknown))
            )

    @staticmethod
    def _validate_priority(value: Any) -> str:
        if (
            not isinstance(value, str)
            or value not in ALLOWED_PRIORITY
        ):
            raise ValueError(
                "Priority không hợp lệ."
            )

        return value

    @staticmethod
    def _validate_status(value: Any) -> str:
        if (
            not isinstance(value, str)
            or value not in ALLOWED_STATUS
        ):
            raise ValueError(
                "Status không hợp lệ."
            )

        return value

    async def _require_owner(
        self,
        project_id: uuid.UUID,
        owner_id: uuid.UUID,
    ) -> Project:
        project = await self.db.get(
            Project,
            project_id,
        )

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
            .join(
                User,
                User.id == ProjectMember.user_id,
            )
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
        group = await self.db.get(
            ProjectGroup,
            group_id,
        )

        if (
            group is None
            or group.project_id != project_id
        ):
            raise ValueError(
                "Nhóm không tồn tại trong dự án hiện tại."
            )

        return group

    # =====================================================
    # 2. TASK PAYLOAD VALIDATION
    # =====================================================

    async def _validate_task_payload(
        self,
        project: Project,
        payload: dict,
    ) -> dict:
        """
        Kiểm tra payload Task trước khi ghi dữ liệu.

        Dùng chung cho:
        - task_create
        - weekly_schedule_create
        """

        if not isinstance(payload, dict):
            raise ValueError(
                "Payload tạo Task không hợp lệ."
            )

        allowed = {
            "title",
            "description",
            "priority",
            "deadline",
            "assignee_id",
            "group_id",
        }

        self._check_allowed_keys(
            payload,
            allowed,
            "Payload tạo Task",
        )

        title = self._text(
            payload.get("title"),
            "title",
        )

        description = payload.get("description")

        if (
            description is not None
            and not isinstance(description, str)
        ):
            raise ValueError(
                "Description không hợp lệ."
            )

        if (
            isinstance(description, str)
            and len(description) > 10000
        ):
            raise ValueError(
                "Description không được vượt quá 10000 ký tự."
            )

        priority = self._validate_priority(
            payload.get("priority", "medium")
        )

        deadline = self._deadline(
            payload.get("deadline")
        )

        assignee_id = None

        if payload.get("assignee_id") is not None:
            assignee_id = self._uuid(
                payload["assignee_id"],
                "assignee_id",
            )

            await self._require_project_member(
                project.id,
                assignee_id,
            )

        group_id = None

        if payload.get("group_id") is not None:
            group_id = self._uuid(
                payload["group_id"],
                "group_id",
            )

            await self._require_group(
                project.id,
                group_id,
            )

        return {
            "title": title,
            "description": description,
            "priority": priority,
            "deadline": deadline,
            "assignee_id": assignee_id,
            "group_id": group_id,
        }

    # =====================================================
    # 3. NOTIFICATION
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
    # 4. TASK CREATE
    # =====================================================

    async def _create_task(
        self,
        project: Project,
        owner: User,
        payload: dict,
    ) -> Task:
        validated = await self._validate_task_payload(
            project,
            payload,
        )

        assignee = None

        if validated["assignee_id"] is not None:
            _, assignee = await self._require_project_member(
                project.id,
                validated["assignee_id"],
            )

        group = None

        if validated["group_id"] is not None:
            group = await self._require_group(
                project.id,
                validated["group_id"],
            )

        task = Task(
            project_id=project.id,
            title=validated["title"],
            description=validated["description"],
            status="todo",
            priority=validated["priority"],
            deadline=validated["deadline"],
            assignee_id=(
                assignee.id if assignee else None
            ),
            assignee=(
                assignee.name if assignee else None
            ),
        )

        self.db.add(task)
        await self.db.flush()

        # Task được liên kết với Group qua GroupTask.
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
    # 5. TASK UPDATE
    # =====================================================

    async def _update_task(
        self,
        project: Project,
        owner: User,
        payload: dict,
    ) -> Task:
        self._check_allowed_keys(
            payload,
            {"task_id", "updates"},
            "Payload cập nhật Task",
        )

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

        if (
            not isinstance(updates, dict)
            or not updates
        ):
            raise ValueError(
                "Không có dữ liệu cập nhật Task."
            )

        allowed = {
            "title",
            "description",
            "status",
            "priority",
            "deadline",
            "assignee_id",
        }

        self._check_allowed_keys(
            updates,
            allowed,
            "Payload cập nhật Task",
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

            if (
                description is not None
                and not isinstance(description, str)
            ):
                raise ValueError(
                    "Description không hợp lệ."
                )

            if (
                isinstance(description, str)
                and len(description) > 10000
            ):
                raise ValueError(
                    "Description không được vượt quá 10000 ký tự."
                )

            task.description = description

        if "status" in updates:
            task.status = self._validate_status(
                updates["status"]
            )

        if "priority" in updates:
            task.priority = self._validate_priority(
                updates["priority"]
            )

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
    # 6. GROUP CREATE
    # =====================================================

    async def _create_group(
        self,
        project: Project,
        payload: dict,
    ) -> ProjectGroup:
        if not isinstance(payload, dict):
            raise ValueError(
                "Payload tạo Group không hợp lệ."
            )

        self._check_allowed_keys(
            payload,
            {"name", "leader_id"},
            "Payload tạo Group",
        )

        name = self._text(
            payload.get("name"),
            "name",
        )

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
            leader_id=(
                leader.id if leader else None
            ),
        )

        self.db.add(group)
        await self.db.flush()

        # Leader đồng thời phải là thành viên Group.
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
    # 7. GROUP UPDATE
    # =====================================================

    async def _update_group(
        self,
        project: Project,
        payload: dict,
    ) -> ProjectGroup:
        self._check_allowed_keys(
            payload,
            {"group_id", "updates"},
            "Payload cập nhật Group",
        )

        group_id = self._uuid(
            payload.get("group_id"),
            "group_id",
        )

        group = await self._require_group(
            project.id,
            group_id,
        )

        updates = payload.get("updates")

        if (
            not isinstance(updates, dict)
            or not updates
        ):
            raise ValueError(
                "Không có dữ liệu cập nhật Group."
            )

        self._check_allowed_keys(
            updates,
            {"name", "leader_id"},
            "Payload cập nhật Group",
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
    # 8. PROJECT SETUP VALIDATION
    # =====================================================

    async def _validate_project_setup(
        self,
        project: Project,
        payload: dict,
    ) -> tuple[list[dict], list[dict]]:
        """
        Kiểm tra toàn bộ cấu trúc Project Setup trước khi tạo.

        Payload:

        {
            "groups": [
                {
                    "key": "frontend",
                    "name": "Frontend",
                    "leader_id": null
                }
            ],
            "tasks": [
                {
                    "title": "Thiết kế giao diện",
                    "description": "...",
                    "priority": "high",
                    "deadline": "2026-11-15",
                    "assignee_id": null,
                    "group_key": "frontend"
                }
            ]
        }

        group_key chỉ là key tham chiếu trong proposal.
        Khi thực thi sẽ chuyển thành UUID Group thực tế.
        """

        if not isinstance(payload, dict):
            raise ValueError(
                "Payload khởi tạo dự án không hợp lệ."
            )

        self._check_allowed_keys(
            payload,
            {"groups", "tasks"},
            "Payload khởi tạo dự án",
        )

        raw_groups = payload.get("groups")
        raw_tasks = payload.get("tasks")

        if (
            not isinstance(raw_groups, list)
            or not raw_groups
        ):
            raise ValueError(
                "Phải có ít nhất một Group."
            )

        if len(raw_groups) > self.MAX_GROUPS_PER_SETUP:
            raise ValueError(
                f"Một lần chỉ được tạo tối đa "
                f"{self.MAX_GROUPS_PER_SETUP} Group."
            )

        if (
            not isinstance(raw_tasks, list)
            or not raw_tasks
        ):
            raise ValueError(
                "Phải có ít nhất một Task."
            )

        if len(raw_tasks) > self.MAX_TASKS_PER_PROPOSAL:
            raise ValueError(
                f"Một lần chỉ được tạo tối đa "
                f"{self.MAX_TASKS_PER_PROPOSAL} Task."
            )

        # -------------------------------------------------
        # VALIDATE GROUPS
        # -------------------------------------------------

        validated_groups = []
        group_keys = set()

        for index, item in enumerate(
            raw_groups,
            start=1,
        ):
            if not isinstance(item, dict):
                raise ValueError(
                    f"Group thứ {index} không hợp lệ."
                )

            self._check_allowed_keys(
                item,
                {"key", "name", "leader_id"},
                f"Group thứ {index}",
            )

            key = self._text(
                item.get("key"),
                f"groups[{index}].key",
                max_length=40,
            )

            if not re.fullmatch(
                r"[a-zA-Z0-9_-]+",
                key,
            ):
                raise ValueError(
                    f"Key của Group thứ {index} chỉ được chứa "
                    "chữ, số, dấu gạch ngang và gạch dưới."
                )

            normalized_key = key.casefold()

            if normalized_key in group_keys:
                raise ValueError(
                    f"Key Group '{key}' bị trùng."
                )

            group_keys.add(normalized_key)

            group_data = {
                "key": key,
                "name": self._text(
                    item.get("name"),
                    f"groups[{index}].name",
                ),
                "leader_id": None,
            }

            if item.get("leader_id") is not None:
                leader_id = self._uuid(
                    item["leader_id"],
                    f"groups[{index}].leader_id",
                )

                await self._require_project_member(
                    project.id,
                    leader_id,
                )

                group_data["leader_id"] = leader_id

            validated_groups.append(group_data)

        # -------------------------------------------------
        # VALIDATE TASKS
        # -------------------------------------------------

        validated_tasks = []

        for index, item in enumerate(
            raw_tasks,
            start=1,
        ):
            if not isinstance(item, dict):
                raise ValueError(
                    f"Task thứ {index} không hợp lệ."
                )

            self._check_allowed_keys(
                item,
                {
                    "title",
                    "description",
                    "priority",
                    "deadline",
                    "assignee_id",
                    "group_key",
                },
                f"Task thứ {index}",
            )

            title = self._text(
                item.get("title"),
                f"tasks[{index}].title",
            )

            description = item.get("description")

            if (
                description is not None
                and not isinstance(description, str)
            ):
                raise ValueError(
                    f"Description của Task thứ {index} không hợp lệ."
                )

            if (
                isinstance(description, str)
                and len(description) > 10000
            ):
                raise ValueError(
                    f"Description của Task thứ {index} "
                    "vượt quá 10000 ký tự."
                )

            priority = self._validate_priority(
                item.get("priority", "medium")
            )

            normalized_deadline = self._deadline(
                item.get("deadline")
            )

            group_key = self._text(
                item.get("group_key"),
                f"tasks[{index}].group_key",
                max_length=40,
            )

            if group_key.casefold() not in group_keys:
                raise ValueError(
                    f"Task thứ {index} tham chiếu Group "
                    f"'{group_key}' không tồn tại trong proposal."
                )

            assignee_id = None

            if item.get("assignee_id") is not None:
                assignee_id = self._uuid(
                    item["assignee_id"],
                    f"tasks[{index}].assignee_id",
                )

                await self._require_project_member(
                    project.id,
                    assignee_id,
                )

            validated_tasks.append({
                "title": title,
                "description": description,
                "priority": priority,
                "deadline": (
                    normalized_deadline.date().isoformat()
                    if normalized_deadline
                    else None
                ),
                "assignee_id": assignee_id,
                "group_key": group_key,
            })

        return validated_groups, validated_tasks

    # =====================================================
    # 9. PROJECT SETUP CREATE
    # =====================================================

    async def _create_project_setup(
        self,
        project: Project,
        owner: User,
        payload: dict,
    ) -> dict:
        """
        Tạo nhiều Group và Task trong cùng một proposal.

        Trình tự:
        1. Validate toàn bộ payload.
        2. Tạo tất cả Group.
        3. Lưu ánh xạ group_key -> group UUID.
        4. Tạo Task và chuyển group_key thành group_id.
        5. _create_task() tự tạo bản ghi GroupTask.

        Không commit tại đây.
        """

        groups_data, tasks_data = (
            await self._validate_project_setup(
                project=project,
                payload=payload,
            )
        )

        # -------------------------------------------------
        # CREATE GROUPS
        # -------------------------------------------------

        created_groups = []
        group_id_map: dict[str, uuid.UUID] = {}

        for group_data in groups_data:
            group = await self._create_group(
                project=project,
                payload={
                    "name": group_data["name"],
                    "leader_id": group_data["leader_id"],
                },
            )

            normalized_key = group_data["key"].casefold()

            group_id_map[normalized_key] = group.id

            created_groups.append({
                "group_id": str(group.id),
                "key": group_data["key"],
                "name": group.name,
                "leader_id": (
                    str(group.leader_id)
                    if group.leader_id
                    else None
                ),
            })

        # -------------------------------------------------
        # CREATE TASKS
        # -------------------------------------------------

        created_tasks = []

        for index, task_data in enumerate(
            tasks_data,
            start=1,
        ):
            normalized_key = task_data["group_key"].casefold()

            group_id = group_id_map.get(normalized_key)

            if group_id is None:
                raise ValueError(
                    f"Không tìm thấy Group tương ứng với "
                    f"Task thứ {index}."
                )

            task_payload = {
                "title": task_data["title"],
                "description": task_data["description"],
                "priority": task_data["priority"],
                "deadline": task_data["deadline"],
                "assignee_id": (
                    str(task_data["assignee_id"])
                    if task_data["assignee_id"]
                    else None
                ),
                "group_id": str(group_id),
            }

            task = await self._create_task(
                project=project,
                owner=owner,
                payload=task_payload,
            )

            created_tasks.append({
                "task_id": str(task.id),
                "title": task.title,
                "status": task.status,
                "priority": task.priority,
                "deadline": (
                    task.deadline.isoformat()
                    if task.deadline
                    else None
                ),
                "assignee_id": (
                    str(task.assignee_id)
                    if task.assignee_id
                    else None
                ),
                "group_id": str(group_id),
                "group_key": task_data["group_key"],
            })

        await self.db.flush()

        return {
            "action_type": "project_setup_create",
            "project_id": str(project.id),
            "created_group_count": len(created_groups),
            "created_task_count": len(created_tasks),
            "groups": created_groups,
            "tasks": created_tasks,
        }

    # =====================================================
    # 10. MEMBER INVITE
    # =====================================================

    async def _invite_member(
        self,
        project: Project,
        owner: User,
        payload: dict,
    ) -> dict:
        if not isinstance(payload, dict):
            raise ValueError(
                "Payload mời thành viên không hợp lệ."
            )

        self._check_allowed_keys(
            payload,
            {"email", "name_tag", "role"},
            "Payload mời thành viên",
        )

        if payload.get("role", "member") != "member":
            raise ValueError(
                "Người được mời chỉ có thể nhận vai trò Member."
            )

        email = payload.get("email")
        name_tag = payload.get("name_tag")

        has_email = (
            isinstance(email, str)
            and bool(email.strip())
        )

        has_name_tag = (
            isinstance(name_tag, str)
            and bool(name_tag.strip())
        )

        if has_email == has_name_tag:
            raise ValueError(
                "Phải cung cấp chính xác một trong hai: "
                "email hoặc Name Tag."
            )

        if has_name_tag:
            normalized_tag = normalize_name_tag(
                name_tag
            )

            invitee = await find_user_by_name_tag(
                self.db,
                normalized_tag,
            )

        else:
            invitee = await find_user_by_email(
                self.db,
                email.strip(),
            )

        if invitee is None:
            raise ValueError(
                "Không tìm thấy tài khoản cần mời."
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
    # 11. WEEKLY TASK BATCH
    # =====================================================

    async def _create_weekly_tasks(
        self,
        project: Project,
        owner: User,
        payload: dict,
    ) -> dict:
        """
        Tạo một nhóm Task theo kế hoạch tuần.

        Lưu ý:
        Đây là thao tác tạo Task một lần.
        Không phải scheduler tự động lặp hằng tuần.
        """

        if not isinstance(payload, dict):
            raise ValueError(
                "Payload kế hoạch tuần không hợp lệ."
            )

        self._check_allowed_keys(
            payload,
            {"start_date", "end_date", "tasks"},
            "Payload kế hoạch tuần",
        )

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

        if len(tasks) > self.MAX_TASKS_PER_PROPOSAL:
            raise ValueError(
                f"Một kế hoạch không được vượt quá "
                f"{self.MAX_TASKS_PER_PROPOSAL} Task."
            )

        # Kiểm tra toàn bộ Task trước khi tạo bất kỳ Task nào.
        validated_tasks = []

        for index, item in enumerate(
            tasks,
            start=1,
        ):
            try:
                validated = await self._validate_task_payload(
                    project,
                    item,
                )

                validated_tasks.append(validated)

            except Exception as exc:
                raise ValueError(
                    f"Task thứ {index} không hợp lệ: {str(exc)}"
                ) from exc

        created = []

        for index, item in enumerate(
            validated_tasks,
            start=1,
        ):
            try:
                task = await self._create_task(
                    project,
                    owner,
                    {
                        "title": item["title"],
                        "description": item["description"],
                        "priority": item["priority"],
                        "deadline": (
                            item["deadline"].isoformat()
                            if item["deadline"]
                            else None
                        ),
                        "assignee_id": (
                            str(item["assignee_id"])
                            if item["assignee_id"]
                            else None
                        ),
                        "group_id": (
                            str(item["group_id"])
                            if item["group_id"]
                            else None
                        ),
                    },
                )

            except Exception as exc:
                raise ValueError(
                    f"Không thể tạo Task thứ {index}: {str(exc)}"
                ) from exc

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
    # 12. MAIN EXECUTION
    # =====================================================

    async def execute(
        self,
        proposal: OwnerAIActionProposal,
        owner_id: uuid.UUID,
    ) -> dict:
        """
        Thực thi một proposal đã được Owner duyệt.

        Hàm này không commit.

        Router phải:
        - Gọi execute().
        - Cập nhật trạng thái proposal.
        - Ghi execution log.
        - Commit khi thành công.
        - Rollback nếu xảy ra lỗi.
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

        owner = await self.db.get(
            User,
            owner_id,
        )

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

        # -------------------------------------------------
        # PROJECT SETUP CREATE
        # -------------------------------------------------

        if action_type == "project_setup_create":
            return await self._create_project_setup(
                project=project,
                owner=owner,
                payload=payload,
            )

        # -------------------------------------------------
        # TASK CREATE
        # -------------------------------------------------

        if action_type == "task_create":

            # TẠO NHIỀU TASK
            if isinstance(payload, list):

                if not payload:
                    raise ValueError(
                        "Danh sách Task không được để trống."
                    )

                if len(payload) > self.MAX_TASKS_PER_PROPOSAL:
                    raise ValueError(
                        f"Một lần chỉ được tạo tối đa "
                        f"{self.MAX_TASKS_PER_PROPOSAL} Task."
                    )

                # Validate toàn bộ trước khi tạo.
                validated_tasks = []

                for index, item in enumerate(
                    payload,
                    start=1,
                ):
                    try:
                        validated = await self._validate_task_payload(
                            project,
                            item,
                        )

                        validated_tasks.append(validated)

                    except Exception as exc:
                        raise ValueError(
                            f"Task thứ {index} không hợp lệ: {str(exc)}"
                        ) from exc

                created_tasks = []

                for index, task_data in enumerate(
                    validated_tasks,
                    start=1,
                ):
                    try:
                        task = await self._create_task(
                            project,
                            owner,
                            {
                                "title": task_data["title"],
                                "description": task_data["description"],
                                "priority": task_data["priority"],
                                "deadline": (
                                    task_data["deadline"].isoformat()
                                    if task_data["deadline"]
                                    else None
                                ),
                                "assignee_id": (
                                    str(task_data["assignee_id"])
                                    if task_data["assignee_id"]
                                    else None
                                ),
                                "group_id": (
                                    str(task_data["group_id"])
                                    if task_data["group_id"]
                                    else None
                                ),
                            },
                        )

                    except Exception as exc:
                        raise ValueError(
                            f"Không thể tạo Task thứ {index}: "
                            f"{str(exc)}"
                        ) from exc

                    created_tasks.append({
                        "task_id": str(task.id),
                        "title": task.title,
                        "project_id": str(project.id),
                        "status": task.status,
                        "priority": task.priority,
                    })

                return {
                    "created_count": len(created_tasks),
                    "tasks": created_tasks,
                }

            # TẠO MỘT TASK
            task = await self._create_task(
                project,
                owner,
                payload,
            )

            return {
                "created_count": 1,
                "tasks": [
                    {
                        "task_id": str(task.id),
                        "title": task.title,
                        "project_id": str(project.id),
                        "status": task.status,
                        "priority": task.priority,
                    }
                ],
            }

        # -------------------------------------------------
        # TASK UPDATE
        # -------------------------------------------------

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

        # -------------------------------------------------
        # GROUP CREATE
        # -------------------------------------------------

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

        # -------------------------------------------------
        # GROUP UPDATE
        # -------------------------------------------------

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

        # -------------------------------------------------
        # MEMBER INVITE
        # -------------------------------------------------

        if action_type == "member_invite":
            return await self._invite_member(
                project,
                owner,
                payload,
            )

        # -------------------------------------------------
        # MEMBER ROLE UPDATE
        # -------------------------------------------------

        if action_type == "member_role_update":
            raise ValueError(
                "Chưa hỗ trợ đổi vai trò thành viên bằng "
                "Owner AI Executor. Leader hiện được xác định "
                "theo từng Group thông qua ProjectGroup.leader_id. "
                "Hãy sử dụng group_update để chỉ định Leader cho Group."
            )

        # -------------------------------------------------
        # WEEKLY SCHEDULE CREATE
        # -------------------------------------------------

        if action_type == "weekly_schedule_create":
            return await self._create_weekly_tasks(
                project,
                owner,
                payload,
            )

        raise ValueError(
            "Hành động không được hỗ trợ."
        )
