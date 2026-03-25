@echo off
setlocal
cd /d "%~dp0smartphone"
if not exist node_modules (
  echo [smartphone] Installation des dependances...
  call npm install
)
echo [smartphone] Demarrage de la version telephone (ouverture auto navigateur)...
call npm run dev -- --open
endlocal
