
"""Pydantic schemas cho Project AI Profile."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from typing import Literal


KnowledgeType = Literal[
    "general",
    "requirement",
    "decision",
    "workflow",
    "technical",
    "meeting_note",
]


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
