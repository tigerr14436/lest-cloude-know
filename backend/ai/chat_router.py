
"""API quản lý hội thoại riêng tư của Project AI."""

import uuid
from datetime import datetime, timezone
from ai.services.ai_service import ProjectAIService
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User, ProjectMember
from auth_deps import get_current_user

from ai.models import AIConversation, AIMessage
from ai.schemas import (
    AIConversationCreate,
    AIConversationResponse,
    AIMessageResponse,
    AIChatSendRequest,
)


router = APIRouter(
    prefix="/api/projects/{project_id}/ai/conversations",
    tags=["Project AI Chat"],
)


# =====================================================
# Kiểm tra người dùng thuộc dự án
# =====================================================

async def check_project_member(
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
# Kiểm tra quyền sở hữu hội thoại
# =====================================================

async def get_owned_conversation(
    db: AsyncSession,
    project_id: uuid.UUID,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
):
    result = await db.execute(
        select(AIConversation).where(
            AIConversation.id == conversation_id,
            AIConversation.project_id == project_id,
            AIConversation.user_id == user_id,
        )
    )

    conversation = result.scalar_one_or_none()

    if conversation is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy cuộc hội thoại",
        )

    return conversation


# =====================================================
# 1. Tạo cuộc hội thoại
# =====================================================

@router.post(
    "",
    response_model=AIConversationResponse,
    status_code=201,
)
async def create_conversation(
    project_id: uuid.UUID,
    payload: AIConversationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_project_member(
        db,
        project_id,
        current_user.id,
    )

    title = payload.title.strip() or "Cuộc trò chuyện mới"

    conversation = AIConversation(
        project_id=project_id,
        user_id=current_user.id,
        title=title,
    )

    db.add(conversation)

    await db.commit()
    await db.refresh(conversation)

    return conversation


# =====================================================
# 2. Danh sách hội thoại của người dùng
# =====================================================

@router.get(
    "",
    response_model=list[AIConversationResponse],
)
async def get_conversations(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_project_member(
        db,
        project_id,
        current_user.id,
    )

    result = await db.execute(
        select(AIConversation)
        .where(
            AIConversation.project_id == project_id,
            AIConversation.user_id == current_user.id,
        )
        .order_by(desc(AIConversation.updated_at))
    )

    return result.scalars().all()


# =====================================================
# 3. Lấy lịch sử tin nhắn
# =====================================================

@router.get(
    "/{conversation_id}/messages",
    response_model=list[AIMessageResponse],
)
async def get_conversation_messages(
    project_id: uuid.UUID,
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_project_member(
        db,
        project_id,
        current_user.id,
    )

    conversation = await get_owned_conversation(
        db,
        project_id,
        conversation_id,
        current_user.id,
    )

    result = await db.execute(
        select(AIMessage)
        .where(
            AIMessage.conversation_id == conversation.id
        )
        .order_by(AIMessage.created_at.asc())
    )

    return result.scalars().all()

# =====================================================
# 4. Gửi tin nhắn cho Project AI
# =====================================================

@router.post(
    "/{conversation_id}/messages",
    response_model=AIMessageResponse,
)
async def send_message(
    project_id: uuid.UUID,
    conversation_id: uuid.UUID,
    payload: AIChatSendRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 1. Kiểm tra thành viên dự án
    await check_project_member(
        db,
        project_id,
        current_user.id,
    )

    # 2. Kiểm tra quyền sở hữu hội thoại
    conversation = await get_owned_conversation(
        db,
        project_id,
        conversation_id,
        current_user.id,
    )

    message_content = payload.message.strip()

    if not message_content:
        raise HTTPException(
            status_code=400,
            detail="Tin nhắn không được để trống",
        )

    # 3. Lấy lịch sử hội thoại gần nhất
    history_result = await db.execute(
        select(AIMessage)
        .where(
            AIMessage.conversation_id == conversation.id
        )
        .order_by(desc(AIMessage.created_at))
        .limit(10)
    )

    previous_messages = list(
        reversed(history_result.scalars().all())
    )

    history = [
        {
            "role": item.role,
            "content": item.content,
        }
        for item in previous_messages
        if item.role in {"user", "assistant"}
    ]

    # 4. Gọi AI Service
    ai_service = ProjectAIService()

    try:
        answer = await ai_service.answer(
            db=db,
            project_id=project_id,
            user_id=current_user.id,
            message=message_content,
            history=history,
        )

        if not answer or not answer.strip():
            raise ValueError("AI không trả về nội dung")

    except Exception as error:
        await db.rollback()

        print(f"Project AI error: {error}")

        raise HTTPException(
            status_code=502,
            detail="AI hiện không thể xử lý yêu cầu. Vui lòng thử lại.",
        )

    # 5. Tạo bản ghi câu hỏi của người dùng
    user_message = AIMessage(
        conversation_id=conversation.id,
        role="user",
        content=message_content,
    )

    # 6. Tạo bản ghi câu trả lời của AI
    assistant_message = AIMessage(
        conversation_id=conversation.id,
        role="assistant",
        content=answer,
    )

    db.add_all([
        user_message,
        assistant_message,
    ])

    # 7. Cập nhật thời gian hội thoại
    conversation.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(assistant_message)

    # 8. Trả câu trả lời về frontend
    return assistant_message