$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$smartphoneDir = Join-Path $root "smartphone"
$distDir = Join-Path $smartphoneDir "dist"
$hostedDir = Join-Path $root "smartphone-hosted"
$hostedAssetsDir = Join-Path $hostedDir "assets"

Write-Host "[1/4] Build smartphone..."
Push-Location $smartphoneDir
try {
  npm run build
} finally {
  Pop-Location
}

if (!(Test-Path $distDir)) {
  throw "Dossier introuvable: $distDir"
}

Write-Host "[2/4] Sync dist -> smartphone-hosted..."
if (Test-Path $hostedAssetsDir) {
  Remove-Item -LiteralPath $hostedAssetsDir -Recurse -Force
}
New-Item -ItemType Directory -Path $hostedAssetsDir -Force | Out-Null

Copy-Item -LiteralPath (Join-Path $distDir "index.html") -Destination (Join-Path $hostedDir "index.html") -Force
Copy-Item -Path (Join-Path $distDir "assets\*") -Destination $hostedAssetsDir -Force

Write-Host "[3/4] Force relative asset paths..."
$hostedIndex = Join-Path $hostedDir "index.html"
$html = Get-Content -LiteralPath $hostedIndex -Raw
$html = $html.Replace('src="/assets/', 'src="./assets/')
$html = $html.Replace('href="/assets/', 'href="./assets/')
Set-Content -LiteralPath $hostedIndex -Value $html -Encoding utf8

Write-Host "[4/4] Align 404.html on smartphone index..."
Copy-Item -LiteralPath $hostedIndex -Destination (Join-Path $hostedDir "404.html") -Force

Write-Host "OK: smartphone-hosted est a jour."
