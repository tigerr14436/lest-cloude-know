
"""
FastAPI router xác minh email bằng OTP cho DevTask.

Chức năng:
- Tạo OTP 6 chữ số.
- Lưu hash OTP thay vì mã gốc.
- OTP hết hạn sau 5 phút.
- Giới hạn 5 lần nhập sai.
- Giới hạn gửi lại OTP mỗi 60 giây.
- Vô hiệu hóa đúng OTP vừa tạo nếu gửi email thất bại.
- Chuẩn hóa email trước khi xác minh.
- Khóa User để xử lý an toàn các yêu cầu đồng thời.
"""

import asyncio
import hashlib
import logging
import os
import secrets

from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User, EmailVerification
from email_service import send_verification_email


# =========================================================
# 1. CONFIGURATION
# =========================================================

BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env")

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/auth",
    tags=["Email verification"],
)

OTP_LIFETIME = timedelta(minutes=5)
RESEND_COOLDOWN = timedelta(seconds=60)
MAX_ATTEMPTS = 5


# =========================================================
# 2. REQUEST SCHEMAS
# =========================================================

class VerifyEmailIn(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")


class ResendCodeIn(BaseModel):
    email: EmailStr


# =========================================================
# 3. HELPER FUNCTIONS
# =========================================================

def normalize_email(email: str) -> str:
    """Chuẩn hóa email."""
    return str(email).strip().lower()


def utc_now() -> datetime:
    """Lấy thời gian UTC có timezone."""
    return datetime.now(timezone.utc)


def normalize_datetime(value: datetime) -> datetime:
    """Đảm bảo datetime có timezone UTC."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


def otp_digest(email: str, code: str) -> str:
    """
    Tạo SHA-256 hash cho OTP kết hợp OTP_PEPPER.
    Không lưu OTP gốc trong database.
    """

    pepper = os.getenv("OTP_PEPPER", "").strip()

    if len(pepper) < 32:
        raise RuntimeError(
            "OTP_PEPPER phải có ít nhất 32 ký tự ngẫu nhiên."
        )

    normalized_email = normalize_email(email)

    raw_data = f"{pepper}:{normalized_email}:{code}"

    return hashlib.sha256(
        raw_data.encode("utf-8")
    ).hexdigest()


def invalidate_otp(record: EmailVerification, email: str) -> None:
    """
    Vô hiệu hóa OTP hiện tại.

    Chỉ sử dụng sau khi đã kiểm tra code_hash
    trùng với OTP được tạo bởi yêu cầu gửi email tương ứng.
    """

    record.code_hash = otp_digest(
        email,
        secrets.token_hex(32),
    )

    record.expires_at = utc_now()
    record.attempts = MAX_ATTEMPTS


async def lock_user(
    db: AsyncSession,
    user_id,
) -> User | None:
    """
    Khóa bản ghi User trong transaction.

    Các thao tác gửi OTP và xác minh OTP của cùng
    một tài khoản sẽ được thực hiện tuần tự.
    """

    return await db.scalar(
        select(User)
        .where(User.id == user_id)
        .with_for_update()
    )


# =========================================================
# 4. ISSUE OTP
# =========================================================

async def issue_code(
    db: AsyncSession,
    user: User,
    *,
    enforce_cooldown: bool = True,
) -> None:
    """
    Tạo OTP và gửi email xác minh.

    Quy trình:
    1. Khóa User.
    2. Kiểm tra thời gian gửi lại.
    3. Tạo hoặc cập nhật OTP.
    4. Commit OTP vào database.
    5. Gửi email.
    6. Nếu gửi thất bại, chỉ vô hiệu hóa OTP
       do chính yêu cầu này tạo ra.
    """

    # -----------------------------------------------------
    # Bước 1: Khóa User để tránh race condition.
    # -----------------------------------------------------

    locked_user = await lock_user(db, user.id)

    if locked_user is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy tài khoản.",
        )

    if locked_user.is_verified:
        raise HTTPException(
            status_code=400,
            detail="Tài khoản đã được xác minh.",
        )

    email = normalize_email(locked_user.email)
    now = utc_now()

    # -----------------------------------------------------
    # Bước 2: Tìm bản ghi OTP.
    # -----------------------------------------------------

    record = await db.scalar(
        select(EmailVerification)
        .where(EmailVerification.user_id == locked_user.id)
        .with_for_update()
    )

    # -----------------------------------------------------
    # Bước 3: Kiểm tra cooldown.
    # -----------------------------------------------------

    if (
        record is not None
        and enforce_cooldown
        and record.sent_at is not None
    ):
        sent_at = normalize_datetime(record.sent_at)

        if now - sent_at < RESEND_COOLDOWN:
            raise HTTPException(
                status_code=429,
                detail="Vui lòng chờ 60 giây trước khi gửi lại mã.",
            )

    # -----------------------------------------------------
    # Bước 4: Tạo OTP.
    # -----------------------------------------------------

    code = f"{secrets.randbelow(1_000_000):06d}"
    code_hash = otp_digest(email, code)

    if record is None:
        record = EmailVerification(
            user_id=locked_user.id,
            code_hash=code_hash,
            expires_at=now + OTP_LIFETIME,
            sent_at=now,
            attempts=0,
        )

        db.add(record)

    else:
        record.code_hash = code_hash
        record.expires_at = now + OTP_LIFETIME
        record.sent_at = now
        record.attempts = 0

    # Lưu OTP trước khi gửi email.
    await db.commit()

    # -----------------------------------------------------
    # Bước 5: Gửi email.
    # -----------------------------------------------------

    try:
        await asyncio.to_thread(
            send_verification_email,
            email,
            code,
        )

        logger.info(
            "Verification email sent successfully."
        )

    except Exception as exc:
        logger.exception(
            "Failed to send verification email."
        )

        # -------------------------------------------------
        # Bước 6: Chỉ vô hiệu hóa đúng OTP vừa tạo.
        # -------------------------------------------------

        try:
            # Khóa lại User trước khi kiểm tra OTP.
            current_user = await lock_user(
                db,
                locked_user.id,
            )

            if current_user is not None:
                current_record = await db.scalar(
                    select(EmailVerification)
                    .where(
                        EmailVerification.user_id == current_user.id
                    )
                    .with_for_update()
                )

                # Không vô hiệu hóa OTP nếu bản ghi đã bị
                # xóa hoặc đã được thay thế bằng OTP khác.
                if (
                    current_record is not None
                    and secrets.compare_digest(
                        current_record.code_hash,
                        code_hash,
                    )
                ):
                    invalidate_otp(
                        current_record,
                        email,
                    )

            await db.commit()

        except Exception:
            await db.rollback()

            logger.exception(
                "Failed to invalidate OTP after email error."
            )

        raise HTTPException(
            status_code=503,
            detail=(
                "Không gửi được email xác minh. "
                "Vui lòng kiểm tra cấu hình Gmail SMTP "
                "và thử lại."
            ),
        ) from exc


# =========================================================
# 5. VERIFY EMAIL
# =========================================================

@router.post("/verify-email")
async def verify_email(
    payload: VerifyEmailIn,
    db: AsyncSession = Depends(get_db),
):
    """
    Xác minh email bằng OTP.

    Điều kiện:
    - Tài khoản phải tồn tại.
    - Tài khoản chưa xác minh.
    - OTP chưa hết hạn.
    - Chưa vượt quá số lần nhập sai.
    """

    email = normalize_email(payload.email)

    # -----------------------------------------------------
    # Bước 1: Tìm User và khóa bản ghi.
    # -----------------------------------------------------

    user = await db.scalar(
        select(User)
        .where(User.email == email)
        .with_for_update()
    )

    if user is None or user.is_verified:
        raise HTTPException(
            status_code=400,
            detail="Email hoặc mã xác minh không hợp lệ.",
        )

    # -----------------------------------------------------
    # Bước 2: Tìm và khóa bản ghi OTP.
    # -----------------------------------------------------

    record = await db.scalar(
        select(EmailVerification)
        .where(EmailVerification.user_id == user.id)
        .with_for_update()
    )

    now = utc_now()

    if record is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Mã xác minh không tồn tại. "
                "Vui lòng yêu cầu gửi lại."
            ),
        )

    # -----------------------------------------------------
    # Bước 3: Kiểm tra thời hạn OTP.
    # -----------------------------------------------------

    expires_at = normalize_datetime(record.expires_at)

    if expires_at <= now:
        raise HTTPException(
            status_code=400,
            detail="Mã đã hết hạn. Vui lòng yêu cầu gửi lại.",
        )

    # -----------------------------------------------------
    # Bước 4: Kiểm tra số lần nhập sai.
    # -----------------------------------------------------

    if record.attempts >= MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail=(
                "Bạn đã nhập sai quá số lần cho phép. "
                "Vui lòng yêu cầu gửi lại mã."
            ),
        )

    # -----------------------------------------------------
    # Bước 5: So sánh hash OTP.
    # -----------------------------------------------------

    submitted_hash = otp_digest(
        email,
        payload.code,
    )

    if not secrets.compare_digest(
        record.code_hash,
        submitted_hash,
    ):
        record.attempts += 1

        await db.commit()

        raise HTTPException(
            status_code=400,
            detail="Mã xác minh không đúng.",
        )

    # -----------------------------------------------------
    # Bước 6: Xác minh thành công.
    # -----------------------------------------------------

    user.is_verified = True

    await db.delete(record)
    await db.commit()

    logger.info(
        "Email verification completed successfully."
    )

    return {
        "message": "Email đã được xác minh. Bạn có thể đăng nhập."
    }


# =========================================================
# 6. RESEND OTP
# =========================================================

@router.post("/resend-verification")
async def resend_verification(
    payload: ResendCodeIn,
    db: AsyncSession = Depends(get_db),
):
    """
    Gửi lại OTP.

    Không tiết lộ email có tồn tại trong hệ thống hay không.
    """

    email = normalize_email(payload.email)

    user = await db.scalar(
        select(User)
        .where(User.email == email)
    )

    if user is not None and not user.is_verified:
        await issue_code(
            db,
            user,
            enforce_cooldown=True,
        )

    return {
        "message": (
            "Nếu tài khoản chưa xác minh, "
            "mã mới sẽ được gửi đến email."
        )
    }
