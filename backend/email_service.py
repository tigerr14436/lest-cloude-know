
"""
Gửi email OTP cho DevTask qua SMTP.

Cấu hình trong backend/.env:

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL=your-account@gmail.com
SMTP_APP_PASSWORD=your-new-google-app-password
"""

import logging
import os
import smtplib
import ssl

from email.message import EmailMessage
from pathlib import Path

from dotenv import load_dotenv


# =========================================================
# 1. CONFIGURATION
# =========================================================

BACKEND_DIR = Path(__file__).resolve().parent

# Đọc đúng file backend/.env, không phụ thuộc thư mục chạy lệnh.
load_dotenv(BACKEND_DIR / ".env")

# Khởi tạo logger.
logger = logging.getLogger(__name__)


# =========================================================
# 2. SEND VERIFICATION EMAIL
# =========================================================

def send_verification_email(recipient: str, code: str) -> None:
    """
    Gửi mã OTP đến email người đăng ký.

    Args:
        recipient: Email người nhận.
        code: Mã OTP gồm 6 chữ số.

    Raises:
        RuntimeError: Thiếu hoặc sai cấu hình SMTP.
        ValueError: SMTP_PORT không hợp lệ.
        smtplib.SMTPException: Lỗi giao tiếp SMTP.
        OSError: Lỗi kết nối mạng.
    """

    # -----------------------------------------------------
    # Đọc cấu hình SMTP
    # -----------------------------------------------------

    host = os.getenv(
        "SMTP_HOST",
        "smtp.gmail.com",
    ).strip()

    port_text = os.getenv(
        "SMTP_PORT",
        "587",
    ).strip()

    sender = os.getenv(
        "SMTP_EMAIL",
        "",
    ).strip()

    # Gmail App Password có thể được nhập có dấu cách.
    # Loại bỏ dấu cách trước khi đăng nhập.
    password = "".join(
        os.getenv("SMTP_APP_PASSWORD", "").split()
    )

    # -----------------------------------------------------
    # Kiểm tra cấu hình
    # -----------------------------------------------------

    if not host:
        raise RuntimeError(
            "SMTP_HOST không được để trống."
        )

    if not sender or not password:
        raise RuntimeError(
            "Thiếu SMTP_EMAIL hoặc SMTP_APP_PASSWORD trong backend/.env."
        )

    try:
        port = int(port_text)
    except ValueError as exc:
        raise RuntimeError(
            "SMTP_PORT phải là số nguyên 587 hoặc 465."
        ) from exc

    if port not in (465, 587):
        raise ValueError(
            "DevTask chỉ hỗ trợ SMTP_PORT=587 hoặc SMTP_PORT=465."
        )

    # -----------------------------------------------------
    # Tạo email
    # -----------------------------------------------------

    msg = EmailMessage()

    msg["Subject"] = "DevTask - Mã xác minh email"
    msg["From"] = sender
    msg["To"] = recipient

    msg.set_content(
        f"""
Xin chào,

Bạn vừa yêu cầu xác minh email cho tài khoản DevTask.

Mã xác minh của bạn là:

{code}

Mã có hiệu lực trong 5 phút.

Không chia sẻ mã này với bất kỳ ai.

Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.

Trân trọng,
DevTask
"""
    )

    # Tạo SSL context an toàn.
    context = ssl.create_default_context()

    # -----------------------------------------------------
    # Kết nối và gửi email
    # -----------------------------------------------------

    try:
        logger.info(
            "Đang kết nối SMTP tới %s:%s",
            host,
            port,
        )

        # =================================================
        # PORT 465: SMTP SSL
        # =================================================

        if port == 465:

            with smtplib.SMTP_SSL(
                host,
                port,
                timeout=20,
                context=context,
            ) as smtp:

                smtp.ehlo()

                logger.info(
                    "SMTP: Kết nối SSL thành công."
                )

                smtp.login(
                    sender,
                    password,
                )

                logger.info(
                    "SMTP: Đăng nhập Gmail thành công."
                )

                smtp.send_message(msg)

                logger.info(
                    "SMTP: Gửi email xác minh thành công."
                )

        # =================================================
        # PORT 587: SMTP STARTTLS
        # =================================================

        else:

            with smtplib.SMTP(
                host,
                port,
                timeout=20,
            ) as smtp:

                smtp.ehlo()

                logger.info(
                    "SMTP: Kết nối tới máy chủ thành công."
                )

                smtp.starttls(
                    context=context,
                )

                smtp.ehlo()

                logger.info(
                    "SMTP: STARTTLS thành công."
                )

                smtp.login(
                    sender,
                    password,
                )

                logger.info(
                    "SMTP: Đăng nhập Gmail thành công."
                )

                smtp.send_message(msg)

                logger.info(
                    "SMTP: Gửi email xác minh thành công."
                )

    # -----------------------------------------------------
    # Xử lý lỗi
    # -----------------------------------------------------

    except smtplib.SMTPAuthenticationError:
        logger.exception(
            "SMTP: Gmail từ chối xác thực. "
            "Hãy kiểm tra SMTP_EMAIL và Gmail App Password."
        )
        raise

    except smtplib.SMTPConnectError:
        logger.exception(
            "SMTP: Không thể kết nối tới máy chủ Gmail."
        )
        raise

    except smtplib.SMTPRecipientsRefused:
        logger.exception(
            "SMTP: Máy chủ từ chối địa chỉ email người nhận."
        )
        raise

    except smtplib.SMTPException:
        logger.exception(
            "SMTP: Xảy ra lỗi trong quá trình gửi email."
        )
        raise

    except (OSError, TimeoutError, ssl.SSLError):
        logger.exception(
            "SMTP: Lỗi mạng, timeout hoặc SSL."
        )
        raise
