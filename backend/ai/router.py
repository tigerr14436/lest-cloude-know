
"""API đọc context dự án dành cho AI Agent."""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User
from auth_deps import get_current_user

from ai.services.project_context import build_project_context


router = APIRouter(
    prefix="/api/projects/{project_id}/ai",
    tags=["Project AI"],
)


@router.get("/context")
async def get_ai_project_context(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await build_project_context(
        db=db,
        project_id=project_id,
        user_id=current_user.id,
    )
