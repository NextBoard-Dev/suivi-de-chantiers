$ErrorActionPreference = "Stop"

$urls = @(
  @{ Name = "Supabase Auth Health"; Url = "https://uioqchhbakcvemknqikh.supabase.co/auth/v1/health" },
  @{ Name = "Dashboard Heberge"; Url = "https://nextboard-dev.github.io/suivi-de-chantiers/" },
  @{ Name = "Dashboard Local"; Url = "http://localhost:5500/index.html" }
)

$failed = $false
$now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Write-Host "Healthcheck Dashboard - $now"
Write-Host "----------------------------------------"

foreach ($item in $urls) {
  try {
    $resp = Invoke-WebRequest -Uri $item.Url -Method Get -TimeoutSec 8 -UseBasicParsing
    if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 400) {
      Write-Host ("OK   | {0} | {1}" -f $item.Name, $resp.StatusCode)
    } else {
      $failed = $true
      Write-Host ("FAIL | {0} | HTTP {1}" -f $item.Name, $resp.StatusCode)
    }
  } catch {
    $failed = $true
    Write-Host ("FAIL | {0} | {1}" -f $item.Name, $_.Exception.Message)
  }
}

Write-Host "----------------------------------------"
if ($failed) {
  Write-Host "Etat global: INCIDENT"
  exit 1
}

Write-Host "Etat global: OK"
exit 0
