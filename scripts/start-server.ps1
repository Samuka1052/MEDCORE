$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDirectory = Join-Path $projectRoot '.medcore-runtime'
$pidFile = Join-Path $runtimeDirectory 'server.pid'
$port = 3005

if ($env:PORT -match '^\d+$') {
  $port = [int]$env:PORT
} else {
  $envFile = Join-Path $projectRoot '.env'
  if (Test-Path $envFile) {
    $portLine = Get-Content $envFile | Where-Object { $_ -match '^\s*PORT\s*=' } | Select-Object -First 1
    if ($portLine -match '^\s*PORT\s*=\s*"?(\d+)"?\s*$') {
      $port = [int]$matches[1]
    }
  }
}

if ($port -lt 1 -or $port -gt 65535) {
  throw "Porta inválida configurada para o servidor: $port"
}

$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
  throw "A porta $port já está em uso pelo processo $($listener.OwningProcess). Nenhum servidor novo foi iniciado."
}

New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
$server = Start-Process `
  -FilePath $nodePath `
  -ArgumentList 'server.js' `
  -WorkingDirectory $projectRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $runtimeDirectory 'server.log') `
  -RedirectStandardError (Join-Path $runtimeDirectory 'server-error.log') `
  -PassThru

Set-Content -Path $pidFile -Value $server.Id -NoNewline

$listener = $null
for ($attempt = 0; $attempt -lt 20 -and -not $listener; $attempt++) {
  Start-Sleep -Seconds 1
  $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.OwningProcess -eq $server.Id } |
    Select-Object -First 1
}

if (-not $listener) {
  $server.Refresh()
  if ($server.HasExited) {
    Remove-Item -Path $pidFile -ErrorAction SilentlyContinue
    throw "O servidor encerrou durante a inicialização. Consulte $(Join-Path $runtimeDirectory 'server-error.log')."
  }
  throw "O servidor não abriu a porta $port no tempo esperado. Consulte os logs em $runtimeDirectory."
}

$response = Invoke-WebRequest -Uri "http://localhost:$port/" -UseBasicParsing -TimeoutSec 5
if ($response.StatusCode -ne 200) {
  throw "O servidor iniciou, mas respondeu HTTP $($response.StatusCode) em http://localhost:$port/."
}

Write-Output "Servidor MEDCORE iniciado em segundo plano na porta $port (PID $($server.Id))."
Write-Output "Logs: $runtimeDirectory"
