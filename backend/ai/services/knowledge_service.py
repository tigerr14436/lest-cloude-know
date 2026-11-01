
"""Truy xuất Knowledge đã được Owner duyệt cho AI Agent."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ai.models import AIKnowledgeItem
from ai.services.permission_service import (
    get_project_ai_permissions,
)


async def get_approved_knowledge(
    db: AsyncSession,
    project_id: UUID,
    user_id: UUID,
) -> list[dict]:
    """
    Lấy toàn bộ Knowledge đã được Owner duyệt trong dự án.

    Quy tắc:
    - Chỉ thành viên dự án mới được truy xuất.
    - Owner và Member đều nhìn thấy Knowledge đã duyệt.
    - Knowledge thuộc nhóm Backend, Frontend hoặc toàn dự án
      đều được chia sẻ với tất cả thành viên.
    - Knowledge pending, rejected, archived không được sử dụng.
    - Không tạo hoặc cập nhật dữ liệu database.
    """

    # 1. Kiểm tra quyền truy cập dự án.
    # Hàm này sẽ từ chối người không thuộc dự án.
    await get_project_ai_permissions(
        db=db,
        project_id=project_id,
        user_id=user_id,
    )

    # 2. Truy xuất toàn bộ Knowledge đã được Owner duyệt.
    # Không lọc theo group_id vì Knowledge được chia sẻ
    # trên phạm vi toàn dự án.
    query = (
        select(AIKnowledgeItem)
        .where(
            AIKnowledgeItem.project_id == project_id,
            AIKnowledgeItem.status == "approved",
        )
        .order_by(
            AIKnowledgeItem.created_at.asc()
        )
    )

    result = await db.execute(query)
    items = result.scalars().all()

    # 3. Chuẩn hóa dữ liệu để đưa vào AI context.
    return [
        {
            "id": str(item.id),
            "title": item.title,
            "content": item.content,
            "knowledge_type": item.knowledge_type,
            "group_id": (
                str(item.group_id)
                if item.group_id else None
            ),
        }
        for item in items
    ]
