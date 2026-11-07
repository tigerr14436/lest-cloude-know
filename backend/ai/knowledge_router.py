
"""API quản lý Knowledge Base của Project AI."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ai.services.permission_service import (
    get_project_ai_permissions,
)
from database import get_db
from models import User
from project_groups import ProjectGroup, GroupMember
from auth_deps import get_current_user

from ai.models import (
    AIKnowledgeItem,
    AIKnowledgeShare,
)
from ai.schemas import (
    AIKnowledgeCreate,
    AIKnowledgeReview,
    AIKnowledgeResponse,
    AIKnowledgeSharingUpdate,
    AIKnowledgeSharingResponse,
)


router = APIRouter(
    prefix="/api/projects/{project_id}/ai/knowledge",
    tags=["Project AI Knowledge"],
)


# =====================================================
# 1. Lấy quyền truy cập dự án
# =====================================================

async def get_project_permissions(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
):
    """
    Sử dụng permission_service làm nguồn xác định
    quyền Owner, Leader và Member.

    Owner được xác định bằng Project.owner_id.
    Người ngoài dự án sẽ bị từ chối tại permission_service.
    """

    return await get_project_ai_permissions(
        db=db,
        project_id=project_id,
        user_id=user_id,
    )


# =====================================================
# 2. Kiểm tra quyền gửi Knowledge vào nhóm
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

    Owner:
        Có thể gửi Knowledge vào mọi nhóm.

    Leader:
        Có thể gửi Knowledge vào nhóm mình quản lý.

    Member:
        Chỉ có thể gửi Knowledge vào nhóm mình tham gia.
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

    # Owner được phép truy cập mọi nhóm thuộc dự án.
    if is_owner:
        return

    # Leader được phép truy cập nhóm mình quản lý,
    # kể cả khi chưa có bản ghi GroupMember.
    if group.leader_id == user_id:
        return

    # Member phải có bản ghi tham gia nhóm.
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
# 3. Thành viên gửi Knowledge mới
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
    permissions = await get_project_permissions(
        db=db,
        project_id=project_id,
        user_id=current_user.id,
    )

    is_owner = permissions["is_owner"]

    # Nếu Knowledge thuộc một nhóm cụ thể,
    # kiểm tra quyền truy cập nhóm.
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
# 4. Xem danh sách Knowledge
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
    permissions = await get_project_permissions(
        db=db,
        project_id=project_id,
        user_id=current_user.id,
    )

    # -------------------------------------------------
    # Owner: xem toàn bộ Knowledge trong dự án.
    # -------------------------------------------------

    if permissions["is_owner"]:
        query = select(AIKnowledgeItem).where(
            AIKnowledgeItem.project_id == project_id
        )

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

    # -------------------------------------------------
    # Leader / Member:
    # Chỉ xem Knowledge đã duyệt và được chia sẻ.
    # -------------------------------------------------

    else:
        accessible_group_ids = (
            permissions["accessible_group_ids"]
        )

        query = (
            select(AIKnowledgeItem)
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

    query = query.order_by(
        AIKnowledgeItem.created_at.desc()
    )

    result = await db.execute(query)

    return result.scalars().all()


# =====================================================
# 5. Owner duyệt hoặc từ chối Knowledge
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
    permissions = await get_project_permissions(
        db=db,
        project_id=project_id,
        user_id=current_user.id,
    )

    # Chỉ Owner thực sự mới được duyệt Knowledge.
    if not permissions["is_owner"]:
        raise HTTPException(
            status_code=403,
            detail="Chỉ Owner mới được duyệt Knowledge",
        )

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

    knowledge.status = payload.status

    if payload.status == "approved":
        knowledge.approved_by = current_user.id
        knowledge.approved_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(knowledge)

    return knowledge


# =====================================================
# 6. Owner thay đổi phạm vi chia sẻ Knowledge
# =====================================================

@router.patch(
    "/{knowledge_id}/sharing",
    response_model=AIKnowledgeSharingResponse,
)
async def update_knowledge_sharing(
    project_id: uuid.UUID,
    knowledge_id: uuid.UUID,
    payload: AIKnowledgeSharingUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Owner thay đổi phạm vi chia sẻ Knowledge.

    Các phạm vi:
        owner_private:
            Chỉ Owner được đọc.

        project_shared:
            Các AI trong phạm vi dự án được đọc.

        group_shared:
            Chỉ các AI có quyền truy cập nhóm được đọc.
    """

    permissions = await get_project_permissions(
        db=db,
        project_id=project_id,
        user_id=current_user.id,
    )

    if not permissions["is_owner"]:
        raise HTTPException(
            status_code=403,
            detail="Chỉ Owner mới được thay đổi phạm vi chia sẻ.",
        )

    knowledge_result = await db.execute(
        select(AIKnowledgeItem).where(
            AIKnowledgeItem.id == knowledge_id,
            AIKnowledgeItem.project_id == project_id,
        )
    )

    knowledge = knowledge_result.scalar_one_or_none()

    if knowledge is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy Knowledge trong dự án.",
        )

    if knowledge.status != "approved":
        raise HTTPException(
            status_code=409,
            detail="Chỉ Knowledge đã duyệt mới được chia sẻ.",
        )

    # Kiểm tra group_id.
    if payload.scope == "group_shared":

        if payload.group_id is None:
            raise HTTPException(
                status_code=422,
                detail="Phải chọn nhóm khi chia sẻ theo nhóm.",
            )

        await validate_group_access(
            db=db,
            project_id=project_id,
            group_id=payload.group_id,
            user_id=current_user.id,
            is_owner=True,
        )

    elif payload.group_id is not None:
        raise HTTPException(
            status_code=422,
            detail="Không được truyền group_id cho phạm vi này.",
        )

    # Tìm bản ghi chia sẻ hiện tại.
    result = await db.execute(
        select(AIKnowledgeShare)
        .where(
            AIKnowledgeShare.knowledge_id == knowledge_id,
            AIKnowledgeShare.project_id == project_id,
        )
        .with_for_update()
    )

    sharing = result.scalar_one_or_none()

    if sharing is None:
        sharing = AIKnowledgeShare(
            knowledge_id=knowledge_id,
            project_id=project_id,
            scope=payload.scope,
            group_id=payload.group_id,
            updated_by=current_user.id,
        )

        db.add(sharing)

    else:
        sharing.scope = payload.scope
        sharing.group_id = payload.group_id
        sharing.updated_by = current_user.id

    await db.commit()
    await db.refresh(sharing)

    return sharing
