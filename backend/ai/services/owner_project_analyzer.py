
"""Phân tích dữ liệu dự án dành riêng cho Owner AI.

File này chỉ phân tích dữ liệu đã được Backend truy xuất.
Không gọi Ollama và không ghi hoặc sửa Database.
"""

from collections import Counter
from datetime import date, datetime, timezone
from typing import Any


class OwnerProjectAnalyzer:
    """Tạo báo cáo tổng quan và phát hiện rủi ro dự án."""

    TASK_DONE_STATUSES = {"done", "completed"}
    TASK_ACTIVE_STATUSES = {"in_progress", "doing"}
    TASK_BLOCKED_STATUSES = {"blocked"}
    TASK_TODO_STATUSES = {"todo", "pending"}

    HIGH_PRIORITIES = {"high", "urgent", "critical"}

    @staticmethod
    def _parse_datetime(value: Any) -> datetime | None:
        if isinstance(value, datetime):
            parsed = value
        elif isinstance(value, date):
            parsed = datetime.combine(
                value,
                datetime.min.time(),
            )
        elif isinstance(value, str):
            try:
                parsed = datetime.fromisoformat(
                    value.replace("Z", "+00:00")
                )
            except ValueError:
                return None
        else:
            return None

        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)

        return parsed

    @staticmethod
    def _safe_text(value: Any) -> str:
        if value is None:
            return ""
        return str(value).strip()

    @classmethod
    def analyze(cls, context: dict) -> dict:
        """
        Phân tích PROJECT_CONTEXT của Owner.

        Trả về:
        - overview: tổng quan dự án.
        - task_statistics: thống kê Task.
        - group_statistics: thống kê nhóm.
        - member_statistics: thống kê thành viên.
        - risks: các rủi ro có thể phát hiện từ dữ liệu.
        - recommendations: hướng xử lý gợi ý.

        Các nhận định chỉ dựa trên dữ liệu hiện có.
        """

        if not isinstance(context, dict):
            raise ValueError("PROJECT_CONTEXT không hợp lệ.")

        project = context.get("project") or {}
        tasks = context.get("tasks") or []
        groups = context.get("groups") or []
        members = context.get("members") or []
        subtasks = context.get("subtasks") or []

        if not isinstance(tasks, list):
            tasks = []
        if not isinstance(groups, list):
            groups = []
        if not isinstance(members, list):
            members = []
        if not isinstance(subtasks, list):
            subtasks = []

        now = datetime.now(timezone.utc)

        # ------------------------------------------
        # 1. TASK STATISTICS
        # ------------------------------------------

        status_counter = Counter()
        priority_counter = Counter()

        completed_tasks = []
        overdue_tasks = []
        unassigned_tasks = []
        blocked_tasks = []
        high_priority_open_tasks = []

        task_assignee_counter = Counter()

        for task in tasks:
            if not isinstance(task, dict):
                continue

            status = cls._safe_text(
                task.get("status")
            ).lower() or "unknown"

            priority = cls._safe_text(
                task.get("priority")
            ).lower() or "unknown"

            status_counter[status] += 1
            priority_counter[priority] += 1

            if status in cls.TASK_DONE_STATUSES:
                completed_tasks.append(task)
                continue

            if status in cls.TASK_BLOCKED_STATUSES:
                blocked_tasks.append(task)

            if priority in cls.HIGH_PRIORITIES:
                high_priority_open_tasks.append(task)

            assignee_id = task.get("assignee_id")

            if assignee_id:
                task_assignee_counter[str(assignee_id)] += 1
            else:
                unassigned_tasks.append(task)

            deadline = cls._parse_datetime(
                task.get("deadline")
            )

            if deadline and deadline < now:
                overdue_tasks.append(task)

        total_tasks = len(tasks)
        completed_count = len(completed_tasks)

        progress = (
            round(completed_count / total_tasks * 100, 2)
            if total_tasks
            else 0
        )

        task_statistics = {
            "total": total_tasks,
            "completed": completed_count,
            "in_progress": sum(
                status_counter[s]
                for s in cls.TASK_ACTIVE_STATUSES
            ),
            "todo": sum(
                status_counter[s]
                for s in cls.TASK_TODO_STATUSES
            ),
            "blocked": len(blocked_tasks),
            "overdue": len(overdue_tasks),
            "unassigned": len(unassigned_tasks),
            "by_status": dict(status_counter),
            "by_priority": dict(priority_counter),
            "completion_percentage": progress,
        }

        # ------------------------------------------
        # 2. GROUP STATISTICS
        # ------------------------------------------

        group_task_map = {
            str(group.get("id")): {
                "id": str(group.get("id")),
                "name": group.get("name"),
                "leader_id": group.get("leader_id"),
                "member_count": len(
                    group.get("members") or []
                ),
                "total_tasks": 0,
                "completed_tasks": 0,
            }
            for group in groups
            if isinstance(group, dict) and group.get("id")
        }

        for task in tasks:
            if not isinstance(task, dict):
                continue

            task_status = cls._safe_text(
                task.get("status")
            ).lower()

            for group_id in task.get("group_ids") or []:
                group_info = group_task_map.get(
                    str(group_id)
                )

                if not group_info:
                    continue

                group_info["total_tasks"] += 1

                if task_status in cls.TASK_DONE_STATUSES:
                    group_info["completed_tasks"] += 1

        group_summaries = []

        for group_info in group_task_map.values():
            total = group_info["total_tasks"]
            completed = group_info["completed_tasks"]

            group_info["completion_percentage"] = (
                round(completed / total * 100, 2)
                if total
                else 0
            )

            group_summaries.append(group_info)

        # ------------------------------------------
        # 3. MEMBER STATISTICS
        # ------------------------------------------

        member_map = {
            str(member.get("id")): {
                "id": str(member.get("id")),
                "name": member.get("name"),
                "role": member.get("role"),
                "assigned_tasks": 0,
            }
            for member in members
            if isinstance(member, dict) and member.get("id")
        }

        for task in tasks:
            if not isinstance(task, dict):
                continue

            assignee_id = task.get("assignee_id")

            if assignee_id is None:
                continue

            member_info = member_map.get(
                str(assignee_id)
            )

            if member_info:
                member_info["assigned_tasks"] += 1

        member_summaries = list(
            member_map.values()
        )

        # ------------------------------------------
        # 4. SUBTASK STATISTICS
        # ------------------------------------------

        subtask_status_counter = Counter()

        for subtask in subtasks:
            if not isinstance(subtask, dict):
                continue

            status = cls._safe_text(
                subtask.get("status")
            ).lower() or "unknown"

            subtask_status_counter[status] += 1

        # ------------------------------------------
        # 5. RISK DETECTION
        # ------------------------------------------

        risks = []
        recommendations = []

        if total_tasks == 0:
            risks.append({
                "code": "NO_TASKS",
                "severity": "medium",
                "title": "Dự án chưa có Task",
                "description": (
                    "Chưa có Task để đo lường tiến độ dự án."
                ),
            })

            recommendations.append(
                "Owner nên xác định các đầu việc chính "
                "và chia chúng thành Task cụ thể."
            )

        if overdue_tasks:
            risks.append({
                "code": "OVERDUE_TASKS",
                "severity": "high",
                "count": len(overdue_tasks),
                "title": "Có Task quá hạn",
                "description": (
                    f"Phát hiện {len(overdue_tasks)} Task "
                    "chưa hoàn thành và đã quá hạn."
                ),
                "task_ids": [
                    str(task.get("id"))
                    for task in overdue_tasks
                    if task.get("id")
                ],
            })

            recommendations.append(
                "Owner nên rà soát nguyên nhân quá hạn, "
                "điều chỉnh thời hạn hoặc phân bổ lại công việc."
            )

        if blocked_tasks:
            risks.append({
                "code": "BLOCKED_TASKS",
                "severity": "high",
                "count": len(blocked_tasks),
                "title": "Có Task bị chặn",
                "description": (
                    f"Phát hiện {len(blocked_tasks)} Task "
                    "đang ở trạng thái blocked."
                ),
                "task_ids": [
                    str(task.get("id"))
                    for task in blocked_tasks
                    if task.get("id")
                ],
            })

            recommendations.append(
                "Owner nên trao đổi với Leader phụ trách "
                "để xác định và xử lý các điểm nghẽn."
            )

        if unassigned_tasks:
            risks.append({
                "code": "UNASSIGNED_TASKS",
                "severity": "medium",
                "count": len(unassigned_tasks),
                "title": "Task chưa được phân công",
                "description": (
                    f"Có {len(unassigned_tasks)} Task "
                    "chưa có người phụ trách."
                ),
                "task_ids": [
                    str(task.get("id"))
                    for task in unassigned_tasks
                    if task.get("id")
                ],
            })

            recommendations.append(
                "Owner nên làm rõ người chịu trách nhiệm "
                "cho các Task chưa được phân công."
            )

        if high_priority_open_tasks:
            risks.append({
                "code": "HIGH_PRIORITY_OPEN_TASKS",
                "severity": "medium",
                "count": len(high_priority_open_tasks),
                "title": "Task ưu tiên cao chưa hoàn thành",
                "description": (
                    f"Có {len(high_priority_open_tasks)} Task "
                    "ưu tiên cao vẫn chưa hoàn thành."
                ),
                "task_ids": [
                    str(task.get("id"))
                    for task in high_priority_open_tasks
                    if task.get("id")
                ],
            })

        for group_info in group_summaries:
            if group_info["total_tasks"] == 0:
                risks.append({
                    "code": "GROUP_WITHOUT_TASKS",
                    "severity": "low",
                    "title": "Nhóm chưa có Task",
                    "description": (
                        f"Nhóm {group_info['name']} "
                        "chưa có Task được liên kết."
                    ),
                    "group_id": group_info["id"],
                })

        # ------------------------------------------
        # 6. PROJECT OVERVIEW
        # ------------------------------------------

        overview = {
            "project_id": project.get("id"),
            "project_name": project.get("name"),
            "project_status": project.get("status"),
            "start_date": project.get("start_date"),
            "end_date": project.get("end_date"),
            "progress_percentage": progress,
            "total_tasks": total_tasks,
            "completed_tasks": completed_count,
            "total_groups": len(groups),
            "total_members": len(members),
            "total_subtasks": len(subtasks),
            "analysis_at": now.isoformat(),
        }

        return {
            "overview": overview,
            "task_statistics": task_statistics,
            "group_statistics": group_summaries,
            "member_statistics": member_summaries,
            "subtask_statistics": {
                "total": len(subtasks),
                "by_status": dict(
                    subtask_status_counter
                ),
            },
            "risks": risks,
            "recommendations": recommendations,
        }
