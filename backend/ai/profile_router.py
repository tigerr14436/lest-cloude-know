
"""API quản lý Project AI Profile."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User, ProjectMember

from auth_deps import get_current_user

from ai.models import AIProjectProfile
from ai.schemas import (
    AIProjectProfileUpdate,
    AIProjectProfileResponse,
)


router = APIRouter(
    prefix="/api/projects/{project_id}/ai/profile",
    tags=["Project AI Profile"],
)


async def get_project_membership(
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


@router.get("", response_model=AIProjectProfileResponse)
async def get_ai_project_profile(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_project_membership(
        db,
        project_id,
        current_user.id,
    )

    result = await db.execute(
        select(AIProjectProfile).where(
            AIProjectProfile.project_id == project_id
        )
    )

    profile = result.scalar_one_or_none()

    if profile is None:
        raise HTTPException(
            status_code=404,
            detail="Dự án chưa có AI Profile",
        )

    return profile


@router.put("", response_model=AIProjectProfileResponse)
async def update_ai_project_profile(
    project_id: uuid.UUID,
    payload: AIProjectProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    membership = await get_project_membership(
        db,
        project_id,
        current_user.id,
    )

    if membership.role != "owner":
        raise HTTPException(
            status_code=403,
            detail="Chỉ Owner mới được chỉnh sửa AI Profile",
        )

    result = await db.execute(
        select(AIProjectProfile).where(
            AIProjectProfile.project_id == project_id
        )
    )

    profile = result.scalar_one_or_none()

    if profile is None:
        profile = AIProjectProfile(
            project_id=project_id,
            updated_by=current_user.id,
            **payload.model_dump(),
        )
        db.add(profile)
    else:
        for field, value in payload.model_dump().items():
            setattr(profile, field, value)

        profile.updated_by = current_user.id

    await db.commit()
    await db.refresh(profile)

    return profile
