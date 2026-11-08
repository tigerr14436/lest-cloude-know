"""Pydantic schemas dành riêng cho Owner AI."""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
)


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

# Chuỗi bắt buộc: tự cắt khoảng trắng hai đầu, không được rỗng.
RequiredText = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        min_length=1,
    ),
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
# PROJECT SETUP PAYLOAD EDIT
# =========================================================
# Dùng cho API PATCH .../proposals/{proposal_id}/payload.
#
# Schema chỉ kiểm tra HÌNH DẠNG dữ liệu.
# Các kiểm tra cần DB hoặc nghiệp vụ (thành viên dự án,
# group_key khớp key nhóm, giới hạn số lượng...) được
# thực hiện ở router.
#
# extra="allow": giữ nguyên các field phụ mà AI hoặc
# executor có thể đang dùng, tránh làm mất dữ liệu.

def _blank_to_none(value):
    """Chuỗi rỗng hoặc chỉ có khoảng trắng -> None."""

    if isinstance(value, str):
        value = value.strip()

        if not value:
            return None

    return value


class OwnerAIProjectSetupGroup(BaseModel):
    """Một nhóm trong đề xuất project_setup_create."""

    model_config = ConfigDict(extra="allow")

    name: RequiredText
    key: RequiredText

    # UUID thành viên hợp lệ trong dự án, hoặc None.
    leader_id: UUID | None = None

    @field_validator("leader_id", mode="before")
    @classmethod
    def normalize_leader_id(cls, value):
        return _blank_to_none(value)


class OwnerAIProjectSetupTask(BaseModel):
    """Một task trong đề xuất project_setup_create."""

    model_config = ConfigDict(extra="allow")

    title: RequiredText
    description: str | None = None
    priority: str | None = None
    deadline: str | None = None

    # Phải khớp với key của một nhóm (router kiểm tra).
    group_key: str | None = None

    # UUID thành viên hợp lệ trong dự án, hoặc None.
    assignee_id: UUID | None = None

    @field_validator(
        "description",
        "priority",
        "deadline",
        "group_key",
        "assignee_id",
        mode="before",
    )
    @classmethod
    def normalize_optional_values(cls, value):
        return _blank_to_none(value)

    @field_validator("priority", mode="after")
    @classmethod
    def lowercase_priority(cls, value):
        return value.lower() if value else value


class OwnerAIProjectSetupPayload(BaseModel):
    """Payload đầy đủ của đề xuất project_setup_create."""

    model_config = ConfigDict(extra="allow")

    groups: list[OwnerAIProjectSetupGroup]
    tasks: list[OwnerAIProjectSetupTask]


class OwnerAIProposalPayloadUpdateRequest(BaseModel):
    """Owner gửi payload đã chỉnh sửa của một đề xuất."""

    payload: OwnerAIProjectSetupPayload


class OwnerAIChatResponse_PLACEHOLDER_REMOVED:
    pass


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