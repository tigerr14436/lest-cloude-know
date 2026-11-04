"""
File chính chạy FastAPI server.
Đặt file này trong thư mục /backend.
Chạy server bằng lệnh:
    uvicorn main:app --reload --port 8000
Lưu ý: create_all() tạo bảng mới, không tự sửa bảng đã tồn tại.
Không cần xóa dữ liệu cũ để bổ sung bảng project_repositories.
"""
from project_costs import router as project_costs_router
from ai.knowledge_router import router as ai_knowledge_router
from ai.profile_router import router as ai_profile_router
from ai.models import (
    AIProjectProfile,
    AIKnowledgeItem,
    AIConversation,
    AIMessage,
    AIActionProposal,
)
from ai.chat_router import router as ai_chat_router
from ai.router import router as ai_router
import uuid
import random
import string
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone
from project_groups import router as project_groups_router
from group_kanban import router as group_kanban_router
from subtask_focus import router as subtask_focus_router
from name_tags import router as name_tags_router, generate_name_tag
from database import get_db
from models import (
    Task, TaskCreate, TaskUpdate, TaskOut, ALLOWED_STATUS, ALLOWED_PRIORITY,
    User, UserRegister, UserLogin, UserUpdate, UserOut, TokenOut,
    Project, ProjectMember, ProjectCreate, ProjectUpdate, ProjectJoinIn, ProjectOut, TaskSummary,
)
from auth_utils import hash_password, verify_password, create_access_token
from auth_deps import get_current_user
from email_verification import router as email_verification_router, issue_code
import asyncio
import json
import re
from urllib.parse import urlparse, quote
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from sqlalchemy.exc import IntegrityError
from models import (
    ProjectRepository,
    ProjectRepositoryCreate,
    ProjectRepositoryOut,
)
app = FastAPI(title="Quản lý công việc & dự án CNTT API")
app.include_router(project_costs_router)
app.include_router(ai_chat_router)
app.include_router(ai_knowledge_router)
app.include_router(ai_profile_router)
app.include_router(ai_router)
app.include_router(email_verification_router)
app.include_router(project_groups_router)
app.include_router(group_kanban_router)
app.include_router(subtask_focus_router)
app.include_router(name_tags_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def generate_join_code(name: str) -> str:
    letters = "".join(ch for ch in name.upper() if ch.isalpha())[:3] or "PRJ"
    digits = "".join(random.choices(string.digits, k=4))
    return f"{letters}-{digits}"
async def _project_task_summary(db: AsyncSession, project_id: uuid.UUID) -> TaskSummary:
    result = await db.execute(select(Task.status).where(Task.project_id == project_id))
    statuses = result.scalars().all()
    completed = sum(1 for s in statuses if s == "done")
    return TaskSummary(completed=completed, total=len(statuses))
async def _member_count(db: AsyncSession, project_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count()).select_from(ProjectMember).where(ProjectMember.project_id == project_id)
    )
    return result.scalar_one()
async def _get_membership(db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID) -> ProjectMember | None:
    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id, ProjectMember.user_id == user_id
        )
    )
    return result.scalar_one_or_none()
async def _require_project_member(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID
) -> ProjectMember:
    membership = await _get_membership(
        db, project_id, user_id
    )
    if membership is None:
        raise HTTPException(
            status_code=403,
            detail="Bạn không thuộc dự án này"
        )
    return membership
async def _require_project_owner(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID
) -> ProjectMember:
    membership = await _require_project_member(
        db, project_id, user_id
    )
    if membership.role != "owner":
        raise HTTPException(
            status_code=403,
            detail="Chỉ Owner mới được thực hiện thao tác này"
        )
    return membership
# ================= AUTH =================
@app.post("/api/auth/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegister, db: AsyncSession = Depends(get_db)):
    email = str(payload.email).strip().lower()
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="Email này đã được đăng ký")
    # Cấp Name Tag duy nhất; savepoint cho phép thử lại khi trùng mã
    # mà không làm hỏng transaction của phiên đăng ký.
    new_user = None
    for _ in range(40):
        candidate = User(
            name=payload.name,
            email=email,
            password_hash=hash_password(payload.password),
            is_verified=False,
            name_tag=generate_name_tag(),
        )
        try:
            async with db.begin_nested():
                db.add(candidate)
                await db.flush()
            new_user = candidate
            break
        except IntegrityError as exc:
            # Chỉ thử lại khi trùng Name Tag, không nuốt lỗi trùng email.
            constraint = getattr(getattr(exc.orig, "diag", None), "constraint_name", "") or ""
            if constraint not in ("ix_users_name_tag", "uq_users_name_tag"):
                raise HTTPException(status_code=409, detail="Email đã được đăng ký hoặc dữ liệu bị trùng")
    if new_user is None:
        raise HTTPException(status_code=503, detail="Không thể cấp Name Tag, vui lòng thử lại")
    await db.commit()
    await db.refresh(new_user)
    await issue_code(db, new_user, enforce_cooldown=False)
    return new_user
@app.post("/api/auth/login", response_model=TokenOut)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == str(payload.email).strip().lower()))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng")
    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Email chưa được xác minh. Vui lòng nhập mã OTP đã gửi hoặc yêu cầu gửi lại.")
    token = create_access_token({"sub": str(user.id)})
    return TokenOut(access_token=token)
# ================= USERS (🔒) =================
@app.get("/api/users/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
@app.put("/api/users/me", response_model=UserOut)
async def update_me(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)
    await db.commit()
    await db.refresh(current_user)
    return current_user
# ================= PROJECTS (🔒 tất cả đều cần đăng nhập) =================
@app.post("/api/projects", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Sinh join_code duy nhất, thử lại nếu trùng
    while True:
        code = generate_join_code(payload.name)
        existing = await db.execute(select(Project).where(Project.join_code == code))
        if existing.scalar_one_or_none() is None:
            break
    project = Project(
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
        start_date=payload.start_date,
        end_date=payload.end_date,
        owner_id=current_user.id,
        join_code=code,
    )
    db.add(project)
    await db.flush()  # để lấy project.id trước khi commit
    member = ProjectMember(project_id=project.id, user_id=current_user.id, role="owner")
    db.add(member)
    await db.commit()
    await db.refresh(project)
    return ProjectOut(
        id=project.id, name=project.name,
            description=project.description,
            start_date=project.start_date,
            end_date=project.end_date,
            join_code=project.join_code,
        status=project.status, role="owner", member_count=1,
        tasks=TaskSummary(completed=0, total=0),
    )
@app.put("/api/projects/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_project_owner(db, project_id, current_user.id)
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án")
    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes:
        if not changes["name"] or not changes["name"].strip():
            raise HTTPException(status_code=422, detail="Tên dự án không được để trống")
        changes["name"] = changes["name"].strip()
    if "description" in changes:
        changes["description"] = (changes["description"] or "").strip() or None
    if "status" in changes and changes["status"] not in ("active", "completed"):
        raise HTTPException(status_code=422, detail="Trạng thái dự án không hợp lệ")
    start = changes.get("start_date", project.start_date)
    end = changes.get("end_date", project.end_date)
    if start and end and end < start:
        raise HTTPException(status_code=422, detail="Ngày kết thúc không được trước ngày bắt đầu")
    if changes.get("status") == "completed":
        task_summary = await _project_task_summary(db, project_id)
        if task_summary.total > task_summary.completed:
            raise HTTPException(status_code=409, detail="Cần hoàn thành toàn bộ Task trước khi kết thúc dự án")
    for field, value in changes.items():
        setattr(project, field, value)
    await db.commit()
    await db.refresh(project)
    return ProjectOut(
        id=project.id, name=project.name, description=project.description,
        start_date=project.start_date, end_date=project.end_date,
        join_code=project.join_code, status=project.status, role="owner",
        member_count=await _member_count(db, project_id),
        tasks=await _project_task_summary(db, project_id),
    )
@app.get("/api/projects", response_model=list[ProjectOut])
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project, ProjectMember.role)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(ProjectMember.user_id == current_user.id)
        .order_by(Project.created_at.desc())
    )
    rows = result.all()
    output = []
    for project, role in rows:
        output.append(ProjectOut(
            id=project.id, name=project.name,
            description=project.description,
            start_date=project.start_date,
            end_date=project.end_date,
            join_code=project.join_code,
            status=project.status, role=role,
            member_count=await _member_count(db, project.id),
            tasks=await _project_task_summary(db, project.id),
        ))
    return output
@app.post("/api/projects/join", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def join_project(
    payload: ProjectJoinIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    code = payload.join_code.strip().upper()
    result = await db.execute(select(Project).where(Project.join_code == code))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Mã tham gia không chính xác")
    existing = await _get_membership(db, project.id, current_user.id)
    if existing is not None:
        raise HTTPException(status_code=400, detail="Bạn đã là thành viên của dự án này")
    member = ProjectMember(project_id=project.id, user_id=current_user.id, role="member")
    db.add(member)
    await db.commit()
    return ProjectOut(
        id=project.id, name=project.name,
            description=project.description,
            start_date=project.start_date,
            end_date=project.end_date,
            join_code=project.join_code,
        status=project.status, role="member",
        member_count=await _member_count(db, project.id),
        tasks=await _project_task_summary(db, project.id),
    )
@app.get("/api/projects/{project_id}/members")
async def get_project_members(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Danh sách Owner và Member của dự án để phân công Task."""
    await _require_project_member(db, project_id, current_user.id)
    result = await db.execute(
        select(User, ProjectMember.role)
        .join(ProjectMember, ProjectMember.user_id == User.id)
        .where(ProjectMember.project_id == project_id)
        .order_by(User.name.asc(), User.id.asc())
    )
    return [
        {"id": str(user.id), "name": user.name, "role": role}
        for user, role in result.all()
    ]
@app.delete("/api/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_or_leave_project(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    member = await _get_membership(db, project_id, current_user.id)
    if member is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án")
    if member.role == "owner":
        # Xóa repository trước khi xóa project (tránh lỗi khóa ngoại)
        await db.execute(ProjectRepository.__table__.delete().where(ProjectRepository.project_id == project_id))
        # Chủ dự án xóa -> xóa task, thành viên và dự án
        await db.execute(Task.__table__.delete().where(Task.project_id == project_id))
        await db.execute(ProjectMember.__table__.delete().where(ProjectMember.project_id == project_id))
        project = await db.get(Project, project_id)
        if project is not None:
            await db.delete(project)
    else:
        # Thành viên thường -> chỉ rời khỏi dự án
        await db.delete(member)
    await db.commit()
    return None
# ================= TASKS (🔒, luôn kiểm tra user có thuộc project không) =================
@app.post("/api/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    task: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_project_owner(
    db,
    task.project_id,
    current_user.id
)
    if task.status not in ALLOWED_STATUS:
        raise HTTPException(status_code=422, detail=f"status phải là một trong: {', '.join(ALLOWED_STATUS)}")
    if task.priority not in ALLOWED_PRIORITY:
        raise HTTPException(status_code=422, detail=f"priority phải là một trong: {', '.join(ALLOWED_PRIORITY)}")
    new_task = Task(**task.model_dump())
    db.add(new_task)
    await db.commit()
    await db.refresh(new_task)
    return new_task
@app.get("/api/tasks", response_model=list[TaskOut])
async def get_tasks(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if await _get_membership(db, project_id, current_user.id) is None:
        raise HTTPException(status_code=403, detail="Bạn không thuộc dự án này")
    result = await db.execute(
        select(Task).where(Task.project_id == project_id).order_by(Task.created_at.desc())
    )
    return result.scalars().all()
async def _get_task_or_403(db: AsyncSession, task_id: uuid.UUID, current_user: User) -> Task:
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy task")
    if await _get_membership(db, task.project_id, current_user.id) is None:
        raise HTTPException(status_code=403, detail="Bạn không thuộc dự án này")
    return task
@app.get("/api/tasks/{task_id}", response_model=TaskOut)
async def get_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _get_task_or_403(db, task_id, current_user)
@app.put("/api/tasks/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: uuid.UUID,
    task: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await _get_task_or_403(db, task_id, current_user)
    await _require_project_owner(
    db,
    existing.project_id,
    current_user.id
)
    update_data = task.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] not in ALLOWED_STATUS:
        raise HTTPException(status_code=422, detail=f"status phải là một trong: {', '.join(ALLOWED_STATUS)}")
    if "priority" in update_data and update_data["priority"] not in ALLOWED_PRIORITY:
        raise HTTPException(status_code=422, detail=f"priority phải là một trong: {', '.join(ALLOWED_PRIORITY)}")
    for field, value in update_data.items():
        setattr(existing, field, value)
    await db.commit()
    await db.refresh(existing)
    return existing
@app.delete("/api/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await _get_task_or_403(db, task_id, current_user)
    await _require_project_owner(db, existing.project_id, current_user.id)
    await db.delete(existing)
    await db.commit()
    return None
@app.get("/")
async def root():
    return {"message": "API đang chạy. Vào /docs để xem tài liệu API."}
@app.get("/api/dashboard")
async def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Chỉ lấy dự án mà user đang tham gia
    result = await db.execute(
        select(Project)
        .join(
            ProjectMember,
            ProjectMember.project_id == Project.id
        )
        .where(ProjectMember.user_id == current_user.id)
        .order_by(Project.created_at.desc())
    )
    projects = result.scalars().all()
    project_ids = [p.id for p in projects]
    if not project_ids:
        return {
            "statistics": {
                "totalProjects": 0,
                "completedTasks": 0,
                "workspaces": None,
                "members": 0
            },
            "projectProgressChart": [],
            "recentActivities": []
        }
    # Lấy Task thuộc các dự án có quyền truy cập
    task_result = await db.execute(
        select(Task)
        .where(Task.project_id.in_(project_ids))
        .order_by(Task.updated_at.desc())
    )
    tasks = task_result.scalars().all()
    completed_tasks = sum(
        1 for task in tasks if task.status == "done"
    )
    # Đếm thành viên duy nhất
    member_result = await db.execute(
        select(func.count(func.distinct(ProjectMember.user_id)))
        .where(ProjectMember.project_id.in_(project_ids))
    )
    total_members = member_result.scalar_one()
    # Tính tiến độ cho từng dự án
    project_progress = []
    project_names = {p.id: p.name for p in projects}
    for project in projects:
        project_tasks = [
            t for t in tasks if t.project_id == project.id
        ]
        total = len(project_tasks)
        done = sum(
            1 for t in project_tasks if t.status == "done"
        )
        progress = round(done / total * 100) if total else 0
        project_progress.append({
            "id": str(project.id),
            "name": project.name,
            "progress": progress,
            "totalTasks": total,
            "completedTasks": done
        })
    # Hoạt động gần đây từ Task và Project
    activities = []
    for task in tasks:
        activities.append({
            "id": f"task-{task.id}",
            "action": (
                f'Cập nhật công việc "{task.title}"'
                if task.updated_at is not None and task.created_at is not None and task.updated_at > task.created_at
                else f'Tạo công việc "{task.title}"'
            ),
            "project": project_names.get(
                task.project_id, "Dự án"
            ),
            "timestamp": (task.updated_at or task.created_at).isoformat()
        })
    for project in projects:
        activities.append({
            "id": f"project-{project.id}",
            "action": "Tạo hoặc tham gia dự án",
            "project": project.name,
            "timestamp": project.created_at.isoformat()
        })
    activities.sort(
        key=lambda item: item["timestamp"],
        reverse=True
    )
    return {
        "statistics": {
            "totalProjects": len(projects),
            "completedTasks": completed_tasks,
            "workspaces": None,
            "members": total_members
        },
        "projectProgressChart": project_progress,
        "recentActivities": activities[:5]
    }
# ================= GITHUB REPOSITORIES =================
def parse_github_repository_url(raw_url: str) -> tuple[str, str]:
    """Chỉ cho phép URL repository GitHub chuẩn, không cho URL máy chủ tùy ý."""
    try:
        parsed = urlparse(raw_url.strip())
        port = parsed.port
    except ValueError:
        raise HTTPException(status_code=422, detail="URL GitHub không hợp lệ")
    if (
        parsed.scheme != "https"
        or parsed.hostname != "github.com"
        or port is not None
        or parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or parsed.fragment
    ):
        raise HTTPException(status_code=422, detail="Chỉ chấp nhận https://github.com/owner/repo")
    parts = parsed.path.strip("/").split("/")
    if len(parts) != 2:
        raise HTTPException(status_code=422, detail="URL phải có dạng https://github.com/owner/repo")
    owner, repo = parts
    repo = re.sub(r"**\\.**git$", "", repo, flags=re.IGNORECASE)
    if (
        not re.fullmatch(r"[A-Za-z0-9-]{1,39}", owner)
        or not re.fullmatch(r"[A-Za-z0-9_.-]{1,100}", repo)
        or repo in (".", "..")
    ):
        raise HTTPException(status_code=422, detail="Tên GitHub owner hoặc repository không hợp lệ")
    return owner, repo
def _github_request_sync(api_path: str):
    request = Request(
        f"https://api.github.com{api_path}",
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "DevTask-Project-Manager",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    try:
        with urlopen(request, timeout=10) as response:
            return json.load(response)
    except HTTPError as exc:
        if exc.code == 404:
            raise HTTPException(status_code=404, detail="Repository không tồn tại hoặc không công khai")
        if exc.code in (403, 429):
            raise HTTPException(status_code=503, detail="GitHub API bị giới hạn, vui lòng thử lại sau")
        raise HTTPException(status_code=502, detail=f"GitHub API trả về HTTP {exc.code}")
    except (URLError, TimeoutError, ValueError):
        raise HTTPException(status_code=502, detail="Không thể đọc dữ liệu từ GitHub")
async def github_request(api_path: str):
    return await asyncio.to_thread(_github_request_sync, api_path)
async def _get_project_repository(db: AsyncSession, project_id: uuid.UUID):
    result = await db.execute(
        select(ProjectRepository).where(ProjectRepository.project_id == project_id)
    )
    return result.scalar_one_or_none()
@app.post(
    "/api/projects/{project_id}/repository",
    response_model=ProjectRepositoryOut,
    status_code=status.HTTP_201_CREATED,
)
async def link_project_repository(
    project_id: uuid.UUID,
    payload: ProjectRepositoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_project_owner(db, project_id, current_user.id)
    if await _get_project_repository(db, project_id) is not None:
        raise HTTPException(status_code=409, detail="Dự án đã có Repository. Hãy gỡ link cũ trước.")
    owner, repo = parse_github_repository_url(payload.repository_url)
    github_data = await github_request(
        f"/repos/{quote(owner, safe='')}/{quote(repo, safe='')}"
    )
    if github_data.get("private"):
        raise HTTPException(status_code=422, detail="Chỉ hỗ trợ repository GitHub công khai")
    new_link = ProjectRepository(
        project_id=project_id,
        repository_url=github_data["html_url"],
        github_owner=github_data["owner"]["login"],
        github_repo=github_data["name"],
        linked_by=current_user.id,
    )
    db.add(new_link)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Dự án đã liên kết Repository")
    await db.refresh(new_link)
    return new_link
@app.get("/api/projects/{project_id}/repository", response_model=ProjectRepositoryOut)
async def get_project_repository(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_project_member(db, project_id, current_user.id)
    repository = await _get_project_repository(db, project_id)
    if repository is None:
        raise HTTPException(status_code=404, detail="Dự án chưa liên kết Repository")
    return repository
@app.delete("/api/projects/{project_id}/repository", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_project_repository(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_project_owner(db, project_id, current_user.id)
    repository = await _get_project_repository(db, project_id)
    if repository is None:
        raise HTTPException(status_code=404, detail="Dự án chưa liên kết Repository")
    await db.delete(repository)
    await db.commit()
    return None
@app.get("/api/projects/{project_id}/repository/commits")
async def get_project_repository_commits(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_project_member(db, project_id, current_user.id)
    repository = await _get_project_repository(db, project_id)
    if repository is None:
        raise HTTPException(status_code=404, detail="Dự án chưa liên kết Repository")
    owner = quote(repository.github_owner, safe="")
    repo = quote(repository.github_repo, safe="")
    github_info = await github_request(f"/repos/{owner}/{repo}")
    branch = github_info["default_branch"]
    commits_data = await github_request(
        f"/repos/{owner}/{repo}/commits?sha={quote(branch, safe='')}&per_page=30"
    )
    commits = []
    for item in commits_data:
        info = item.get("commit") or {}
        author = info.get("author") or {}
        commits.append({
            "sha": item["sha"],
            "short_sha": item["sha"][:7],
            "message": info.get("message", ""),
            "author": author.get("name", "Không rõ"),
            "date": author.get("date"),
            "url": item.get("html_url"),
        })
    return {
        "repository": {
            "name": github_info["name"],
            "full_name": github_info["full_name"],
            "url": github_info["html_url"],
            "description": github_info.get("description"),
            "default_branch": branch,
            "language": github_info.get("language"),
            "stars": github_info.get("stargazers_count", 0),
            "forks": github_info.get("forks_count", 0),
            "pushed_at": github_info.get("pushed_at"),
        },
        "commits": commits,
        "returned_commits": len(commits),
    }
