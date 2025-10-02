# Run frontend build, start server, run visibility check and print results
param()

Set-Location -Path "${PSScriptRoot}\..\frontend"
Write-Host "Killing processes on port 3002 (if any)"
# Use port-fix.ps1 if available, otherwise best-effort using netstat+taskkill
if (Test-Path "${PSScriptRoot}\port-fix.ps1") {
  & "${PSScriptRoot}\port-fix.ps1" -Port 3002 -Kill
} else {
  $lines = netstat -ano | Select-String ":3002" -ErrorAction SilentlyContinue
  foreach ($ln in $lines) {
    $parts = $ln -split '\s+' | Where-Object { $_ -ne '' }
    $foundPid = $parts[-1]
    if ($foundPid -match '^\d+$') {
      Write-Host "Killing PID $foundPid"
      taskkill /PID $foundPid /F | Out-Null
    }
  }
}

Write-Host "Building frontend"
$env:NODE_DEBUG=$null; $env:DEBUG=$null
npm run build

Write-Host "Starting frontend server"
Start-Process node -ArgumentList 'server.js' -WorkingDirectory (Get-Location) -NoNewWindow -RedirectStandardOutput "${PSScriptRoot}\..\frontend-server.log" -RedirectStandardError "${PSScriptRoot}\..\frontend-server.err" -PassThru | Out-Null
Start-Sleep -Seconds 2

Write-Host "Checking health"
try {
  $h = Invoke-WebRequest -Uri 'http://localhost:3002/health' -UseBasicParsing -TimeoutSec 5
  $h.Content | ConvertFrom-Json | Format-List
} catch {
  Write-Host "Health check failed:" $_.Exception.Message
}

Write-Host "Running visibility check (via run-no-debug.js)"
Set-Location -Path "${PSScriptRoot}"
node run-no-debug.js check-console-visibility.js

Write-Host "Result file contents (if any):"
if (Test-Path "${PSScriptRoot}\check-console-visibility.result.json") {
  Get-Content "${PSScriptRoot}\check-console-visibility.result.json"
} else {
  Write-Host "No result file found. Check logs: ${PSScriptRoot}\..\frontend-server.log and ${PSScriptRoot}\..\frontend-server.err"
}
