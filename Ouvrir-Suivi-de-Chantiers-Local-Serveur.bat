@echo off
setlocal
cd /d "%~dp0"

set "PORT=5500"

where py >nul 2>nul
if %errorlevel%==0 (
  start "Suivi-Chantiers-Local-Serveur" cmd /c py -m http.server %PORT%
) else (
  where python >nul 2>nul
  if %errorlevel%==0 (
    start "Suivi-Chantiers-Local-Serveur" cmd /c python -m http.server %PORT%
  ) else (
    echo Python est introuvable. Installe Python pour utiliser ce lanceur.
    pause
    exit /b 1
  )
)

timeout /t 2 /nobreak >nul
start "" "http://localhost:%PORT%/index.html"

endlocal
