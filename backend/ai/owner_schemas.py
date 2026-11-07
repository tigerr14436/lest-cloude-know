
"""Pydantic schemas dành riêng cho Owner AI."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
)


OwnerAIMessageRole = Literal["user", "assistant"]

OwnerAIProposalStatus = Literal[
    "pending",
    "approved",
    "rejected",
    "executed",
    "failed",
]

OwnerAIActionType = Literal[
    "task_create",
    "group_create",
    "member_invite",
    "weekly_schedule_create",
]


class OwnerAIConversationCreate(BaseModel):
    title: str = Field(
        default="Cuộc trò chuyện Owner AI mới",
        min_length=1,
        max_length=255,
    )


class OwnerAIConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    owner_id: UUID
    title: str
    created_at: datetime
    updated_at: datetime


class OwnerAIChatSendRequest(BaseModel):
    message: str = Field(
        min_length=1,
        max_length=10000,
    )


class OwnerAIMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    conversation_id: UUID
    role: OwnerAIMessageRole
    content: str
    sources: dict | list | None = None
    created_at: datetime


class OwnerAIProposalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    conversation_id: UUID
    message_id: UUID
    project_id: UUID
    owner_id: UUID

    action_type: OwnerAIActionType
    payload: dict

    status: OwnerAIProposalStatus

    result: dict | None = None

    reviewed_by: UUID | None = None
    reviewed_at: datetime | None = None
    executed_at: datetime | None = None

    created_at: datetime
    updated_at: datetime


class OwnerAIProposalReview(BaseModel):
    """
    Owner phê duyệt hoặc từ chối đề xuất.

    Có thể gửi payload đã chỉnh sửa trước khi duyệt.
    Nếu payload không được gửi, Backend sử dụng
    payload đã lưu trong Proposal.
    """

    action: Literal["approve", "reject"]

    payload: dict | None = None


class OwnerAIExecutionLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    proposal_id: UUID | None = None
    project_id: UUID
    owner_id: UUID

    action_type: str
    status: Literal["success", "failed"]

    request_payload: dict | None = None
    result: dict | None = None
    error_message: str | None = None

    created_at: datetime
