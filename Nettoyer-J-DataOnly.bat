@echo off
setlocal

set "TARGET=J:\RÉGISSEUR INTENDANT\DASBOARDS\SUIVI DE CHANTIERS"

if not exist "%TARGET%" (
  echo Dossier introuvable: %TARGET%
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$target='J:\RÉGISSEUR INTENDANT\DASBOARDS\SUIVI DE CHANTIERS';" ^
  "$keep=@('local_state_fallback.json','backup_state.json','sync_log.json');" ^
  "Get-ChildItem -LiteralPath $target -Force | ForEach-Object { if($_.PSIsContainer){ Remove-Item -LiteralPath $_.FullName -Recurse -Force; return }; if($keep -contains $_.Name){ return }; Remove-Item -LiteralPath $_.FullName -Force };" ^
  "Write-Host 'Nettoyage J termine.'"

if errorlevel 1 (
  echo Echec du nettoyage.
  pause
  exit /b 1
)

echo Nettoyage termine (cible: %TARGET%).
endlocal
