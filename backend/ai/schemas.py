
"""Pydantic schemas cho Project AI Profile."""

from datetime import datetime
from uuid import UUID
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


KnowledgeType = Literal[
    "general",
    "requirement",
    "decision",
    "workflow",
    "technical",
    "meeting_note",
]

SubtaskPriority = Literal["low", "medium", "high"]
ProposalStatus = Literal["pending", "confirmed", "rejected"]


class AIProjectProfileBase(BaseModel):
    project_goal: str | None = None
    project_domain: str | None = Field(default=None, max_length=255)
    project_overview: str | None = None
    tech_stack: str | None = None
    working_rules: str | None = None
    owner_expectations: str | None = None


class AIProjectProfileUpdate(AIProjectProfileBase):
    """Dữ liệu Owner gửi khi tạo hoặc cập nhật Profile."""
    pass


class AIProjectProfileResponse(AIProjectProfileBase):
    """Dữ liệu Profile trả về frontend."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    updated_by: UUID | None = None
    created_at: datetime
    updated_at: datetime


class AIKnowledgeCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1)
    knowledge_type: KnowledgeType = "general"
    group_id: UUID | None = None


class AIKnowledgeReview(BaseModel):
    status: Literal["approved", "rejected"]


class AIKnowledgeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    group_id: UUID | None = None
    title: str
    content: str
    knowledge_type: str
    status: str
    created_by: UUID
    approved_by: UUID | None = None
    approved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class AIConversationCreate(BaseModel):
    title: str = Field(
        default="Cuộc trò chuyện mới",
        max_length=255,
    )


class AIConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    user_id: UUID
    title: str
    created_at: datetime
    updated_at: datetime


class AIMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    conversation_id: UUID
    role: str
    content: str
    sources: dict | list | None = None
    created_at: datetime


class AIChatSendRequest(BaseModel):
    message: str = Field(
        min_length=1,
        max_length=10000,
    )


class AISubtaskProposalItem(BaseModel):
    """Một Subtask do AI đề xuất."""

    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    priority: SubtaskPriority = "medium"


class AISubtaskProposalResponse(BaseModel):
    """Thông tin đề xuất Subtask."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    conversation_id: UUID
    message_id: UUID
    user_id: UUID
    project_id: UUID
    task_id: UUID
    group_id: UUID
    items: list[AISubtaskProposalItem]
    status: ProposalStatus
    created_subtask_ids: list[UUID] | None = None
    created_at: datetime
    confirmed_at: datetime | None = None
    rejected_at: datetime | None = None


class AISubtaskProposalUpdate(BaseModel):
    """Nội dung người dùng chỉnh sửa trước khi xác nhận."""

    items: list[AISubtaskProposalItem] = Field(
        min_length=1,
        max_length=20,
    )


class AISubtaskProposalActionResponse(BaseModel):
    """Kết quả xác nhận hoặc từ chối đề xuất."""

    proposal_id: UUID
    status: Literal["confirmed", "rejected"]
    created_subtask_ids: list[UUID] = Field(default_factory=list)
    message: str

class AIKnowledgeSharingUpdate(BaseModel):
    scope: Literal[
        "owner_private",
        "project_shared",
        "group_shared",
    ]

    group_id: UUID | None = None


class AIKnowledgeSharingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    knowledge_id: UUID
    project_id: UUID
    scope: str
    group_id: UUID | None = None
    updated_by: UUID | None = None
    updated_at: datetime