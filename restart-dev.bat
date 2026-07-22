@echo off
echo Stopping any development server on port 3001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r /c:":3001 .*LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo Cleaning the VIBEFUNNY development cache...
if exist ".next-vibefunny" rmdir /s /q ".next-vibefunny"
echo Starting dev server on port 3001...
cd /d "%~dp0"
npm run dev
