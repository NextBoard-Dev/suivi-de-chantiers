$ErrorActionPreference = "Stop"

$port = 8765
$prefix = "http://127.0.0.1:$port/"
$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$launcher = Join-Path $rootDir "Ouvrir-Suivi-de-Chantiers-Auto.bat"
$primaryDir = "J:\RÉGISSEUR INTENDANT\DASBOARDS\SUIVI DE CHANTIERS"
$fallbackDir = "C:\Users\sebastien.duc\CLOUD\02_ARCHIVAGE PERSONNEL\DASHBOARDS\SUIVI DE CHANTIERS"
$stateFileName = "local_state_fallback.json"

if (!(Test-Path -LiteralPath $launcher)) {
  throw "Lanceur introuvable: $launcher"
}

function Resolve-DataDirectory {
  if (Test-Path -LiteralPath (Join-Path $primaryDir "index.html")) { return $primaryDir }
  if (Test-Path -LiteralPath (Join-Path $fallbackDir "index.html")) { return $fallbackDir }
  return $fallbackDir
}

function Get-StateFilePath {
  $dir = Resolve-DataDirectory
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
  return (Join-Path $dir $stateFileName)
}

function Read-RequestBody([System.Net.HttpListenerRequest]$request) {
  $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
  try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
}

function Write-JsonResponse([System.Net.HttpListenerResponse]$res, [int]$statusCode, [string]$json) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $res.StatusCode = $statusCode
  $res.ContentType = "application/json; charset=utf-8"
  $res.ContentLength64 = $bytes.Length
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
  $res.OutputStream.Close()
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host "Fallback agent actif sur $prefix"

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    $path = ($req.Url.AbsolutePath ?? "/").ToLowerInvariant()

    $statusCode = 200
    $body = ""

    if ($path -eq "/health") {
      $body = '{"ok":true,"service":"fallback-agent"}'
    } elseif ($path -eq "/fallback") {
      Start-Process -FilePath $launcher -WindowStyle Hidden | Out-Null
      $body = '{"ok":true,"action":"opened_local_dashboard"}'
    } elseif ($path -eq "/state/load") {
      $stateFile = Get-StateFilePath
      if (Test-Path -LiteralPath $stateFile) {
        $raw = Get-Content -LiteralPath $stateFile -Raw
        if ([string]::IsNullOrWhiteSpace($raw)) {
          $body = '{"ok":false,"error":"empty_state_file"}'
          $statusCode = 404
        } else {
          $body = $raw
        }
      } else {
        $body = '{"ok":false,"error":"no_local_state"}'
        $statusCode = 404
      }
    } elseif ($path -eq "/state/save" -and $req.HttpMethod -eq "POST") {
      try {
        $rawBody = Read-RequestBody $req
        $payload = $rawBody | ConvertFrom-Json
        if ($null -eq $payload.state_json) {
          throw "state_json manquant"
        }
        $stateFile = Get-StateFilePath
        $outObj = [ordered]@{
          ok = $true
          source = "local_fallback"
          updated_at = (Get-Date).ToString("o")
          pending_sync = $true
          last_synced_at = $null
          state_json = $payload.state_json
        }
        $json = $outObj | ConvertTo-Json -Depth 100
        Set-Content -LiteralPath $stateFile -Value $json -Encoding UTF8
        $body = '{"ok":true,"saved":"local_state_fallback.json"}'
      } catch {
        $statusCode = 400
        $msg = ($_.Exception.Message -replace '"', '\"')
        $body = "{""ok"":false,""error"":""$msg""}"
      }
    } elseif ($path -eq "/state/mark-synced" -and $req.HttpMethod -eq "POST") {
      try {
        $stateFile = Get-StateFilePath
        if (!(Test-Path -LiteralPath $stateFile)) {
          $statusCode = 404
          $body = '{"ok":false,"error":"no_local_state"}'
        } else {
          $raw = Get-Content -LiteralPath $stateFile -Raw
          $obj = $raw | ConvertFrom-Json
          $obj.pending_sync = $false
          $obj.last_synced_at = (Get-Date).ToString("o")
          $json = $obj | ConvertTo-Json -Depth 100
          Set-Content -LiteralPath $stateFile -Value $json -Encoding UTF8
          $body = '{"ok":true,"synced":true}'
        }
      } catch {
        $statusCode = 400
        $msg = ($_.Exception.Message -replace '"', '\"')
        $body = "{""ok"":false,""error"":""$msg""}"
      }
    } else {
      $statusCode = 404
      $body = '{"ok":false,"error":"not_found"}'
    }
    Write-JsonResponse $res $statusCode $body
  }
}
finally {
  if ($listener.IsListening) {
    $listener.Stop()
  }
  $listener.Close()
}
