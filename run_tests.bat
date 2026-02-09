@echo off
cd /d "%~dp0"
node tests\run-tests.mjs
if errorlevel 1 (
  echo.
  echo [ECHEC] Des tests ont echoue.
  echo.
  pause
  exit /b 1
)
echo.
echo [OK] Tous les tests sont passes.
echo.
pause
