
"""API quản lý hội thoại riêng tư và đề xuất hành động của Project AI."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User, ProjectMember
from auth_deps import get_current_user

from group_kanban import (
    Subtask,
    context as kanban_context,
    manager as kanban_manager,
    assigned_task,
)

from ai.models import (
    AIConversation,
    AIMessage,
    AIActionProposal,
)

from ai.schemas import (
    AIConversationCreate,
    AIConversationResponse,
    AIMessageResponse,
    AIChatSendRequest,
    AISubtaskProposalResponse,
    AISubtaskProposalUpdate,
    AISubtaskProposalActionResponse,
)

from ai.services.ai_service import ProjectAIService


router = APIRouter(
    prefix="/api/projects/{project_id}/ai/conversations",
    tags=["Project AI Chat"],
)


# =====================================================
# Helpers
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


async def get_owned_proposal(
    db: AsyncSession,
    project_id: uuid.UUID,
    conversation_id: uuid.UUID,
    proposal_id: uuid.UUID,
    user_id: uuid.UUID,
    lock: bool = False,
):
    query = select(AIActionProposal).where(
        AIActionProposal.id == proposal_id,
        AIActionProposal.project_id == project_id,
        AIActionProposal.conversation_id == conversation_id,
        AIActionProposal.user_id == user_id,
    )

    if lock:
        query = query.with_for_update()

    result = await db.execute(query)
    proposal = result.scalar_one_or_none()

    if proposal is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy đề xuất Subtask",
        )

    return proposal


def proposal_action_response(
    proposal: AIActionProposal,
    message: str,
):
    return AISubtaskProposalActionResponse(
        proposal_id=proposal.id,
        status=proposal.status,
        created_subtask_ids=[
            uuid.UUID(str(item))
            for item in (proposal.created_subtask_ids or [])
        ],
        message=message,
    )


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
    await check_project_member(db, project_id, current_user.id)

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
    await check_project_member(db, project_id, current_user.id)

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
    await check_project_member(db, project_id, current_user.id)

    conversation = await get_owned_conversation(
        db,
        project_id,
        conversation_id,
        current_user.id,
    )

    result = await db.execute(
        select(AIMessage)
        .where(AIMessage.conversation_id == conversation.id)
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
    await check_project_member(db, project_id, current_user.id)

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

    # Lấy 10 tin nhắn gần nhất
    history_result = await db.execute(
        select(AIMessage)
        .where(AIMessage.conversation_id == conversation.id)
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

    # Gọi AI Service
    ai_service = ProjectAIService()

    try:
        result = await ai_service.answer(
            db=db,
            project_id=project_id,
            user_id=current_user.id,
            message=message_content,
            history=history,
        )

    except Exception as error:
        print(f"Project AI error: {error}")

        raise HTTPException(
            status_code=502,
            detail="AI hiện không thể xử lý yêu cầu. Vui lòng thử lại.",
        )

    # Kiểm tra kết quả AI
    if not isinstance(result, dict):
        raise HTTPException(
            status_code=502,
            detail="AI trả về dữ liệu không hợp lệ.",
        )

    answer_content = result.get("content")
    proposal_data = result.get("proposal")

    if (
        not isinstance(answer_content, str)
        or not answer_content.strip()
    ):
        raise HTTPException(
            status_code=502,
            detail="AI không trả về nội dung.",
        )

    # Chuẩn bị dữ liệu đề xuất
    proposal_group_id = None
    proposal_task_id = None
    proposal_items = None

    if proposal_data is not None:

        if (
            not isinstance(proposal_data, dict)
            or proposal_data.get("type") != "subtask_proposal"
        ):
            raise HTTPException(
                status_code=422,
                detail="Dữ liệu đề xuất Subtask không hợp lệ.",
            )

        try:
            proposal_group_id = uuid.UUID(
                str(proposal_data["group_id"])
            )

            proposal_task_id = uuid.UUID(
                str(proposal_data["task_id"])
            )

            proposal_items = proposal_data["items"]

        except (KeyError, ValueError, TypeError):
            raise HTTPException(
                status_code=422,
                detail="Thiếu hoặc sai định dạng thông tin đề xuất.",
            )

        if (
            not isinstance(proposal_items, list)
            or not 1 <= len(proposal_items) <= 20
        ):
            raise HTTPException(
                status_code=422,
                detail="Số lượng Subtask đề xuất phải từ 1 đến 20.",
            )

        normalized_items = []

        for item in proposal_items:

            if not isinstance(item, dict):
                raise HTTPException(
                    status_code=422,
                    detail="Một Subtask trong đề xuất không hợp lệ.",
                )

            title = item.get("title")
            description = item.get("description")
            priority = item.get("priority", "medium")

            if (
                not isinstance(title, str)
                or not title.strip()
                or len(title.strip()) > 255
            ):
                raise HTTPException(
                    status_code=422,
                    detail="Tên Subtask không hợp lệ.",
                )

            if (
                description is not None
                and not isinstance(description, str)
            ):
                raise HTTPException(
                    status_code=422,
                    detail="Mô tả Subtask không hợp lệ.",
                )

            if priority not in {"low", "medium", "high"}:
                raise HTTPException(
                    status_code=422,
                    detail="Độ ưu tiên Subtask không hợp lệ.",
                )

            normalized_items.append({
                "title": title.strip(),
                "description": description,
                "priority": priority,
            })

        proposal_items = normalized_items

        # Không tin group_id/task_id do AI tự đề xuất.
        # Backend phải xác minh Task thực sự thuộc nhóm.
        await assigned_task(
            db,
            project_id,
            proposal_group_id,
            proposal_task_id,
        )

    # Lưu tin nhắn và đề xuất trong cùng transaction
    try:
        user_message = AIMessage(
            conversation_id=conversation.id,
            role="user",
            content=message_content,
        )

        assistant_message = AIMessage(
            conversation_id=conversation.id,
            role="assistant",
            content=answer_content.strip(),
        )

        db.add_all([
            user_message,
            assistant_message,
        ])

        await db.flush()

        if proposal_data is not None:

            proposal_id = uuid.uuid4()

            proposal = AIActionProposal(
                id=proposal_id,
                conversation_id=conversation.id,
                message_id=assistant_message.id,
                user_id=current_user.id,
                project_id=project_id,
                group_id=proposal_group_id,
                task_id=proposal_task_id,
                items=proposal_items,
                status="pending",
            )

            db.add(proposal)
            await db.flush()

            assistant_message.sources = {
                "type": "subtask_proposal",
                "proposal_id": str(proposal_id),
                "status": "pending",
                "group_id": str(proposal_group_id),
                "task_id": str(proposal_task_id),
                "items": proposal_items,
            }

        conversation.updated_at = datetime.now(timezone.utc)

        await db.commit()
        await db.refresh(assistant_message)

        return assistant_message

    except Exception as error:
        await db.rollback()

        print(f"Project AI database error: {error}")

        raise HTTPException(
            status_code=500,
            detail="Không thể lưu tin nhắn và đề xuất AI.",
        )


# =====================================================
# 5. Lấy một đề xuất Subtask
# =====================================================

@router.get(
    "/{conversation_id}/proposals/{proposal_id}",
    response_model=AISubtaskProposalResponse,
)
async def get_subtask_proposal(
    project_id: uuid.UUID,
    conversation_id: uuid.UUID,
    proposal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_project_member(db, project_id, current_user.id)

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
# 6. Chỉnh sửa đề xuất Subtask
# =====================================================

@router.put(
    "/{conversation_id}/proposals/{proposal_id}",
    response_model=AISubtaskProposalResponse,
)
async def update_subtask_proposal(
    project_id: uuid.UUID,
    conversation_id: uuid.UUID,
    proposal_id: uuid.UUID,
    payload: AISubtaskProposalUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_project_member(db, project_id, current_user.id)

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
        lock=True,
    )

    if proposal.status != "pending":
        raise HTTPException(
            status_code=409,
            detail="Chỉ có thể chỉnh sửa đề xuất đang chờ xác nhận.",
        )

    normalized_items = []

    for item in payload.items:
        title = item.title.strip()

        if not title:
            raise HTTPException(
                status_code=422,
                detail="Tên Subtask không được để trống.",
            )

        normalized_items.append({
            "title": title,
            "description": item.description,
            "priority": item.priority,
        })

    try:
        proposal.items = normalized_items

        await db.commit()
        await db.refresh(proposal)

        return proposal

    except Exception as error:
        await db.rollback()

        print(f"Update proposal error: {error}")

        raise HTTPException(
            status_code=500,
            detail="Không thể cập nhật đề xuất Subtask.",
        )


# =====================================================
# 7. Xác nhận đề xuất và tạo Subtask
# =====================================================

@router.post(
    "/{conversation_id}/proposals/{proposal_id}/confirm",
    response_model=AISubtaskProposalActionResponse,
)
async def confirm_subtask_proposal(
    project_id: uuid.UUID,
    conversation_id: uuid.UUID,
    proposal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_project_member(db, project_id, current_user.id)

    await get_owned_conversation(
        db,
        project_id,
        conversation_id,
        current_user.id,
    )

    try:
        # Khóa đề xuất để tránh hai request xác nhận đồng thời.
        proposal = await get_owned_proposal(
            db,
            project_id,
            conversation_id,
            proposal_id,
            current_user.id,
            lock=True,
        )

        # Đã xác nhận trước đó: trả lại ID cũ, không tạo trùng.
        if proposal.status == "confirmed":
            return proposal_action_response(
                proposal,
                "Đề xuất đã được xác nhận trước đó.",
            )

        if proposal.status == "rejected":
            raise HTTPException(
                status_code=409,
                detail="Đề xuất này đã bị từ chối.",
            )

        if proposal.status != "pending":
            raise HTTPException(
                status_code=409,
                detail="Trạng thái đề xuất không hợp lệ.",
            )

        # Kiểm tra quyền Owner / Leader
        owner, leader = await kanban_context(
            db,
            project_id,
            proposal.group_id,
            current_user.id,
        )

        kanban_manager(owner, leader)

        # Kiểm tra lại Task vẫn thuộc nhóm
        await assigned_task(
            db,
            project_id,
            proposal.group_id,
            proposal.task_id,
        )

        if (
            not isinstance(proposal.items, list)
            or not 1 <= len(proposal.items) <= 20
        ):
            raise HTTPException(
                status_code=422,
                detail="Danh sách Subtask trong đề xuất không hợp lệ.",
            )

        created_subtasks = []

        # Chỉ dùng dữ liệu đã lưu trong Database.
        for item in proposal.items:

            if not isinstance(item, dict):
                raise HTTPException(
                    status_code=422,
                    detail="Dữ liệu Subtask không hợp lệ.",
                )

            title = item.get("title")
            description = item.get("description")
            priority = item.get("priority", "medium")

            if (
                not isinstance(title, str)
                or not title.strip()
                or len(title.strip()) > 255
            ):
                raise HTTPException(
                    status_code=422,
                    detail="Tên Subtask không hợp lệ.",
                )

            if (
                description is not None
                and not isinstance(description, str)
            ):
                raise HTTPException(
                    status_code=422,
                    detail="Mô tả Subtask không hợp lệ.",
                )

            if priority not in {"low", "medium", "high"}:
                raise HTTPException(
                    status_code=422,
                    detail="Độ ưu tiên Subtask không hợp lệ.",
                )

            subtask = Subtask(
                group_id=proposal.group_id,
                task_id=proposal.task_id,
                title=title.strip(),
                description=description,
                status="todo",
                priority=priority,
                assignee_id=None,
            )

            db.add(subtask)
            created_subtasks.append(subtask)

        # Flush để Database sinh ID cho các Subtask.
        await db.flush()

        created_ids = [
            str(subtask.id)
            for subtask in created_subtasks
        ]

        proposal.status = "confirmed"
        proposal.created_subtask_ids = created_ids
        proposal.confirmed_at = datetime.now(timezone.utc)

        # Tất cả Subtask và trạng thái proposal commit cùng nhau.
        await db.commit()
        await db.refresh(proposal)

        return proposal_action_response(
            proposal,
            "Đã xác nhận đề xuất và tạo Subtask thành công.",
        )

    except HTTPException:
        await db.rollback()
        raise

    except Exception as error:
        await db.rollback()

        print(f"Confirm proposal error: {error}")

        raise HTTPException(
            status_code=500,
            detail="Không thể xác nhận và tạo Subtask.",
        )


# =====================================================
# 8. Từ chối đề xuất Subtask
# =====================================================

@router.post(
    "/{conversation_id}/proposals/{proposal_id}/reject",
    response_model=AISubtaskProposalActionResponse,
)
async def reject_subtask_proposal(
    project_id: uuid.UUID,
    conversation_id: uuid.UUID,
    proposal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_project_member(db, project_id, current_user.id)

    await get_owned_conversation(
        db,
        project_id,
        conversation_id,
        current_user.id,
    )

    try:
        proposal = await get_owned_proposal(
            db,
            project_id,
            conversation_id,
            proposal_id,
            current_user.id,
            lock=True,
        )

        if proposal.status == "confirmed":
            raise HTTPException(
                status_code=409,
                detail="Không thể từ chối đề xuất đã xác nhận.",
            )

        if proposal.status == "rejected":
            return proposal_action_response(
                proposal,
                "Đề xuất đã bị từ chối trước đó.",
            )

        if proposal.status != "pending":
            raise HTTPException(
                status_code=409,
                detail="Trạng thái đề xuất không hợp lệ.",
            )

        proposal.status = "rejected"
        proposal.rejected_at = datetime.now(timezone.utc)

        await db.commit()
        await db.refresh(proposal)

        return proposal_action_response(
            proposal,
            "Đã từ chối đề xuất Subtask.",
        )

    except HTTPException:
        await db.rollback()
        raise

    except Exception as error:
        await db.rollback()

        print(f"Reject proposal error: {error}")

        raise HTTPException(
            status_code=500,
            detail="Không thể từ chối đề xuất Subtask.",
        )
