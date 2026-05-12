@echo off
setlocal
cd /d "%~dp0"
start "Dashboard-Fallback-Agent" powershell -NoProfile -ExecutionPolicy Bypass -File ".\Start-Local-Fallback-Agent.ps1"
echo Agent local de secours demarre (http://127.0.0.1:8765/health).
endlocal
