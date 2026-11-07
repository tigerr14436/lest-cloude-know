
"""Truy xuất Knowledge theo phạm vi quyền của từng AI."""

from uuid import UUID

from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ai.models import (
    AIKnowledgeItem,
    AIKnowledgeShare,
)
from ai.services.permission_service import (
    get_project_ai_permissions,
)


async def get_approved_knowledge(
    db: AsyncSession,
    project_id: UUID,
    user_id: UUID,
) -> list[dict]:
    """
    Owner:
        Được đọc toàn bộ Knowledge đã duyệt trong dự án.

    Leader / Member:
        Chỉ đọc Knowledge được chia sẻ toàn dự án
        hoặc chia sẻ cho nhóm mà họ có quyền truy cập.

    Knowledge chưa có bản ghi AIKnowledgeShare
    được xem là owner_private.
    """

    permissions = await get_project_ai_permissions(
        db=db,
        project_id=project_id,
        user_id=user_id,
    )

    # Truy vấn Knowledge và thông tin chia sẻ.
    query = (
        select(
            AIKnowledgeItem,
            AIKnowledgeShare,
        )
        .outerjoin(
            AIKnowledgeShare,
            and_(
                AIKnowledgeShare.knowledge_id
                == AIKnowledgeItem.id,
                AIKnowledgeShare.project_id
                == AIKnowledgeItem.project_id,
            ),
        )
        .where(
            AIKnowledgeItem.project_id == project_id,
            AIKnowledgeItem.status == "approved",
        )
        .order_by(
            AIKnowledgeItem.created_at.asc()
        )
    )

    # -------------------------------------------------
    # Owner: xem toàn bộ Knowledge đã duyệt.
    # -------------------------------------------------

    if not permissions["is_owner"]:

        accessible_group_ids = (
            permissions["accessible_group_ids"]
        )

        share_conditions = [
            AIKnowledgeShare.scope == "project_shared",
        ]

        if accessible_group_ids:
            share_conditions.append(
                and_(
                    AIKnowledgeShare.scope == "group_shared",
                    AIKnowledgeShare.group_id.in_(
                        accessible_group_ids
                    ),
                )
            )

        query = query.where(
            or_(*share_conditions)
        )

    result = await db.execute(query)

    rows = result.all()

    knowledge_data = []

    for item, sharing in rows:

        knowledge_data.append({
            "id": str(item.id),
            "title": item.title,
            "content": item.content,
            "knowledge_type": item.knowledge_type,
            "group_id": (
                str(item.group_id)
                if item.group_id
                else None
            ),
            "sharing_scope": (
                sharing.scope
                if sharing
                else "owner_private"
            ),
        })

    return knowledge_data
