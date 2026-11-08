
"""Pydantic schemas dành riêng cho Owner AI."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# =========================================================
# TYPES
# =========================================================

OwnerAIActionType = Literal[
    "task_create",
    "task_update",
    "group_create",
    "group_update",
    "member_invite",
    "member_role_update",
    "weekly_schedule_create",
    "project_setup_create",
]

OwnerAIProposalStatus = Literal[
    "pending",
    "approved",
    "rejected",
    "executed",
    "failed",
]

OwnerAIExecutionStatus = Literal[
    "success",
    "failed",
]


# =========================================================
# CONVERSATION
# =========================================================

class OwnerAIConversationCreate(BaseModel):
    """Tạo cuộc trò chuyện Owner AI."""

    title: str = Field(
        default="Cuộc trò chuyện Owner AI mới",
        min_length=1,
        max_length=255,
    )


class OwnerAIConversationResponse(BaseModel):
    """Thông tin cuộc trò chuyện."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    owner_id: UUID
    title: str
    created_at: datetime
    updated_at: datetime


# =========================================================
# MESSAGE
# =========================================================

class OwnerAIMessageResponse(BaseModel):
    """Tin nhắn trong cuộc trò chuyện."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    conversation_id: UUID
    role: str
    content: str

    # Nguồn dữ liệu có thể là JSON object hoặc array.
    sources: dict | list | None = None

    created_at: datetime


class OwnerAIChatSendRequest(BaseModel):
    """Nội dung Owner gửi cho AI."""

    message: str = Field(
        min_length=1,
        max_length=10000,
    )


# =========================================================
# ACTION PROPOSAL
# =========================================================

class OwnerAIActionProposalResponse(BaseModel):
    """Đề xuất hành động do Owner AI tạo."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    conversation_id: UUID
    message_id: UUID
    project_id: UUID
    owner_id: UUID

    action_type: OwnerAIActionType

    # JSONB có thể chứa object hoặc array.
    # Ví dụ:
    # - task_create: object hoặc danh sách task.
    # - group_create: object hoặc danh sách group.
    # - project_setup_create: object gồm groups và tasks.
    payload: dict | list

    status: OwnerAIProposalStatus

    result: dict | None = None

    reviewed_by: UUID | None = None
    reviewed_at: datetime | None = None
    executed_at: datetime | None = None

    created_at: datetime
    updated_at: datetime


class OwnerAIProposalReviewRequest(BaseModel):
    """Owner quyết định duyệt hoặc từ chối đề xuất."""

    action: Literal[
        "approve",
        "reject",
    ]


class OwnerAIChatResponse(BaseModel):
    """Kết quả sau khi Owner gửi tin nhắn."""

    message: OwnerAIMessageResponse

    proposal: OwnerAIActionProposalResponse | None = None


# =========================================================
# EXECUTION
# =========================================================

class OwnerAIExecutionResponse(BaseModel):
    """Kết quả thực hiện một đề xuất."""

    proposal_id: UUID

    status: Literal[
        "executed",
        "failed",
    ]

    result: dict | None = None

    message: str


# =========================================================
# EXECUTION LOG
# =========================================================

class OwnerAIExecutionLogResponse(BaseModel):
    """Lịch sử thực hiện hành động của Owner AI."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID

    proposal_id: UUID | None = None

    project_id: UUID
    owner_id: UUID

    action_type: OwnerAIActionType

    status: OwnerAIExecutionStatus

    # Sửa lỗi ResponseValidationError:
    # request_payload trong PostgreSQL JSONB có thể là object
    # hoặc danh sách các task/group.
    request_payload: dict | list | None = None

    result: dict | None = None

    error_message: str | None = None

    created_at: datetime
