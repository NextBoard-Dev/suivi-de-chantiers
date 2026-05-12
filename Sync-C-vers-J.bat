@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\Sync-C-vers-J.ps1"
if errorlevel 1 (
  echo.
  echo Echec de synchronisation C vers J.
  pause
  exit /b 1
)
echo.
echo Synchronisation C vers J OK.
endlocal
