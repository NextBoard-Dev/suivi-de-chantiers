$ErrorActionPreference = "Stop"

$source = "C:\Users\sebastien.duc\CLOUD\02_ARCHIVAGE PERSONNEL\DASHBOARDS\SUIVI DE CHANTIERS"
$target = "J:\RÉGISSEUR INTENDANT\DASBOARDS\SUIVI DE CHANTIERS"

if (!(Test-Path -LiteralPath $source)) {
  throw "Source introuvable: $source"
}

New-Item -ItemType Directory -Path $target -Force | Out-Null

# /MIR: miroir C -> J (ajouts/modifs/suppressions)
# /XD, /XF: exclusions pour eviter les poids inutiles et artefacts locaux
robocopy $source $target /MIR /R:1 /W:1 /FFT `
  /XD ".git" "node_modules" "snapshots_ok" `
  /XF "*.tmp" "*.log" "Thumbs.db" `
  /NFL /NDL /NP /NJH /NJS | Out-Null

$exitCode = $LASTEXITCODE
if ($exitCode -ge 8) {
  throw "robocopy a echoue (code $exitCode)"
}

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Write-Host "Sync C -> J terminee ($stamp). Code robocopy: $exitCode"
