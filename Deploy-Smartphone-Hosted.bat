@echo off
setlocal
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0deploy-smartphone-hosted.ps1"
if errorlevel 1 (
  echo.
  echo ECHEC du deploiement smartphone-hosted.
  exit /b 1
)
echo.
echo Deploy smartphone-hosted termine avec succes.
exit /b 0
