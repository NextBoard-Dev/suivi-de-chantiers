@echo off
setlocal

set "PRIMARY_DIR=J:\RÉGISSEUR INTENDANT\DASBOARDS\SUIVI DE CHANTIERS"
set "FALLBACK_DIR=C:\Users\sebastien.duc\CLOUD\02_ARCHIVAGE PERSONNEL\DASHBOARDS\SUIVI DE CHANTIERS"
set "PORT=5500"

set "TARGET_DIR="
if exist "%PRIMARY_DIR%\index.html" set "TARGET_DIR=%PRIMARY_DIR%"
if not defined TARGET_DIR if exist "%FALLBACK_DIR%\index.html" set "TARGET_DIR=%FALLBACK_DIR%"

if not defined TARGET_DIR (
  echo Aucun dossier dashboard valide trouve.
  echo Verifie:
  echo - %PRIMARY_DIR%
  echo - %FALLBACK_DIR%
  pause
  exit /b 1
)

cd /d "%TARGET_DIR%"
echo Demarrage dashboard depuis: %TARGET_DIR%

where py >nul 2>nul
if %errorlevel%==0 (
  start "Suivi-Chantiers-Serveur-Local" cmd /c py -m http.server %PORT%
) else (
  where python >nul 2>nul
  if %errorlevel%==0 (
    start "Suivi-Chantiers-Serveur-Local" cmd /c python -m http.server %PORT%
  ) else (
    echo Python est introuvable. Installe Python pour utiliser ce lanceur.
    pause
    exit /b 1
  )
)

timeout /t 2 /nobreak >nul
start "" "http://localhost:%PORT%/index.html"

endlocal
