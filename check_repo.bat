@echo off
setlocal
pushd "%~dp0" >nul
echo ========================================
echo CHECK REPO - SUIVI DE CHANTIERS
echo ========================================
echo DOSSIER: "%~dp0"
for /f "delims=" %%i in ('git rev-parse --show-toplevel') do set ROOT=%%i
for /f "delims=" %%i in ('git branch --show-current') do set BRANCH=%%i
for /f "delims=" %%i in ('git remote get-url origin') do set ORIGIN=%%i
echo ROOT   : "%ROOT%"
echo BRANCHE: %BRANCH%
echo ORIGIN : %ORIGIN%
if /I not "%ORIGIN%"=="https://github.com/Mililumatt/suivi-de-chantiers.git" (
  echo.
  echo [ALERTE] REMOTE INATTENDU POUR CHANTIERS
  popd >nul
  exit /b 1
)
echo.
echo OK - CONTEXTE CHANTIERS VALIDE
popd >nul
exit /b 0
