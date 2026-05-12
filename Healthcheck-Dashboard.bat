@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\Healthcheck-Dashboard.ps1"
if errorlevel 1 (
  echo.
  echo Healthcheck en echec.
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('Incident dashboard detecte. Verifie Supabase, GitHub et serveur local.','Alerte Dashboard',[System.Windows.MessageBoxButton]::OK,[System.Windows.MessageBoxImage]::Warning) | Out-Null"
  exit /b 1
)
echo.
echo Healthcheck OK.
endlocal
