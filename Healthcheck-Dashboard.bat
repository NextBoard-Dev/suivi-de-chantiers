@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\Healthcheck-Dashboard.ps1"
if errorlevel 1 (
  echo.
  echo Healthcheck en echec.
  exit /b 1
)
echo.
echo Healthcheck OK.
endlocal
