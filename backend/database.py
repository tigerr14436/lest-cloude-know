
"""
Cấu hình kết nối PostgreSQL bằng SQLAlchemy Async.
File .env được đặt cùng thư mục với database.py.
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    async_sessionmaker,
)
from sqlalchemy.orm import declarative_base


# Luôn đọc .env theo vị trí file, không phụ thuộc thư mục chạy lệnh.
BACKEND_DIR = Path(__file__).resolve().parent
ENV_FILE = BACKEND_DIR / ".env"

load_dotenv(ENV_FILE)

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

if not DATABASE_URL:
    raise RuntimeError(
        "Thiếu DATABASE_URL trong backend/.env. "
        "Hãy cấu hình thông tin kết nối PostgreSQL."
    )

# SQLAlchemy Async cần driver asyncpg.
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgresql://",
        "postgresql+asyncpg://",
        1,
    )
elif DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgres://",
        "postgresql+asyncpg://",
        1,
    )

if not DATABASE_URL.startswith("postgresql+asyncpg://"):
    raise RuntimeError(
        "DATABASE_URL phải sử dụng PostgreSQL với driver asyncpg."
    )

DATABASE_ECHO = os.getenv("DATABASE_ECHO", "false").lower() == "true"

engine = create_async_engine(
    DATABASE_URL,
    echo=DATABASE_ECHO,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()


async def get_db():
    """Tạo session riêng cho từng request."""
    async with AsyncSessionLocal() as session:
        yield session
