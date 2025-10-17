<#
start-all.ps1

Starts backend and frontend dev servers on Windows, waits for health, and prints helpful info.
Usage: Open PowerShell, run:
  powershell -ExecutionPolicy Bypass -File .\start-all.ps1
#>

param(
  [int]$BackendPort = 5000,
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

Write-Host "Setting up and starting services (backend -> localhost:$BackendPort, frontend -> common ports ${FrontendPorts -join ','})" -ForegroundColor Cyan

# Resolve repository root
$repoRoot = (Resolve-Path $PSScriptRoot).ProviderPath

# Install backend dependencies if needed
Write-Host "Checking backend dependencies..." -ForegroundColor Yellow
Push-Location -Path (Join-Path $repoRoot 'backend')
if (-not (Test-Path 'node_modules')) {
  Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
  & npm install
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to install backend dependencies. Exiting." -ForegroundColor Red
    Pop-Location
    exit 1
  }
}
Pop-Location

# Install frontend dependencies if needed
Write-Host "Checking frontend dependencies..." -ForegroundColor Yellow
Push-Location -Path (Join-Path $repoRoot 'frontend')
if (-not (Test-Path 'node_modules')) {
  Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
  & npm install
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to install frontend dependencies. Exiting." -ForegroundColor Red
    Pop-Location
    exit 1
  }
}

# Build frontend if build doesn't exist
if (-not (Test-Path 'build')) {
  Write-Host "Building frontend..." -ForegroundColor Yellow
  & npm run build
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to build frontend. Exiting." -ForegroundColor Red
    Pop-Location
    exit 1
  }
}
Pop-Location

# Start services with PM2
Write-Host "Starting services with PM2..." -ForegroundColor Yellow
try {
  Push-Location -Path $repoRoot
  $pm2Output = & pm2 start ecosystem.config.js 2>&1
  Pop-Location
  Write-Host "PM2 output: $pm2Output" -ForegroundColor Gray
} catch {
  Write-Host "PM2 not available or failed to start processes. Please install PM2 globally with 'npm install -g pm2'. Exiting." -ForegroundColor Red
  exit 1
}

# Wait for backend health
$healthUrl = "http://127.0.0.1:$BackendPort/api/health"
Write-Host "Waiting for backend to be healthy..." -ForegroundColor Yellow
$sw = [diagnostics.stopwatch]::StartNew()
while (-not (Test-HttpOk $healthUrl) -and $sw.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
  Start-Sleep -Seconds 1
}
if (Test-HttpOk $healthUrl) {
  Write-Host "Backend started and healthy at $healthUrl" -ForegroundColor Green
} else {
  Write-Host "Backend did not become healthy within $TimeoutSeconds seconds. Check PM2 logs with 'pm2 logs btb-backend'" -ForegroundColor Red
}

# Wait for frontend health
$frontendStarted = $false
$frontendPort = $null
Write-Host "Waiting for frontend to be healthy..." -ForegroundColor Yellow
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
  Write-Host "Frontend did not start within $TimeoutSeconds seconds. Check PM2 logs with 'pm2 logs btb-frontend'" -ForegroundColor Red
}

# Final status
Write-Host "---- Summary ----" -ForegroundColor Cyan
if (Test-HttpOk $healthUrl) { Write-Host "Backend: OK - $healthUrl" -ForegroundColor Green } else { Write-Host "Backend: DOWN" -ForegroundColor Red }
if ($frontendStarted) { Write-Host "Frontend: OK - http://127.0.0.1:$frontendPort" -ForegroundColor Green } else { Write-Host "Frontend: DOWN" -ForegroundColor Red }

# Show PM2 status
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
  Write-Host "PM2 not available" -ForegroundColor Gray
}

Write-Host "System started successfully! Access the frontend at http://127.0.0.1:$frontendPort" -ForegroundColor Green
