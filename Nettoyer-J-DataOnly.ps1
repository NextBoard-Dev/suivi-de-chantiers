$ErrorActionPreference = "Stop"

$target = "J:\RÉGISSEUR INTENDANT\DASBOARDS\SUIVI DE CHANTIERS"
if (!(Test-Path -LiteralPath $target)) {
  throw "Lecteur/dossier introuvable: $target"
}

New-Item -ItemType Directory -Path $target -Force | Out-Null

$keepFiles = @(
  "local_state_fallback.json",
  "backup_state.json",
  "sync_log.json"
)

Get-ChildItem -LiteralPath $target -Force | ForEach-Object {
  if ($_.PSIsContainer) {
    Remove-Item -LiteralPath $_.FullName -Recurse -Force
    return
  }
  if ($keepFiles -contains $_.Name) { return }
  Remove-Item -LiteralPath $_.FullName -Force
}

Write-Host "Nettoyage J termine (mode data-only)."
