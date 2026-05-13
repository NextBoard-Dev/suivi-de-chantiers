@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\Nettoyer-J-DataOnly.ps1"
if errorlevel 1 (
  echo.
  echo Echec nettoyage J (lecteur indisponible ou erreur).
  pause
  exit /b 1
)
echo.
echo Nettoyage J termine.
endlocal
