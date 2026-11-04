# DevTask – Hệ thống quản lý công việc và dự án CNTT

DevTask là ứng dụng web hỗ trợ quản lý dự án, công việc và cộng tác nhóm dành cho các nhóm phát triển phần mềm. Hệ thống cung cấp các công cụ theo dõi tiến độ, quản lý thành viên, tổ chức công việc theo nhóm và hỗ trợ AI trong quá trình triển khai dự án.

## 1. Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Frontend | React 19, Vite 8, JavaScript |
| Điều hướng | React Router 7 |
| Biểu tượng | Lucide React |
| Backend | Python, FastAPI |
| ORM | SQLAlchemy 2 |
| Kiểm tra dữ liệu | Pydantic 2 |
| Database | PostgreSQL |
| Driver PostgreSQL | asyncpg |
| Xác thực | JWT, Passlib, bcrypt |
| Gửi email | Gmail SMTP |
| AI | Ollama, Qwen 2.5 |
| Giao tiếp HTTP với AI | HTTPX |
| Quản lý mã nguồn | Git, GitHub |

## 2. Chức năng chính

### 2.1. Tài khoản và xác thực
- Đăng ký và đăng nhập.
- Xác minh email bằng mã OTP.
- Xác thực người dùng bằng JWT.
- Quản lý hồ sơ cá nhân.
- Phân quyền truy cập các chức năng theo tài khoản và vai trò.

### 2.2. Quản lý dự án
- Tạo và quản lý dự án.
- Cập nhật thông tin dự án.
- Tham gia dự án bằng mã tham gia.
- Quản lý thành viên và vai trò trong dự án.
- Liên kết kho mã nguồn GitHub với dự án.

### 2.3. Quản lý công việc
- Tạo, xem, chỉnh sửa và xóa Task.
- Theo dõi trạng thái và mức độ ưu tiên.
- Quản lý người phụ trách và thời hạn.
- Phân nhóm công việc.
- Quản lý Subtask.
- Theo dõi công việc trên giao diện Kanban.
- Hỗ trợ theo dõi tiến độ thực hiện.

### 2.4. Quản lý chi phí dự án
- Thiết lập ngân sách dự kiến.
- Quản lý ngày bắt đầu và ngày kết thúc.
- Tạo và chỉnh sửa danh mục chi phí.
- Quản lý các khoản chi thực tế.
- Tính tổng chi phí thực tế và ngân sách còn lại.
- Phân quyền chỉnh sửa chi phí cho chủ dự án.

### 2.5. Hỗ trợ trí tuệ nhân tạo
- Trò chuyện với Project AI.
- Khai thác thông tin và ngữ cảnh của dự án.
- Quản lý Knowledge Base.
- Quản lý hồ sơ AI của dự án.
- Đề xuất chia nhỏ Task thành Subtask.
- Xem xét và chấp nhận hoặc từ chối đề xuất từ AI.

## 3. Kiến trúc hệ thống

Hệ thống sử dụng mô hình Frontend – Backend – Database:

```text
             NGƯỜI DÙNG
                  |
                  v
       FRONTEND - REACT + VITE
          localhost:5173
                  |
             HTTP / REST API
                  |
                  v
          BACKEND - FASTAPI
          localhost:8000
                  |
          +-------+-------+
          |               |
          v               v
     POSTGRESQL         OLLAMA
     Database           Qwen 2.5
          |
          v
     Lưu trữ dữ liệu
```

Frontend chịu trách nhiệm hiển thị giao diện và gửi yêu cầu đến Backend.

Backend xử lý nghiệp vụ, xác thực, phân quyền và truy xuất dữ liệu.

PostgreSQL lưu trữ thông tin tài khoản, dự án, công việc, chi phí và dữ liệu liên quan.

Ollama cung cấp mô hình AI phục vụ các chức năng hỗ trợ quản lý dự án.

## 4. Cấu trúc thư mục

```text
project-managenemt/
│
├── backend/
│   ├── ai/
│   │   ├── providers/
│   │   ├── services/
│   │   ├── chat_router.py
│   │   ├── knowledge_router.py
│   │   ├── profile_router.py
│   │   ├── models.py
│   │   └── schemas.py
│   │
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── auth_utils.py
│   ├── auth_deps.py
│   ├── email_service.py
│   ├── email_verification.py
│   ├── project_costs.py
│   ├── project_groups.py
│   ├── group_kanban.py
│   ├── subtask_focus.py
│   ├── name_tags.py
│   ├── .env.example
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── features/
│   │   ├── routes/
│   │   ├── App.jsx
│   │   └── main.jsx
│   │
│   ├── package.json
│   └── vite.config.js
│
├── README.md
└── .gitignore
```

## 5. Yêu cầu môi trường

Trước khi cài đặt dự án, cần chuẩn bị:

| Phần mềm | Phiên bản khuyến nghị | Mục đích |
|---|---|---|
| Python | 3.12 | Chạy Backend |
| Node.js | 22 LTS | Chạy Frontend |
| npm | Đi kèm Node.js | Cài package Frontend |
| PostgreSQL | 15 trở lên | Lưu trữ dữ liệu |
| Git | Phiên bản ổn định mới | Quản lý mã nguồn |
| Ollama | Phiên bản hiện hành | Chạy mô hình AI, nếu sử dụng AI |

Có thể dùng Visual Studio Code và pgAdmin 4 để hỗ trợ phát triển, quản lý mã nguồn và cơ sở dữ liệu.

## 6. Clone dự án từ GitHub

Mở PowerShell hoặc Terminal:

```bash
git clone https://github.com/tigerr14436/project-managenemt.git
```

Di chuyển vào thư mục dự án:

```bash
cd project-managenemt
```

## 7. Cấu hình PostgreSQL

Mỗi thành viên sử dụng PostgreSQL trên máy cá nhân và tự tạo database.

Ví dụ:

```sql
CREATE DATABASE project_management;
```

Thông tin kết nối mẫu:

```text
Host: localhost
Port: 5432
Database: project_management
Username: postgres
Password: Mật khẩu PostgreSQL của máy
```

Tên database có thể thay đổi, miễn là thông tin trong biến môi trường `DATABASE_URL` khớp với cấu hình thực tế.

## 8. Cấu hình Backend

### 8.1. Tạo môi trường ảo

Mở Terminal:

```powershell
cd backend
```

Tạo môi trường ảo:

```powershell
python -m venv .venv
```

Kích hoạt:

```powershell
.\.venv\Scripts\Activate.ps1
```

Nếu PowerShell không cho phép chạy script kích hoạt, có thể dùng Command Prompt:

```cmd
.venv\Scripts\activate.bat
```

### 8.2. Cài đặt thư viện

```powershell
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

### 8.3. Tạo file môi trường

Sao chép file mẫu:

```powershell
Copy-Item .env.example .env
```

Mở `backend/.env` và cập nhật thông tin:

```env
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD@localhost:5432/project_management

JWT_SECRET_KEY=YOUR_RANDOM_SECRET_KEY_AT_LEAST_32_CHARACTERS

OTP_PEPPER=YOUR_RANDOM_OTP_PEPPER_AT_LEAST_32_CHARACTERS

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL=your_email@gmail.com
SMTP_APP_PASSWORD=your_gmail_app_password

DATABASE_ECHO=false
```

Thay các giá trị mẫu bằng thông tin riêng của từng máy.

Lưu ý:
- `DATABASE_URL`: thông tin kết nối PostgreSQL.
- `JWT_SECRET_KEY`: khóa bí mật ký JWT, tối thiểu 32 ký tự.
- `OTP_PEPPER`: khóa bí mật dùng để tạo mã băm OTP, tối thiểu 32 ký tự.
- `SMTP_EMAIL`: tài khoản Gmail dùng gửi mã xác minh.
- `SMTP_APP_PASSWORD`: Gmail App Password, không phải mật khẩu đăng nhập Gmail.
- Không chia sẻ hoặc commit file `.env` lên GitHub.

## 9. Chạy Backend

Đảm bảo đang ở thư mục `backend` và đã kích hoạt môi trường ảo.

Chạy lệnh:

```powershell
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Nếu chạy thành công, Backend hoạt động tại:

```text
http://127.0.0.1:8000
```

Tài liệu API Swagger:

```text
http://127.0.0.1:8000/docs
```

## 10. Cấu hình và chạy Frontend

Mở Terminal mới tại thư mục gốc dự án:

```powershell
cd frontend
```

Cài các package được khai báo trong `package.json`:

```powershell
npm install
```

Khởi động Vite:

```powershell
npm run dev
```

Frontend mặc định hoạt động tại:

```text
http://localhost:5173
```

Mở địa chỉ này trên trình duyệt để sử dụng DevTask.

## 11. Cấu hình Ollama cho chức năng AI

Các chức năng Project AI sử dụng Ollama để chạy mô hình ngôn ngữ cục bộ.

Cài Ollama từ:

https://ollama.com/

Sau khi cài đặt, mở Terminal và tải mô hình được cấu hình mặc định trong Backend:

```powershell
ollama pull qwen2.5:7b-instruct-q4_K_M
```

Kiểm tra mô hình:

```powershell
ollama list
```

Ollama mặc định cung cấp API tại:

```text
http://localhost:11434
```

Nếu Ollama chưa chạy, các chức năng AI cần kết nối đến Ollama sẽ không hoạt động. Các chức năng quản lý tài khoản, dự án và công việc không cần Ollama để vận hành.

## 12. Các thư viện sử dụng

### 12.1. Backend – Python

| Thư viện | Chức năng |
|---|---|
| fastapi | Xây dựng REST API |
| uvicorn | Khởi chạy máy chủ ASGI |
| sqlalchemy | ORM và truy vấn cơ sở dữ liệu |
| asyncpg | Kết nối PostgreSQL bất đồng bộ |
| pydantic | Kiểm tra và chuẩn hóa dữ liệu |
| email-validator | Kiểm tra địa chỉ email |
| python-dotenv | Đọc cấu hình từ file `.env` |
| python-jose | Tạo và xác thực JWT |
| passlib | Quản lý hàm băm mật khẩu |
| bcrypt | Băm và kiểm tra mật khẩu |
| httpx | Gửi yêu cầu HTTP đến Ollama |

Các thư viện `asyncio`, `uuid`, `datetime`, `hashlib`, `secrets`, `smtplib`, `ssl`, `email` và `json` thuộc thư viện chuẩn của Python, không cần cài riêng.

### 12.2. Frontend – Node.js

Các dependencies được khai báo trong `frontend/package.json`:

| Package | Chức năng |
|---|---|
| react | Xây dựng giao diện người dùng |
| react-dom | Hiển thị ứng dụng React |
| react-router-dom | Điều hướng giữa các trang |
| lucide-react | Bộ biểu tượng giao diện |

Các devDependencies:

| Package | Chức năng |
|---|---|
| vite | Công cụ phát triển và build Frontend |
| @vitejs/plugin-react | Hỗ trợ React trong Vite |
| @babel/core | Nền tảng biên dịch Babel |
| @rolldown/plugin-babel | Tích hợp Babel với Rolldown |
| babel-plugin-react-compiler | Hỗ trợ React Compiler |
| oxlint | Kiểm tra chất lượng mã nguồn |
| @types/react | Kiểu dữ liệu TypeScript cho React |
| @types/react-dom | Kiểu dữ liệu TypeScript cho React DOM |

Không cần cài từng package bằng tay. Chỉ cần chạy `npm install` trong thư mục `frontend`.

## 13. Kiểm thử API

Sau khi Backend khởi động, truy cập:

```text
http://127.0.0.1:8000/docs
```

Swagger hỗ trợ kiểm thử các API được khai báo trong Backend.

Một số nhóm API chính:

- Authentication: đăng ký, đăng nhập và xác minh email.
- Users: quản lý thông tin tài khoản.
- Projects: quản lý dự án.
- Tasks: quản lý công việc.
- Project Groups: quản lý nhóm công việc.
- Kanban và Subtasks: quản lý tiến độ và công việc con.
- Project Costs: quản lý ngân sách và chi phí.
- Project AI: trò chuyện, ngữ cảnh và các đề xuất AI.

Các API được bảo vệ yêu cầu gửi JWT trong header:

```http
Authorization: Bearer <access_token>
```

## 14. Một số lỗi thường gặp

### Lỗi kết nối PostgreSQL

Kiểm tra:
- PostgreSQL đã được khởi động.
- Database đã được tạo.
- Username và password chính xác.
- `DATABASE_URL` trong `backend/.env` đúng.

### Lỗi ModuleNotFoundError

Kích hoạt lại môi trường ảo và cài thư viện:

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

### Lỗi đăng nhập liên quan đến bcrypt

DevTask sử dụng Passlib với bcrypt. Cần giữ đúng phiên bản tương thích:

```text
passlib==1.7.4
bcrypt==4.0.1
```

Không tự ý nâng bcrypt lên phiên bản 5.x khi chưa kiểm tra tương thích với Passlib.

### Frontend báo Failed to fetch

Kiểm tra:
- Backend có đang chạy tại `http://127.0.0.1:8000` không.
- Frontend gọi đúng API URL không.
- CORS có cho phép `http://localhost:5173` không.
- Request có gửi JWT nếu API yêu cầu xác thực không.
- Backend có phát sinh lỗi trong Terminal không.

### Không gửi được email OTP

Kiểm tra:
- `SMTP_EMAIL` chính xác.
- `SMTP_APP_PASSWORD` là Gmail App Password hợp lệ.
- SMTP host và port đúng.
- Kết nối Internet của máy.

### Chức năng AI không phản hồi

Kiểm tra:
- Ollama đã được cài đặt và đang chạy.
- Đã tải mô hình `qwen2.5:7b-instruct-q4_K_M`.
- Ollama hoạt động tại `http://localhost:11434`.

## 15. Quy trình làm việc nhóm với GitHub

Sau khi clone dự án, mỗi thành viên làm việc trên source code tại máy cá nhân.

Lấy phiên bản mới nhất:

```bash
git pull origin main
```

Kiểm tra thay đổi:

```bash
git status
```

Thêm các thay đổi:

```bash
git add .
```

Tạo commit:

```bash
git commit -m "Update project features"
```

Đẩy thay đổi lên GitHub:

```bash
git push origin main
```

Trước khi push, cần kiểm tra để bảo đảm không đưa các file `.env`, mật khẩu, khóa bí mật, dữ liệu cá nhân hoặc thư mục môi trường ảo lên GitHub.

## 16. Lưu ý khi triển khai trên nhiều máy

Mỗi thành viên cần tự chuẩn bị:
- Python và môi trường ảo riêng.
- Node.js và package Frontend.
- PostgreSQL và database riêng.
- File `backend/.env` riêng.
- Ollama và mô hình AI nếu cần sử dụng chức năng AI.

Không sử dụng chung mật khẩu PostgreSQL, Gmail App Password, JWT Secret hoặc OTP Pepper giữa các máy.

**Lưu ý về dữ liệu:** PostgreSQL cục bộ của mỗi thành viên là độc lập. GitHub chỉ đồng bộ mã nguồn, không tự động đồng bộ dữ liệu trong database.

---

**DevTask – Hệ thống quản lý công việc và dự án CNTT**

Repository: https://github.com/tigerr14436/project-managenemt
