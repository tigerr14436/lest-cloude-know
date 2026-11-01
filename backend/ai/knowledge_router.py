
"""API quản lý Knowledge Base của Project AI."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User, ProjectMember
from project_groups import ProjectGroup, GroupMember
from auth_deps import get_current_user

from ai.models import AIKnowledgeItem
from ai.schemas import (
    AIKnowledgeCreate,
    AIKnowledgeReview,
    AIKnowledgeResponse,
)


router = APIRouter(
    prefix="/api/projects/{project_id}/ai/knowledge",
    tags=["Project AI Knowledge"],
)


# =====================================================
# Kiểm tra thành viên dự án
# =====================================================

async def get_membership(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
):
    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )

    membership = result.scalar_one_or_none()

    if membership is None:
        raise HTTPException(
            status_code=403,
            detail="Bạn không thuộc dự án này",
        )

    return membership


# =====================================================
# Kiểm tra quyền gửi Knowledge vào nhóm
# =====================================================

async def validate_group_access(
    db: AsyncSession,
    project_id: uuid.UUID,
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    is_owner: bool,
):
    """
    Kiểm tra nhóm thuộc dự án.

    Owner có thể gửi Knowledge vào mọi nhóm.
    Member chỉ được gửi Knowledge vào nhóm mình tham gia.
    """

    result = await db.execute(
        select(ProjectGroup).where(
            ProjectGroup.id == group_id,
            ProjectGroup.project_id == project_id,
        )
    )

    group = result.scalar_one_or_none()

    if group is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy nhóm trong dự án",
        )

    if is_owner:
        return

    member_result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
        )
    )

    group_membership = member_result.scalar_one_or_none()

    if group_membership is None:
        raise HTTPException(
            status_code=403,
            detail="Bạn không có quyền gửi Knowledge vào nhóm này",
        )


# =====================================================
# 1. Thành viên gửi Knowledge mới
# =====================================================

@router.post(
    "",
    response_model=AIKnowledgeResponse,
    status_code=201,
)
async def create_knowledge(
    project_id: uuid.UUID,
    payload: AIKnowledgeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Kiểm tra thành viên dự án.
    membership = await get_membership(
        db=db,
        project_id=project_id,
        user_id=current_user.id,
    )

    is_owner = membership.role == "owner"

    # Nếu Knowledge thuộc một nhóm cụ thể,
    # kiểm tra quyền gửi vào nhóm đó.
    if payload.group_id is not None:
        await validate_group_access(
            db=db,
            project_id=project_id,
            group_id=payload.group_id,
            user_id=current_user.id,
            is_owner=is_owner,
        )

    # Knowledge mới luôn ở trạng thái pending.
    # Owner cần duyệt trước khi AI sử dụng.
    knowledge = AIKnowledgeItem(
        project_id=project_id,
        group_id=payload.group_id,
        title=payload.title.strip(),
        content=payload.content.strip(),
        knowledge_type=payload.knowledge_type,
        status="pending",
        created_by=current_user.id,
    )

    db.add(knowledge)

    await db.commit()
    await db.refresh(knowledge)

    return knowledge


# =====================================================
# 2. Xem danh sách Knowledge
# =====================================================

@router.get(
    "",
    response_model=list[AIKnowledgeResponse],
)
async def get_knowledge_list(
    project_id: uuid.UUID,
    status: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Kiểm tra thành viên dự án.
    membership = await get_membership(
        db=db,
        project_id=project_id,
        user_id=current_user.id,
    )

    is_owner = membership.role == "owner"

    # Truy xuất Knowledge thuộc dự án.
    query = select(AIKnowledgeItem).where(
        AIKnowledgeItem.project_id == project_id
    )

    if is_owner:
        # Owner có thể xem tất cả trạng thái.
        if status is not None:
            allowed_statuses = {
                "pending",
                "approved",
                "rejected",
                "archived",
            }

            if status not in allowed_statuses:
                raise HTTPException(
                    status_code=400,
                    detail="Trạng thái Knowledge không hợp lệ",
                )

            query = query.where(
                AIKnowledgeItem.status == status
            )

    else:
        # Member chỉ được xem Knowledge đã duyệt.
        query = query.where(
            AIKnowledgeItem.status == "approved"
        )

        # Không giới hạn theo group_id.
        # Tất cả Knowledge đã duyệt trong dự án
        # đều được chia sẻ cho mọi thành viên.

    query = query.order_by(
        AIKnowledgeItem.created_at.desc()
    )

    result = await db.execute(query)

    return result.scalars().all()


# =====================================================
# 3. Owner duyệt hoặc từ chối Knowledge
# =====================================================

@router.patch(
    "/{knowledge_id}/review",
    response_model=AIKnowledgeResponse,
)
async def review_knowledge(
    project_id: uuid.UUID,
    knowledge_id: uuid.UUID,
    payload: AIKnowledgeReview,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Kiểm tra thành viên dự án.
    membership = await get_membership(
        db=db,
        project_id=project_id,
        user_id=current_user.id,
    )

    # Chỉ Owner được duyệt Knowledge.
    if membership.role != "owner":
        raise HTTPException(
            status_code=403,
            detail="Chỉ Owner mới được duyệt Knowledge",
        )

    # Tìm Knowledge thuộc đúng dự án.
    result = await db.execute(
        select(AIKnowledgeItem).where(
            AIKnowledgeItem.id == knowledge_id,
            AIKnowledgeItem.project_id == project_id,
        )
    )

    knowledge = result.scalar_one_or_none()

    if knowledge is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy Knowledge",
        )

    # Chỉ xử lý Knowledge đang chờ duyệt.
    if knowledge.status != "pending":
        raise HTTPException(
            status_code=400,
            detail="Knowledge này đã được xử lý",
        )

    # Cập nhật trạng thái duyệt.
    knowledge.status = payload.status

    if payload.status == "approved":
        knowledge.approved_by = current_user.id
        knowledge.approved_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(knowledge)

    return knowledge
