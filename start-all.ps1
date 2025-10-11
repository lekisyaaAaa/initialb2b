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
    [void](Invoke-RestMethod -Uri $url -Method GET -TimeoutSec 5 -ErrorAction Stop)
    return $true
  } catch {
    return $false
  }
}

Write-Host "Starting services (backend -> localhost:$BackendPort, frontend -> common ports ${FrontendPorts -join ','})" -ForegroundColor Cyan

# Start backend if not healthy
$healthUrl = "http://127.0.0.1:$BackendPort/api/health"

# Resolve repository root once so relative paths resolve correctly even when this script
# is invoked from a different working directory. Use the script's directory ($PSScriptRoot)
# which points to the folder containing this script.
$repoRoot = (Resolve-Path $PSScriptRoot).ProviderPath

# Try to ensure PM2-managed processes are started. If PM2 isn't available, fall back to
# starting the backend directly. Running pm2 from the repository root ensures the
# relative `cwd` entries in `ecosystem.config.js` (./backend, ./frontend) resolve.
try {
  Push-Location -Path $repoRoot
  $pm2Output = & pm2 start ecosystem.config.js 2>&1
  Pop-Location
  Write-Host "PM2 output (ensure processes): $pm2Output" -ForegroundColor Gray
} catch {
  Write-Host "PM2 not available or failed to start processes, falling back to direct start..." -ForegroundColor Yellow
  # Start backend directly as a last-resort fallback
  [void](Start-Process -FilePath node -ArgumentList 'server.js' -WorkingDirectory (Join-Path $repoRoot 'backend') -PassThru -WindowStyle Hidden)
}

$sw = [diagnostics.stopwatch]::StartNew()
while (-not (Test-HttpOk $healthUrl) -and $sw.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
  Start-Sleep -Seconds 1
}
if (Test-HttpOk $healthUrl) {
  Write-Host "Backend started and healthy at $healthUrl" -ForegroundColor Green
} else {
  Write-Host "Backend did not become healthy within $TimeoutSeconds seconds. Check PM2 status with 'pm2 list' or logs with 'pm2 logs'" -ForegroundColor Red
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
  $cmd = "set PORT=3002 && npm run start"

  # First try to ensure PM2 manages the frontend (no-op if already running).
  try {
    Push-Location -Path $repoRoot
    $pm2Output = & pm2 start ecosystem.config.js 2>&1
    Pop-Location
    Write-Host "PM2 output (frontend ensure): $pm2Output" -ForegroundColor Gray
  } catch {
    Write-Host "PM2 not available; launching frontend directly..." -ForegroundColor Yellow
    # Launch frontend via cmd inside frontend working directory; use repoRoot to reliably resolve path
    [void](Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $cmd -WorkingDirectory (Join-Path $repoRoot 'frontend') -PassThru -WindowStyle Hidden)
  }

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

# Show PM2 status if available
Write-Host "---- PM2 Status ----" -ForegroundColor Cyan
try {
  $pm2Status = & pm2 list 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "PM2 processes:" -ForegroundColor Gray
    Write-Host $pm2Status -ForegroundColor Gray
    Write-Host "PM2 commands:" -ForegroundColor Yellow
    Write-Host "  pm2 list          - Show process status" -ForegroundColor Gray
    Write-Host "  pm2 logs          - Show logs" -ForegroundColor Gray
    Write-Host "  pm2 restart all   - Restart all processes" -ForegroundColor Gray
    Write-Host "  pm2 stop all      - Stop all processes" -ForegroundColor Gray
  }
} catch {
  Write-Host "PM2 not available or no processes running" -ForegroundColor Gray
}

Write-Host "To stop services: use Task Manager to end 'node.exe' processes started by these scripts or run 'Get-Process node | Stop-Process' in PowerShell (careful - may stop other node apps)." -ForegroundColor Yellow
Write-Host 'If you prefer a single-console run (foreground), run: `node backend/server.js` and in another shell `cd frontend && npm run start`' -ForegroundColor Yellow
