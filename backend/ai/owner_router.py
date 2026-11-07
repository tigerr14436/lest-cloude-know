
"""API hội thoại riêng tư dành cho Owner AI."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User
from auth_deps import get_current_user

from ai.owner_models import (
    OwnerAIConversation,
    OwnerAIMessage,
    OwnerAIActionProposal,
)

from ai.owner_schemas import (
    OwnerAIConversationCreate,
    OwnerAIConversationResponse,
    OwnerAIChatSendRequest,
    OwnerAIMessageResponse,
    OwnerAIActionProposalResponse,
)

from ai.services.permission_service import (
    get_project_ai_permissions,
)

from ai.services.owner_ai_service import OwnerAIService


router = APIRouter(
    prefix="/api/projects/{project_id}/owner-ai/conversations",
    tags=["Owner AI"],
)


# =====================================================
# 1. KIỂM TRA QUYỀN OWNER
# =====================================================

async def require_owner(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
):
    """Chỉ Owner thực tế của dự án được sử dụng Owner AI."""

    try:
        permissions = await get_project_ai_permissions(
            db=db,
            project_id=project_id,
            user_id=user_id,
        )

    except HTTPException:
        raise

    except Exception as exc:
        print(f"Owner AI permission error: {exc}")

        raise HTTPException(
            status_code=500,
            detail="Không thể kiểm tra quyền truy cập Owner AI.",
        )

    if not permissions.get("is_owner"):
        raise HTTPException(
            status_code=403,
            detail="Chỉ chủ dự án mới được sử dụng Owner AI.",
        )

    return permissions


# =====================================================
# 2. KIỂM TRA QUYỀN HỘI THOẠI
# =====================================================

async def get_owned_conversation(
    db: AsyncSession,
    project_id: uuid.UUID,
    conversation_id: uuid.UUID,
    owner_id: uuid.UUID,
):
    result = await db.execute(
        select(OwnerAIConversation).where(
            OwnerAIConversation.id == conversation_id,
            OwnerAIConversation.project_id == project_id,
            OwnerAIConversation.owner_id == owner_id,
        )
    )

    conversation = result.scalar_one_or_none()

    if conversation is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy cuộc hội thoại Owner AI.",
        )

    return conversation


# =====================================================
# 3. KIỂM TRA QUYỀN ĐỀ XUẤT
# =====================================================

async def get_owned_proposal(
    db: AsyncSession,
    project_id: uuid.UUID,
    conversation_id: uuid.UUID,
    proposal_id: uuid.UUID,
    owner_id: uuid.UUID,
    lock: bool = False,
):
    query = select(OwnerAIActionProposal).where(
        OwnerAIActionProposal.id == proposal_id,
        OwnerAIActionProposal.project_id == project_id,
        OwnerAIActionProposal.conversation_id == conversation_id,
        OwnerAIActionProposal.owner_id == owner_id,
    )

    if lock:
        query = query.with_for_update()

    result = await db.execute(query)

    proposal = result.scalar_one_or_none()

    if proposal is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy đề xuất Owner AI.",
        )

    return proposal


# =====================================================
# 4. TẠO CUỘC HỘI THOẠI
# =====================================================

@router.post(
    "",
    response_model=OwnerAIConversationResponse,
)
async def create_owner_conversation(
    project_id: uuid.UUID,
    payload: OwnerAIConversationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_owner(
        db,
        project_id,
        current_user.id,
    )

    title = payload.title.strip()

    if not title:
        raise HTTPException(
            status_code=422,
            detail="Tên cuộc hội thoại không được để trống.",
        )

    conversation = OwnerAIConversation(
        project_id=project_id,
        owner_id=current_user.id,
        title=title,
    )

    try:
        db.add(conversation)

        await db.commit()
        await db.refresh(conversation)

        return conversation

    except Exception as error:
        await db.rollback()

        print(f"Create Owner AI conversation error: {error}")

        raise HTTPException(
            status_code=500,
            detail="Không thể tạo cuộc hội thoại Owner AI.",
        )


# =====================================================
# 5. DANH SÁCH CUỘC HỘI THOẠI
# =====================================================

@router.get(
    "",
    response_model=list[OwnerAIConversationResponse],
)
async def list_owner_conversations(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_owner(
        db,
        project_id,
        current_user.id,
    )

    result = await db.execute(
        select(OwnerAIConversation)
        .where(
            OwnerAIConversation.project_id == project_id,
            OwnerAIConversation.owner_id == current_user.id,
        )
        .order_by(
            desc(OwnerAIConversation.updated_at)
        )
    )

    return result.scalars().all()


# =====================================================
# 6. LẤY LỊCH SỬ TIN NHẮN
# =====================================================

@router.get(
    "/{conversation_id}/messages",
    response_model=list[OwnerAIMessageResponse],
)
async def get_owner_messages(
    project_id: uuid.UUID,
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_owner(
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
        select(OwnerAIMessage)
        .where(
            OwnerAIMessage.conversation_id == conversation.id
        )
        .order_by(
            OwnerAIMessage.created_at.asc()
        )
    )

    return result.scalars().all()


# =====================================================
# 7. GỬI TIN NHẮN CHO OWNER AI
# =====================================================

@router.post(
    "/{conversation_id}/messages",
)
async def send_owner_message(
    project_id: uuid.UUID,
    conversation_id: uuid.UUID,
    payload: OwnerAIChatSendRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_owner(
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

    message_content = payload.message.strip()

    if not message_content:
        raise HTTPException(
            status_code=422,
            detail="Tin nhắn không được để trống.",
        )

    # -------------------------------------------------
    # 7.1. LẤY LỊCH SỬ HỘI THOẠI
    # -------------------------------------------------

    history_result = await db.execute(
        select(OwnerAIMessage)
        .where(
            OwnerAIMessage.conversation_id == conversation.id
        )
        .order_by(
            desc(OwnerAIMessage.created_at)
        )
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

    # -------------------------------------------------
    # 7.2. GỌI OWNER AI SERVICE
    # -------------------------------------------------

    ai_service = OwnerAIService()

    try:
        ai_result = await ai_service.answer(
            db=db,
            project_id=project_id,
            owner_id=current_user.id,
            message=message_content,
            history=history,
        )

    except PermissionError:
        raise HTTPException(
            status_code=403,
            detail="Bạn không có quyền sử dụng Owner AI.",
        )

    except ValueError as error:
        raise HTTPException(
            status_code=422,
            detail=str(error),
        )

    except Exception as error:
        print(f"Owner AI service error: {error}")

        raise HTTPException(
            status_code=502,
            detail="Owner AI hiện không thể xử lý yêu cầu.",
        )

    # -------------------------------------------------
    # 7.3. KIỂM TRA KẾT QUẢ
    # -------------------------------------------------

    if not isinstance(ai_result, dict):
        raise HTTPException(
            status_code=502,
            detail="Owner AI trả về dữ liệu không hợp lệ.",
        )

    answer_content = ai_result.get("content")
    proposal_data = ai_result.get("proposal")

    if (
        not isinstance(answer_content, str)
        or not answer_content.strip()
    ):
        raise HTTPException(
            status_code=502,
            detail="Owner AI không trả về nội dung.",
        )

    answer_content = answer_content.strip()

    # -------------------------------------------------
    # 7.4. KIỂM TRA ĐỀ XUẤT
    # -------------------------------------------------

    if proposal_data is not None:
        if not isinstance(proposal_data, dict):
            raise HTTPException(
                status_code=422,
                detail="Đề xuất Owner AI không hợp lệ.",
            )

        action_type = proposal_data.get("action_type")
        proposal_payload = proposal_data.get("payload")

        if not isinstance(action_type, str):
            raise HTTPException(
                status_code=422,
                detail="Thiếu loại hành động trong đề xuất.",
            )

        if not isinstance(proposal_payload, dict):
            raise HTTPException(
                status_code=422,
                detail="Payload đề xuất không hợp lệ.",
            )

    # -------------------------------------------------
    # 7.5. LƯU MESSAGE VÀ PROPOSAL
    # -------------------------------------------------

    try:
        user_message = OwnerAIMessage(
            conversation_id=conversation.id,
            role="user",
            content=message_content,
        )

        assistant_message = OwnerAIMessage(
            conversation_id=conversation.id,
            role="assistant",
            content=answer_content,
        )

        db.add_all([
            user_message,
            assistant_message,
        ])

        await db.flush()

        proposal = None

        if proposal_data is not None:
            proposal = OwnerAIActionProposal(
                conversation_id=conversation.id,
                message_id=assistant_message.id,
                project_id=project_id,
                owner_id=current_user.id,
                action_type=action_type,
                payload=proposal_payload,
                status="pending",
            )

            db.add(proposal)

            await db.flush()

            assistant_message.sources = {
                "type": "owner_action_proposal",
                "proposal_id": str(proposal.id),
                "action_type": proposal.action_type,
                "status": proposal.status,
            }

        conversation.updated_at = datetime.now(timezone.utc)

        await db.commit()

        await db.refresh(assistant_message)

        if proposal is not None:
            await db.refresh(proposal)

        return {
            "message": OwnerAIMessageResponse.model_validate(
                assistant_message
            ).model_dump(mode="json"),

            "proposal": (
                OwnerAIActionProposalResponse.model_validate(
                    proposal
                ).model_dump(mode="json")
                if proposal
                else None
            ),
        }

    except Exception as error:
        await db.rollback()

        print(f"Save Owner AI message error: {error}")

        raise HTTPException(
            status_code=500,
            detail="Không thể lưu tin nhắn và đề xuất Owner AI.",
        )


# =====================================================
# 8. LẤY MỘT ĐỀ XUẤT
# =====================================================

@router.get(
    "/{conversation_id}/proposals/{proposal_id}",
    response_model=OwnerAIActionProposalResponse,
)
async def get_owner_proposal(
    project_id: uuid.UUID,
    conversation_id: uuid.UUID,
    proposal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_owner(
        db,
        project_id,
        current_user.id,
    )

    await get_owned_conversation(
        db,
        project_id,
        conversation_id,
        current_user.id,
    )

    proposal = await get_owned_proposal(
        db,
        project_id,
        conversation_id,
        proposal_id,
        current_user.id,
    )

    return proposal


# =====================================================
# 9. DANH SÁCH ĐỀ XUẤT TRONG HỘI THOẠI
# =====================================================

@router.get(
    "/{conversation_id}/proposals",
    response_model=list[OwnerAIActionProposalResponse],
)
async def list_owner_proposals(
    project_id: uuid.UUID,
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_owner(
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
        select(OwnerAIActionProposal)
        .where(
            OwnerAIActionProposal.conversation_id == conversation.id,
            OwnerAIActionProposal.project_id == project_id,
            OwnerAIActionProposal.owner_id == current_user.id,
        )
        .order_by(
            OwnerAIActionProposal.created_at.desc()
        )
    )

    return result.scalars().all()
