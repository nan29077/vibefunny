@echo off
cd /d "%~dp0"
rem Check dependencies every run (fast when nothing changed)
call npm install --no-audit --no-fund
npm run dev
pause