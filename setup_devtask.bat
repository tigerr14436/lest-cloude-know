@echo off
setlocal EnableExtensions
title DevTask - Cai dat moi truong

echo ==========================================
echo       DEVTASK - CAI DAT THU VIEN
echo ==========================================
echo.

REM Chuyen ve thu muc chua file setup.bat
cd /d "%~dp0"

REM Kiem tra cau truc du an
if not exist "backend\main.py" (
    echo [LOI] Khong tim thay backend\main.py.
    echo Hay dat file setup.bat tai thu muc goc project-managenemt.
    pause
    exit /b 1
)

if not exist "frontend\package.json" (
    echo [LOI] Khong tim thay frontend\package.json.
    pause
    exit /b 1
)

REM Kiem tra Python
where py >nul 2>nul
if errorlevel 1 (
    echo [LOI] Chua cai Python Launcher. Hay cai Python 3.12 hoac 3.13.
    pause
    exit /b 1
)

REM Kiem tra Node.js va npm
where node >nul 2>nul
if errorlevel 1 (
    echo [LOI] Chua cai Node.js. Hay cai Node.js 22 LTS.
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [LOI] Khong tim thay npm. Hay cai lai Node.js 22 LTS.
    pause
    exit /b 1
)

echo.
echo [1/4] Tao moi truong ao Python...
if not exist "backend\.venv\Scripts\python.exe" (
    py -3 -m venv "backend\.venv"
    if errorlevel 1 (
        echo [LOI] Khong tao duoc moi truong ao Python.
        pause
        exit /b 1
    )
) else (
    echo Da co backend\.venv, bo qua buoc tao moi truong ao.
)

echo.
echo [2/4] Nang cap pip...
"backend\.venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 (
    echo [LOI] Khong nang cap duoc pip.
    pause
    exit /b 1
)

echo.
echo [3/4] Cai dat thu vien Backend...
"backend\.venv\Scripts\python.exe" -m pip install ^
    "fastapi" ^
    "uvicorn[standard]" ^
    "sqlalchemy>=2.0" ^
    "asyncpg" ^
    "pydantic>=2.0" ^
    "email-validator" ^
    "python-dotenv" ^
    "python-jose[cryptography]" ^
    "passlib==1.7.4" ^
    "bcrypt==4.0.1" ^
    "httpx"

if errorlevel 1 (
    echo [LOI] Cai dat thu vien Backend that bai.
    pause
    exit /b 1
)

echo.
echo [4/4] Cai dat package Frontend...
cd /d "%~dp0frontend"
call npm install
if errorlevel 1 (
    echo [LOI] Cai dat package Frontend that bai.
    pause
    exit /b 1
)

cd /d "%~dp0"

echo.
echo ==========================================
echo          CAI DAT HOAN TAT
echo ==========================================
echo Backend Python environment: backend\.venv
echo Frontend packages: frontend\node_modules
echo.
echo LUU Y:
echo - Moi thanh vien can tu tao backend\.env tu backend\.env.example.
echo - Can cai va khoi dong PostgreSQL rieng.
echo - Ollama va model AI can cai rieng neu muon dung Project AI.
echo.
echo Lenh chay Backend:
echo   cd backend
echo   .venv\Scripts\activate
echo   python -m uvicorn main:app --reload
echo.
echo Lenh chay Frontend (Terminal moi):
echo   cd frontend
echo   npm run dev
echo.
pause
endlocal
