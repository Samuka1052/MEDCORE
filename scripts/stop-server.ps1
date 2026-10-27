$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDirectory = Join-Path $projectRoot '.medcore-runtime'
$pidFile = Join-Path $runtimeDirectory 'server.pid'

if (-not (Test-Path $pidFile)) {
  throw 'Não encontrei o PID do servidor em segundo plano. Ele pode ter sido iniciado com npm start.'
}

$serverPid = 0
if (-not [int]::TryParse((Get-Content $pidFile -Raw).Trim(), [ref]$serverPid)) {
  throw "O arquivo de PID do servidor está inválido: $pidFile"
}

$server = Get-Process -Id $serverPid -ErrorAction SilentlyContinue
if (-not $server) {
  Remove-Item -Path $pidFile
  Write-Output 'O processo já estava encerrado; removi o PID antigo.'
  exit 0
}

$listeners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.OwningProcess -eq $serverPid }
if (-not $listeners) {
  throw "O PID $serverPid não parece ser o servidor MEDCORE. Não encerrei o processo."
}

Stop-Process -Id $serverPid
Remove-Item -Path $pidFile
Write-Output "Servidor MEDCORE encerrado (PID $serverPid)."
