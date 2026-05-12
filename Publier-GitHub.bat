@echo off
setlocal
cd /d "%~dp0"

echo [1/4] Synchronisation C vers J...
call ".\Sync-C-vers-J.bat"
if errorlevel 1 exit /b 1

echo [2/4] Verification git...
git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
  echo Ce dossier n'est pas un depot git valide.
  pause
  exit /b 1
)

echo [3/4] Commit...
set "MSG=%~1"
if "%MSG%"=="" set "MSG=chore: sync dashboard updates"
git add -A
git commit -m "%MSG%"
if errorlevel 1 (
  echo Aucun commit cree (rien a committer ou erreur).
)

echo [4/4] Push...
git push
if errorlevel 1 (
  echo Echec du push.
  pause
  exit /b 1
)

echo Publication GitHub terminee.
endlocal
