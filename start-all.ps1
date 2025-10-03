<#
start-all.ps1

Starts backend and frontend dev servers on Windows, waits for health, and prints helpful info.
Usage: Open PowerShell, run:
  powershell -ExecutionPolicy Bypass -File .\start-all.ps1
#>

param(
  [int]$BackendPort = 5000,
  # Always prefer frontend dev server on 3002 for local dev to avoid CRA default conflicts
  [int[]]$FrontendPorts = @(3002),
  [int]$TimeoutSeconds = 60
)

function Test-HttpOk($url) {
  try {
    $r = Invoke-RestMethod -Uri $url -Method GET -TimeoutSec 5 -ErrorAction Stop
    return $true
  } catch {
    return $false
  }
}

Write-Host "Starting services (backend -> localhost:$BackendPort, frontend -> common ports ${FrontendPorts -join ','})" -ForegroundColor Cyan

# Start backend if not healthy
$healthUrl = "http://127.0.0.1:$BackendPort/api/health"
if (Test-HttpOk $healthUrl) {
  Write-Host "Backend already healthy at $healthUrl" -ForegroundColor Green
} else {
  Write-Host "Starting backend..." -ForegroundColor Yellow
  $backendProc = Start-Process -FilePath node -ArgumentList 'backend/server.js' -PassThru -WindowStyle Hidden
  $sw = [diagnostics.stopwatch]::StartNew()
  while (-not (Test-HttpOk $healthUrl) -and $sw.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
    Start-Sleep -Seconds 1
  }
  if (Test-HttpOk $healthUrl) {
    Write-Host "Backend started and healthy at $healthUrl" -ForegroundColor Green
  } else {
    Write-Host "Backend did not become healthy within $TimeoutSeconds seconds. Check logs: backend/server-start.log or run 'node backend/server.js' manually" -ForegroundColor Red
  }
}

# Start frontend
$frontendStarted = $false
foreach ($p in $FrontendPorts) {
  try {
    $h = Invoke-WebRequest -Uri "http://127.0.0.1:$p" -Method Head -TimeoutSec 3 -ErrorAction SilentlyContinue
    if ($h.StatusCode -ge 200) {
      Write-Host "Frontend already serving on http://127.0.0.1:$p" -ForegroundColor Green
      $frontendStarted = $true
      $frontendPort = $p
      break
    }
  } catch { }
}

if (-not $frontendStarted) {
  Write-Host "Starting frontend (wrapped-start) on PORT=3002..." -ForegroundColor Yellow
  # Use cmd to set PORT=3002 for the child process so CRA picks up the dev port reliably.
  # This avoids Start-Process environment limitations on Windows PowerShell 5.1.
  $cmd = "set PORT=3002 && node frontend/scripts/wrapped-start.js"
  $frontendProc = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $cmd -WorkingDirectory (Resolve-Path .) -PassThru -WindowStyle Hidden
  $sw = [diagnostics.stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
    foreach ($p in $FrontendPorts) {
      try {
        $h = Invoke-WebRequest -Uri "http://127.0.0.1:$p" -Method Head -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($h.StatusCode -ge 200) {
          $frontendStarted = $true
          $frontendPort = $p
          break
        }
      } catch { }
    }
    if ($frontendStarted) { break }
    Start-Sleep -Seconds 1
  }
  if ($frontendStarted) {
    Write-Host "Frontend started and serving on http://127.0.0.1:$frontendPort" -ForegroundColor Green
  } else {
    Write-Host "Frontend did not start within $TimeoutSeconds seconds. Check frontend logs or run 'cd frontend && npm run start' manually" -ForegroundColor Red
  }
}

# Final status
Write-Host "---- Summary ----" -ForegroundColor Cyan
if (Test-HttpOk $healthUrl) { Write-Host "Backend: OK - $healthUrl" -ForegroundColor Green } else { Write-Host "Backend: DOWN" -ForegroundColor Red }
if ($frontendStarted) { Write-Host "Frontend: OK - http://127.0.0.1:$frontendPort" -ForegroundColor Green } else { Write-Host "Frontend: DOWN" -ForegroundColor Red }

Write-Host "To stop services: use Task Manager to end 'node.exe' processes started by these scripts or run 'Get-Process node | Stop-Process' in PowerShell (careful - may stop other node apps)." -ForegroundColor Yellow
Write-Host 'If you prefer a single-console run (foreground), run: `node backend/server.js` and in another shell `cd frontend && npm run start`' -ForegroundColor Yellow
