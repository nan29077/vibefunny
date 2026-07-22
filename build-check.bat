@echo off
setlocal
cd /d "%~dp0"
set LOG=build-log2.txt
echo VIBEFUNNY build check 2 > %LOG%
echo ===== killing node ===== >> %LOG%
taskkill /f /im node.exe >> %LOG% 2>&1
ping -n 3 127.0.0.1 >nul
echo ===== cleaning .next ===== >> %LOG%
if exist .next rmdir /s /q .next
ping -n 2 127.0.0.1 >nul
echo ===== BUILD ===== >> %LOG%
call npm run build >> %LOG% 2>&1
echo build_exit=%errorlevel% >> %LOG%
echo ===== DONE ===== >> %LOG%
echo Finished. See build-log2.txt
pause
