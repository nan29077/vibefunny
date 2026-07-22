@echo off
echo Stopping any process on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000"') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo Cleaning .next cache...
if exist ".next" rmdir /s /q ".next"
echo Starting dev server on port 3000...
cd /d "%~dp0"
npm run dev
