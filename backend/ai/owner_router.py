
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
    OwnerAIExecutionLog,
)

from ai.owner_schemas import (
    OwnerAIConversationCreate,
    OwnerAIConversationResponse,
    OwnerAIChatSendRequest,
    OwnerAIMessageResponse,
    OwnerAIActionProposalResponse,
    OwnerAIProposalReviewRequest,
    OwnerAIExecutionResponse,
    OwnerAIExecutionLogResponse,
)

from ai.services.permission_service import (
    get_project_ai_permissions,
)

from ai.services.owner_ai_service import OwnerAIService
from ai.services.owner_action_executor import OwnerAIActionExecutor


router = APIRouter(
    prefix="/api/projects/{project_id}/owner-ai/conversations",
    tags=["Owner AI"],
)


# =====================================================
# CONSTANTS
# =====================================================

ALLOWED_OWNER_ACTIONS = {
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


# =====================================================
# COMMON HELPERS
# =====================================================

def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def serialize_json_value(value):
    """
    Chuyển dữ liệu UUID và datetime về dạng JSON-compatible.
    """

    if isinstance(value, uuid.UUID):
        return str(value)

    if isinstance(value, datetime):
        return value.isoformat()

    if isinstance(value, dict):
        return {
            str(key): serialize_json_value(item)
            for key, item in value.items()
        }

    if isinstance(value, list):
        return [
            serialize_json_value(item)
            for item in value
        ]

    return value


def validate_proposal_payload(
    action_type: str,
    proposal_payload,
):
    """
    Kiểm tra cấu trúc payload trước khi lưu proposal.

    Validation nghiệp vụ chi tiết vẫn được thực hiện
    trong OwnerAIService và OwnerAIActionExecutor.
    """

    if action_type not in ALLOWED_OWNER_ACTIONS:
        raise HTTPException(
            status_code=422,
            detail="Loại hành động Owner AI không được hỗ trợ.",
        )

    if action_type == "task_create":

        if isinstance(proposal_payload, dict):
            if not proposal_payload:
                raise HTTPException(
                    status_code=422,
                    detail="Payload tạo Task không được để trống.",
                )

            return

        if isinstance(proposal_payload, list):

            if not proposal_payload:
                raise HTTPException(
                    status_code=422,
                    detail="Danh sách Task không được để trống.",
                )

            if len(proposal_payload) > MAX_TASKS_PER_PROPOSAL:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"Một đề xuất không được vượt quá "
                        f"{MAX_TASKS_PER_PROPOSAL} Task."
                    ),
                )

            if not all(
                isinstance(item, dict)
                for item in proposal_payload
            ):
                raise HTTPException(
                    status_code=422,
                    detail="Danh sách Task chứa dữ liệu không hợp lệ.",
                )

            return

        raise HTTPException(
            status_code=422,
            detail="Payload tạo Task không hợp lệ.",
        )

    # Các hành động khác sử dụng payload dạng object.
    if not isinstance(proposal_payload, dict):
        raise HTTPException(
            status_code=422,
            detail="Payload đề xuất phải là object.",
        )

    if not proposal_payload:
        raise HTTPException(
            status_code=422,
            detail="Payload đề xuất không được để trống.",
        )

    if action_type == "project_setup_create":

        groups = proposal_payload.get("groups")
        tasks = proposal_payload.get("tasks")

        if not isinstance(groups, list) or not groups:
            raise HTTPException(
                status_code=422,
                detail="Đề xuất tạo dự án phải có ít nhất một nhóm.",
            )

        if len(groups) > 10:
            raise HTTPException(
                status_code=422,
                detail="Một lần chỉ được tạo tối đa 10 nhóm.",
            )

        if not isinstance(tasks, list) or not tasks:
            raise HTTPException(
                status_code=422,
                detail="Đề xuất tạo nhóm phải có ít nhất một Task.",
            )

        if len(tasks) > MAX_TASKS_PER_PROPOSAL:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Một lần chỉ được tạo tối đa "
                    f"{MAX_TASKS_PER_PROPOSAL} Task."
                ),
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

    if not permissions or not permissions.get("is_owner"):
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
        await db.rollback()

        raise HTTPException(
            status_code=403,
            detail="Bạn không có quyền sử dụng Owner AI.",
        )

    except ValueError as error:
        await db.rollback()

        raise HTTPException(
            status_code=422,
            detail=str(error),
        )

    except Exception as error:
        await db.rollback()

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

    action_type = None
    proposal_payload = None

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

        validate_proposal_payload(
            action_type,
            proposal_payload,
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
                payload=serialize_json_value(
                    proposal_payload
                ),
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

        conversation.updated_at = utc_now()

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


# =====================================================
# 10. OWNER DUYỆT HOẶC TỪ CHỐI ĐỀ XUẤT
# =====================================================

@router.post(
    "/{conversation_id}/proposals/{proposal_id}/review",
    response_model=OwnerAIActionProposalResponse,
)
async def review_owner_proposal(
    project_id: uuid.UUID,
    conversation_id: uuid.UUID,
    proposal_id: uuid.UUID,
    payload: OwnerAIProposalReviewRequest,
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
        lock=True,
    )

    if proposal.status != "pending":
        raise HTTPException(
            status_code=409,
            detail=(
                "Chỉ đề xuất đang chờ duyệt mới có thể "
                "được duyệt hoặc từ chối."
            ),
        )

    proposal.status = (
        "approved"
        if payload.action == "approve"
        else "rejected"
    )

    proposal.reviewed_by = current_user.id
    proposal.reviewed_at = utc_now()

    try:
        await db.commit()
        await db.refresh(proposal)

        return proposal

    except Exception as error:
        await db.rollback()

        print(f"Review Owner AI proposal error: {error}")

        raise HTTPException(
            status_code=500,
            detail="Không thể cập nhật trạng thái đề xuất.",
        )


# =====================================================
# 11. OWNER THỰC THI ĐỀ XUẤT ĐÃ DUYỆT
# =====================================================

@router.post(
    "/{conversation_id}/proposals/{proposal_id}/execute",
    response_model=OwnerAIExecutionResponse,
)
async def execute_owner_proposal(
    project_id: uuid.UUID,
    conversation_id: uuid.UUID,
    proposal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # -------------------------------------------------
    # 11.1. KIỂM TRA QUYỀN OWNER
    # -------------------------------------------------

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

    # -------------------------------------------------
    # 11.2. KHÓA PROPOSAL
    # -------------------------------------------------

    proposal = await get_owned_proposal(
        db,
        project_id,
        conversation_id,
        proposal_id,
        current_user.id,
        lock=True,
    )

    if proposal.status != "approved":
        raise HTTPException(
            status_code=409,
            detail=(
                "Đề xuất phải được Owner duyệt trước khi thực thi. "
                f"Trạng thái hiện tại: {proposal.status}."
            ),
        )

    action_type = proposal.action_type

    request_payload = serialize_json_value(
        proposal.payload
    )

    executor = OwnerAIActionExecutor(db)

    # -------------------------------------------------
    # 11.3. THỰC THI ACTION
    # -------------------------------------------------

    try:
        result = await executor.execute(
            proposal=proposal,
            owner_id=current_user.id,
        )

        if not isinstance(result, dict):
            result = {
                "data": str(result),
            }

        result = serialize_json_value(result)

        proposal.status = "executed"
        proposal.result = result
        proposal.executed_at = utc_now()

        execution_log = OwnerAIExecutionLog(
            proposal_id=proposal.id,
            project_id=project_id,
            owner_id=current_user.id,
            action_type=action_type,
            status="success",
            request_payload=request_payload,
            result=result,
            error_message=None,
        )

        db.add(execution_log)

        # Dữ liệu nghiệp vụ, proposal và log cùng transaction.
        await db.commit()

        return OwnerAIExecutionResponse(
            proposal_id=proposal_id,
            status="executed",
            result=result,
            message="Đề xuất đã được thực thi thành công.",
        )

    except Exception as error:

        # -------------------------------------------------
        # 11.4. ROLLBACK DỮ LIỆU NGHIỆP VỤ
        # -------------------------------------------------

        await db.rollback()

        print(f"Owner AI execution error: {error}")

        if isinstance(error, HTTPException):
            error_message = str(error.detail)

        elif isinstance(error, ValueError):
            error_message = str(error)

        else:
            error_message = "Backend không thể thực thi đề xuất."

        # -------------------------------------------------
        # 11.5. GHI NHẬN THẤT BẠI
        # -------------------------------------------------

        try:
            failed_proposal = await get_owned_proposal(
                db,
                project_id,
                conversation_id,
                proposal_id,
                current_user.id,
                lock=True,
            )

            if failed_proposal.status == "approved":

                failed_proposal.status = "failed"

                failed_proposal.result = {
                    "error": error_message,
                }

                failed_log = OwnerAIExecutionLog(
                    proposal_id=failed_proposal.id,
                    project_id=project_id,
                    owner_id=current_user.id,
                    action_type=action_type,
                    status="failed",
                    request_payload=request_payload,
                    result=None,
                    error_message=error_message,
                )

                db.add(failed_log)

                await db.commit()

            else:
                await db.rollback()

        except Exception as log_error:
            await db.rollback()

            print(
                "Owner AI failed execution log error: "
                f"{log_error}"
            )

            raise HTTPException(
                status_code=500,
                detail=(
                    "Thực thi thất bại và Backend không thể "
                    "ghi nhật ký xử lý."
                ),
            )

        return OwnerAIExecutionResponse(
            proposal_id=proposal_id,
            status="failed",
            result=None,
            message=error_message,
        )


# =====================================================
# 12. LỊCH SỬ THỰC THI OWNER AI
# =====================================================

@router.get(
    "/{conversation_id}/execution-logs",
    response_model=list[OwnerAIExecutionLogResponse],
)
async def list_owner_execution_logs(
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

    proposal_ids_result = await db.execute(
        select(OwnerAIActionProposal.id).where(
            OwnerAIActionProposal.conversation_id == conversation.id,
            OwnerAIActionProposal.project_id == project_id,
            OwnerAIActionProposal.owner_id == current_user.id,
        )
    )

    proposal_ids = proposal_ids_result.scalars().all()

    if not proposal_ids:
        return []

    result = await db.execute(
        select(OwnerAIExecutionLog)
        .where(
            OwnerAIExecutionLog.proposal_id.in_(proposal_ids),
            OwnerAIExecutionLog.project_id == project_id,
            OwnerAIExecutionLog.owner_id == current_user.id,
        )
        .order_by(
            OwnerAIExecutionLog.created_at.desc()
        )
    )

    return result.scalars().all()
