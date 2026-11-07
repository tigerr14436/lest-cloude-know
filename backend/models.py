
"""SQLAlchemy models và Pydantic schemas cho DevTask (có xác minh email OTP)."""

import uuid
from datetime import datetime, date
from typing import Optional

from sqlalchemy import (
    Boolean,
    Integer,
    Float,
    String,
    Text,
    Date,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from pydantic import BaseModel, Field, EmailStr, model_validator

from database import Base


# =========================================================
# USER
# =========================================================

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
        index=True
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    name_tag: Mapped[Optional[str]] = mapped_column(
        String(5),
        nullable=True,
        unique=True,
        index=True
    )

    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )


# =========================================================
# EMAIL VERIFICATION
# =========================================================

class EmailVerification(Base):
    __tablename__ = "email_verifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False
    )

    code_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False
    )

    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False
    )

    attempts: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0
    )


# =========================================================
# PROJECT
# =========================================================

class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )

    start_date: Mapped[Optional[date]] = mapped_column(
        Date,
        nullable=True
    )

    end_date: Mapped[Optional[date]] = mapped_column(
        Date,
        nullable=True
    )

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )

    join_code: Mapped[str] = mapped_column(
        String(20),
        unique=True,
        nullable=False,
        index=True
    )

    status: Mapped[str] = mapped_column(
        String(50),
        default="active"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )


# =========================================================
# PROJECT MEMBER
# =========================================================

class ProjectMember(Base):
    __tablename__ = "project_members"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id"),
        nullable=False
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )

    role: Mapped[str] = mapped_column(
        String(50),
        default="member"
    )


# =========================================================
# TASK
# =========================================================

class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id"),
        nullable=False
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )

    status: Mapped[str] = mapped_column(
        String(50),
        default="todo"
    )

    priority: Mapped[str] = mapped_column(
        String(50),
        default="medium"
    )

    deadline: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    # Tên người được giao - giữ lại để tương thích frontend cũ
    assignee: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )

    # ID tài khoản thực tế của người được giao
    # Dùng để xác định chính xác người nhận thông báo
    assignee_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Thời gian dự kiến (đơn vị: ngày, tối đa 7 ngày)
    estimated_best_days: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True
    )

    estimated_average_days: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True
    )

    estimated_worst_days: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )


# =========================================================
# PROJECT REPOSITORY
# =========================================================

class ProjectRepository(Base):
    __tablename__ = "project_repositories"

    __table_args__ = (
        UniqueConstraint(
            "project_id",
            name="uq_project_repositories_project_id"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False
    )

    repository_url: Mapped[str] = mapped_column(
        String(500),
        nullable=False
    )

    github_owner: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    github_repo: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    linked_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )


# =========================================================
# USER SCHEMAS
# =========================================================

class UserRegister(BaseModel):
    name: str = Field(..., min_length=1)
    email: EmailStr
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)


class UserOut(BaseModel):
    id: uuid.UUID
    name: str
    email: EmailStr
    name_tag: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


# =========================================================
# PROJECT SCHEMAS
# =========================================================

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)

    description: str = Field(
        ...,
        min_length=1,
        description="Mô tả chi tiết dự án"
    )

    start_date: date
    end_date: date

    @model_validator(mode="after")
    def validate_project(self):
        self.name = self.name.strip()
        self.description = self.description.strip()

        if not self.name:
            raise ValueError("Tên dự án không được để trống")

        if not self.description:
            raise ValueError("Mô tả dự án không được để trống")

        if self.end_date < self.start_date:
            raise ValueError("Ngày kết thúc không được trước ngày bắt đầu")

        return self

class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)

    description: Optional[str] = Field(
        None,
        description="Mô tả chi tiết dự án"
    )

    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None

    @model_validator(mode="after")
    def validate_project_update(self):
        if self.name is not None:
            self.name = self.name.strip()

            if not self.name:
                raise ValueError("Tên dự án không được để trống")

        if self.description is not None:
            self.description = self.description.strip()

        if (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date < self.start_date
        ):
            raise ValueError("Ngày kết thúc không được trước ngày bắt đầu")

        return self


class ProjectJoinIn(BaseModel):
    join_code: str = Field(..., min_length=1)


class TaskSummary(BaseModel):
    completed: int
    total: int


class ProjectOut(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    join_code: str
    status: str
    role: str
    member_count: int
    tasks: TaskSummary


# =========================================================
# TASK SCHEMAS
# =========================================================

ALLOWED_STATUS = {
    "todo",
    "in_progress",
    "review",
    "done"
}

ALLOWED_PRIORITY = {
    "low",
    "medium",
    "high"
}


class TaskBase(BaseModel):
    project_id: uuid.UUID

    title: str = Field(
        ...,
        min_length=1,
        description="Tên công việc"
    )

    description: Optional[str] = Field(
        None,
        description="Mô tả chi tiết"
    )

    status: str = Field(default="todo")
    priority: str = Field(default="medium")
    deadline: Optional[datetime] = Field(None)

    # Tên người được giao
    assignee: Optional[str] = Field(None)

    # ID tài khoản người được giao
    assignee_id: Optional[uuid.UUID] = Field(
        None,
        description="ID tài khoản được giao công việc"
    )

    # Thời gian dự kiến theo ngày
    estimated_best_days: Optional[float] = Field(
        None,
        gt=0,
        le=7,
        description="Thời gian tốt nhất (ngày)"
    )

    estimated_average_days: Optional[float] = Field(
        None,
        gt=0,
        le=7,
        description="Thời gian trung bình (ngày)"
    )

    estimated_worst_days: Optional[float] = Field(
        None,
        gt=0,
        le=7,
        description="Thời gian tệ nhất (ngày)"
    )

    @model_validator(mode="after")
    def validate_estimated_time(self):
        best = self.estimated_best_days
        average = self.estimated_average_days
        worst = self.estimated_worst_days

        if best is not None and average is not None:
            if best > average:
                raise ValueError(
                    "Thời gian tốt nhất không được lớn hơn thời gian trung bình"
                )

        if average is not None and worst is not None:
            if average > worst:
                raise ValueError(
                    "Thời gian trung bình không được lớn hơn thời gian tệ nhất"
                )

        if best is not None and worst is not None:
            if best > worst:
                raise ValueError(
                    "Thời gian tốt nhất không được lớn hơn thời gian tệ nhất"
                )

        return self


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    deadline: Optional[datetime] = None

    # Tên người được giao
    assignee: Optional[str] = None

    # ID tài khoản người được giao
    assignee_id: Optional[uuid.UUID] = None

    estimated_best_days: Optional[float] = Field(
        None,
        gt=0,
        le=7
    )

    estimated_average_days: Optional[float] = Field(
        None,
        gt=0,
        le=7
    )

    estimated_worst_days: Optional[float] = Field(
        None,
        gt=0,
        le=7
    )

    @model_validator(mode="after")
    def validate_estimated_time(self):
        best = self.estimated_best_days
        average = self.estimated_average_days
        worst = self.estimated_worst_days

        if best is not None and average is not None and best > average:
            raise ValueError(
                "Thời gian tốt nhất không được lớn hơn thời gian trung bình"
            )

        if average is not None and worst is not None and average > worst:
            raise ValueError(
                "Thời gian trung bình không được lớn hơn thời gian tệ nhất"
            )

        if best is not None and worst is not None and best > worst:
            raise ValueError(
                "Thời gian tốt nhất không được lớn hơn thời gian tệ nhất"
            )

        return self


class TaskOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    description: Optional[str]
    status: str
    priority: str
    deadline: Optional[datetime]

    # Tên người được giao
    assignee: Optional[str]

    # ID tài khoản người được giao
    assignee_id: Optional[uuid.UUID] = None

    estimated_best_days: Optional[float] = None
    estimated_average_days: Optional[float] = None
    estimated_worst_days: Optional[float] = None

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# =========================================================
# PROJECT REPOSITORY SCHEMAS
# =========================================================

class ProjectRepositoryCreate(BaseModel):
    repository_url: str = Field(
        ...,
        min_length=1,
        max_length=500
    )


class ProjectRepositoryOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    repository_url: str
    github_owner: str
    github_repo: str
    linked_by: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True

