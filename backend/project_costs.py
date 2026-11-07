"""API quản lý ngân sách, danh mục và khoản chi theo từng dự án."""

import uuid
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import (
    Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint,
    select, func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func as sql_func

from database import Base, get_db
from models import Project, ProjectMember, User
from auth_deps import get_current_user


router = APIRouter(
    prefix="/api/projects/{project_id}/costs",
    tags=["Project Costs"],
)


# =========================================================
# DATABASE MODELS
# =========================================================

class ProjectCostSettings(Base):
    __tablename__ = "project_cost_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    budget_limit: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=sql_func.now(),
        onupdate=sql_func.now(),
    )


class ProjectCostCategory(Base):
    __tablename__ = "project_cost_categories"

    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "name",
            name="uq_project_cost_category_name",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    estimated_amount: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )


class ProjectExpense(Base):
    __tablename__ = "project_expenses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_cost_categories.id", ondelete="RESTRICT"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    amount: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    expense_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )


# =========================================================
# PYDANTIC SCHEMAS
# =========================================================

class SettingsIn(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget_limit: int = Field(ge=0)


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: Optional[str] = None
    estimated_amount: int = Field(default=0, ge=0)


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=120,
    )
    description: Optional[str] = None
    estimated_amount: Optional[int] = Field(
        default=None,
        ge=0,
    )


class ExpenseCreate(BaseModel):
    category_id: uuid.UUID
    name: str = Field(min_length=1, max_length=255)
    amount: int = Field(gt=0)
    expense_date: date
    description: Optional[str] = None


class ExpenseUpdate(BaseModel):
    category_id: Optional[uuid.UUID] = None
    name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=255,
    )
    amount: Optional[int] = Field(default=None, gt=0)
    expense_date: Optional[date] = None
    description: Optional[str] = None


# =========================================================
# PERMISSION HELPERS
# =========================================================

async def _get_project(
    db: AsyncSession,
    project_id: uuid.UUID,
    user: User,
    write: bool = False,
) -> Project:

    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )

    project = result.scalar_one_or_none()

    if project is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy dự án",
        )

    # Chủ dự án có toàn quyền.
    if project.owner_id != user.id:

        member_result = await db.execute(
            select(ProjectMember.id).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user.id,
            )
        )

        member = member_result.scalar_one_or_none()

        if member is None:
            raise HTTPException(
                status_code=403,
                detail="Bạn không có quyền truy cập dự án này",
            )

        # Thành viên chỉ được xem.
        if write:
            raise HTTPException(
                status_code=403,
                detail="Chỉ chủ dự án mới được chỉnh sửa ngân sách và chi phí",
            )

    return project


async def _get_category(
    db: AsyncSession,
    project_id: uuid.UUID,
    category_id: uuid.UUID,
) -> ProjectCostCategory:

    result = await db.execute(
        select(ProjectCostCategory).where(
            ProjectCostCategory.id == category_id,
            ProjectCostCategory.project_id == project_id,
        )
    )

    category = result.scalar_one_or_none()

    if category is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy danh mục chi phí",
        )

    return category


# =========================================================
# SERIALIZERS
# =========================================================

def _category_dict(row: ProjectCostCategory) -> dict:
    return {
        "id": str(row.id),
        "name": row.name,
        "description": row.description,
        "estimated_amount": row.estimated_amount,
    }


def _expense_dict(row: ProjectExpense) -> dict:
    return {
        "id": str(row.id),
        "category_id": str(row.category_id),
        "name": row.name,
        "amount": row.amount,
        "expense_date": row.expense_date.isoformat(),
        "description": row.description,
    }


# =========================================================
# GET ALL PROJECT COST DATA
# =========================================================

@router.get("")
async def get_project_costs(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):

    project = await _get_project(
        db,
        project_id,
        current_user,
    )

    settings_result = await db.execute(
        select(ProjectCostSettings).where(
            ProjectCostSettings.project_id == project_id
        )
    )

    settings = settings_result.scalar_one_or_none()

    categories_result = await db.execute(
        select(ProjectCostCategory)
        .where(ProjectCostCategory.project_id == project_id)
        .order_by(ProjectCostCategory.name.asc())
    )

    expenses_result = await db.execute(
        select(ProjectExpense)
        .where(ProjectExpense.project_id == project_id)
        .order_by(ProjectExpense.expense_date.desc())
    )

    categories = categories_result.scalars().all()
    expenses = expenses_result.scalars().all()

    total_actual = sum(
        item.amount for item in expenses
    )

    budget = settings.budget_limit if settings else 0

    return {
        "project_id": str(project.id),

        "start_date": (
            project.start_date.isoformat()
            if project.start_date else None
        ),

        "end_date": (
            project.end_date.isoformat()
            if project.end_date else None
        ),

        "budget_limit": budget,
        "total_actual": total_actual,
        "remaining_budget": budget - total_actual,

        "is_owner": project.owner_id == current_user.id,

        "categories": [
            _category_dict(item)
            for item in categories
        ],

        "expenses": [
            _expense_dict(item)
            for item in expenses
        ],
    }


# =========================================================
# UPDATE PROJECT SETTINGS
# =========================================================

@router.put("/settings")
async def update_project_cost_settings(
    project_id: uuid.UUID,
    payload: SettingsIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):

    project = await _get_project(
        db,
        project_id,
        current_user,
        write=True,
    )

    new_start = (
        payload.start_date
        if payload.start_date is not None
        else project.start_date
    )

    new_end = (
        payload.end_date
        if payload.end_date is not None
        else project.end_date
    )

    if new_start and new_end and new_end < new_start:
        raise HTTPException(
            status_code=422,
            detail="Ngày kết thúc không được trước ngày bắt đầu",
        )

    project.start_date = new_start
    project.end_date = new_end

    result = await db.execute(
        select(ProjectCostSettings).where(
            ProjectCostSettings.project_id == project_id
        )
    )

    settings = result.scalar_one_or_none()

    if settings is None:
        db.add(
            ProjectCostSettings(
                project_id=project_id,
                budget_limit=payload.budget_limit,
            )
        )
    else:
        settings.budget_limit = payload.budget_limit

    await db.commit()

    return {
        "message": "Đã cập nhật ngân sách và thời gian dự án"
    }


# =========================================================
# CREATE CATEGORY
# =========================================================

@router.post(
    "/categories",
    status_code=status.HTTP_201_CREATED,
)
async def create_category(
    project_id: uuid.UUID,
    payload: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):

    await _get_project(
        db,
        project_id,
        current_user,
        write=True,
    )

    row = ProjectCostCategory(
        project_id=project_id,
        name=payload.name.strip(),
        description=payload.description,
        estimated_amount=payload.estimated_amount,
    )

    if not row.name:
        raise HTTPException(
            status_code=422,
            detail="Tên danh mục không được để trống",
        )

    db.add(row)

    try:
        await db.commit()

    except Exception:
        await db.rollback()

        raise HTTPException(
            status_code=409,
            detail="Tên danh mục đã tồn tại hoặc dữ liệu không hợp lệ",
        )

    await db.refresh(row)

    return _category_dict(row)


# =========================================================
# UPDATE CATEGORY
# =========================================================

@router.patch("/categories/{category_id}")
async def update_category(
    project_id: uuid.UUID,
    category_id: uuid.UUID,
    payload: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):

    await _get_project(
        db,
        project_id,
        current_user,
        write=True,
    )

    row = await _get_category(
        db,
        project_id,
        category_id,
    )

    changes = payload.model_dump(exclude_unset=True)

    for key, value in changes.items():

        if key == "name" and value is not None:
            value = value.strip()

            if not value:
                raise HTTPException(
                    status_code=422,
                    detail="Tên danh mục không được để trống",
                )

        setattr(row, key, value)

    try:
        await db.commit()

    except Exception:
        await db.rollback()

        raise HTTPException(
            status_code=409,
            detail="Tên danh mục đã được sử dụng",
        )

    await db.refresh(row)

    return _category_dict(row)


# =========================================================
# DELETE CATEGORY
# =========================================================

@router.delete(
    "/categories/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_category(
    project_id: uuid.UUID,
    category_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):

    await _get_project(
        db,
        project_id,
        current_user,
        write=True,
    )

    row = await _get_category(
        db,
        project_id,
        category_id,
    )

    used_result = await db.execute(
        select(func.count())
        .select_from(ProjectExpense)
        .where(ProjectExpense.category_id == category_id)
    )

    if used_result.scalar_one() > 0:
        raise HTTPException(
            status_code=409,
            detail=(
                "Danh mục đang được sử dụng. "
                "Hãy chuyển hoặc xóa các khoản chi thuộc danh mục trước."
            ),
        )

    await db.delete(row)
    await db.commit()

    return None


# =========================================================
# CREATE EXPENSE
# =========================================================

@router.post(
    "/expenses",
    status_code=status.HTTP_201_CREATED,
)
async def create_expense(
    project_id: uuid.UUID,
    payload: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):

    await _get_project(
        db,
        project_id,
        current_user,
        write=True,
    )

    await _get_category(
        db,
        project_id,
        payload.category_id,
    )

    row = ProjectExpense(
        project_id=project_id,
        **payload.model_dump(),
    )

    db.add(row)

    await db.commit()
    await db.refresh(row)

    return _expense_dict(row)


# =========================================================
# UPDATE EXPENSE
# =========================================================

@router.patch("/expenses/{expense_id}")
async def update_expense(
    project_id: uuid.UUID,
    expense_id: uuid.UUID,
    payload: ExpenseUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):

    await _get_project(
        db,
        project_id,
        current_user,
        write=True,
    )

    result = await db.execute(
        select(ProjectExpense).where(
            ProjectExpense.id == expense_id,
            ProjectExpense.project_id == project_id,
        )
    )

    row = result.scalar_one_or_none()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy khoản chi",
        )

    changes = payload.model_dump(exclude_unset=True)

    if changes.get("category_id") is not None:
        await _get_category(
            db,
            project_id,
            changes["category_id"],
        )

    for key, value in changes.items():
        setattr(row, key, value)

    await db.commit()
    await db.refresh(row)

    return _expense_dict(row)


# =========================================================
# DELETE EXPENSE
# =========================================================

@router.delete(
    "/expenses/{expense_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_expense(
    project_id: uuid.UUID,
    expense_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):

    await _get_project(
        db,
        project_id,
        current_user,
        write=True,
    )

    result = await db.execute(
        select(ProjectExpense).where(
            ProjectExpense.id == expense_id,
            ProjectExpense.project_id == project_id,
        )
    )

    row = result.scalar_one_or_none()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy khoản chi",
        )

    await db.delete(row)
    await db.commit()

    return None