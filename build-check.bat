@echo off
setlocal
cd /d "%~dp0"
set LOG=build-log2.txt
echo VIBEFUNNY build check 2 > %LOG%
echo ===== stopping development server on 3001 ===== >> %LOG%
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r /c:":3001 .*LISTENING"') do taskkill /f /pid %%a >> %LOG% 2>&1
ping -n 3 127.0.0.1 >nul
echo ===== cleaning development build output ===== >> %LOG%
if exist .next-vibefunny rmdir /s /q .next-vibefunny
ping -n 2 127.0.0.1 >nul
echo ===== BUILD ===== >> %LOG%
call npm run build >> %LOG% 2>&1
echo build_exit=%errorlevel% >> %LOG%
echo ===== DONE ===== >> %LOG%
echo Finished. See build-log2.txt
pause
