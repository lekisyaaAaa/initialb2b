<#
start-all.ps1

Stops any processes listening on ports 5000/3002, installs deps (optional),
starts backend and frontend (detached) with logs, runs the dev seeder, and
verifies health endpoints and a login using the seeded admin (admin/admin).

Usage (from repo root):
    powershell -ExecutionPolicy Bypass -File .\scripts\start-all.ps1

Options:
    -NoInstall    Skip `npm install` steps (faster when deps already installed)
    -Verbose      Print extra progress
#>

param(
    [switch]$NoInstall,
    [switch]$Verbose,
    [int]$BackendPort = 5000,
    [int]$FrontendPort = 3002,
    [int]$TimeoutSeconds = 30
)

$ErrorActionPreference = 'Stop'

function Write-Log { param($m) if($Verbose){ Write-Output $m } }

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'

# stop listeners
foreach($p in @(5000,3002)){
    Write-Log "Checking port $p"
    $conns = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue
    if($conns){
        $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
        foreach($procId in $pids){
            try{ Stop-Process -Id $procId -Force -ErrorAction Stop; Write-Output "Stopped PID $procId on port $p" } catch { Write-Output ("Could not stop PID {0} - {1}" -f $procId, $_.Exception.Message) }
        }
    } else { Write-Log "No listener on $p" }
}

Write-Output "Starting backend..."
Set-Location $backend
if(-not $NoInstall){ Write-Output 'Installing backend dependencies...'; npm install --no-audit --no-fund | Out-Null }
if(-not (Test-Path -Path (Join-Path $backend 'logs'))){ New-Item -ItemType Directory -Path (Join-Path $backend 'logs') | Out-Null }
Start-Process -FilePath node -ArgumentList 'server.js' -WorkingDirectory $backend -RedirectStandardOutput (Join-Path $backend 'logs\stdout.log') -RedirectStandardError (Join-Path $backend 'logs\stderr.log') -WindowStyle Hidden
Start-Sleep -Seconds 2

Write-Output "Running dev seeder..."
try{ node scripts/seed-admin.js | Write-Output } catch { Write-Output "Seeder failed: $($_.Exception.Message)" }

Write-Output "Checking backend health..."
try{
    $hb = Invoke-WebRequest -Uri 'http://localhost:5000/api/health' -UseBasicParsing -TimeoutSec 8
    Write-Output "BACKEND: $($hb.StatusCode)"; Write-Output $hb.Content
} catch { Write-Output "BACKEND_HEALTH_ERR: $($_.Exception.Message)" }

Write-Output "Starting frontend (build + serve)..."
Set-Location $frontend
if(-not $NoInstall){ Write-Output 'Installing frontend dependencies...'; npm install --no-audit --no-fund | Out-Null }
try{ npm run build | Out-Null } catch { Write-Output "Frontend build error: $($_.Exception.Message)" }
if(-not (Test-Path -Path (Join-Path $frontend 'logs'))){ New-Item -ItemType Directory -Path (Join-Path $frontend 'logs') | Out-Null }
Start-Process -FilePath node -ArgumentList 'server.js' -WorkingDirectory $frontend -RedirectStandardOutput (Join-Path $frontend 'logs\stdout.log') -RedirectStandardError (Join-Path $frontend 'logs\stderr.log') -WindowStyle Hidden
Start-Sleep -Seconds 2

Write-Output "Checking frontend health..."
try{
    $hf = Invoke-WebRequest -Uri 'http://localhost:3002/health' -UseBasicParsing -TimeoutSec 8
    Write-Output "FRONTEND: $($hf.StatusCode)"; Write-Output $hf.Content
} catch { Write-Output "FRONTEND_HEALTH_ERR: $($_.Exception.Message)" }

Write-Output "Testing login (admin/admin)..."
try{
    $body = @{ username = 'admin'; password = 'admin' } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri 'http://localhost:5000/api/auth/login' -Method POST -Body $body -ContentType 'application/json' -TimeoutSec 10
    Write-Output "LOGIN_RESPONSE:"; $r | ConvertTo-Json -Depth 5
} catch { Write-Output "LOGIN_ERR: $($_.Exception.Message)" }

Write-Output "Done. Backend logs: $backend\logs, Frontend logs: $frontend\logs"

Write-Host "Starting backend and frontend (dev) windows..."

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# Start backend in a new PowerShell window
$backendCmd = "cd '$root\\backend'; node server.js"
Start-Process -FilePath 'powershell' -ArgumentList '-NoExit','-Command', $backendCmd
Write-Host "Backend start requested (port $BackendPort)"

# Start frontend in a new PowerShell window (uses start:dev to avoid safe-start wrapper issues)
$frontendCmd = "cd '$root\\frontend'; `$env:PORT='$FrontendPort'; npm run start:dev"
Start-Process -FilePath 'powershell' -ArgumentList '-NoExit','-Command', $frontendCmd
Write-Host "Frontend start requested (port $FrontendPort)"

Write-Host "Waiting for services to come up (timeout ${TimeoutSeconds}s)..."

$end = (Get-Date).AddSeconds($TimeoutSeconds)
$backendOk = $false
$frontendOk = $false

while ((Get-Date) -lt $end -and (-not ($backendOk -and $frontendOk))) {
    if (-not $backendOk) {
        try {
            $resp = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/health" -UseBasicParsing -TimeoutSec 3
            if ($resp -and $resp.status -eq 'OK') {
                Write-Host "Backend healthy"
                $backendOk = $true
            }
        } catch { }
    }

    if (-not $frontendOk) {
        try {
            # Fetch root - SPA serves index.html
            Invoke-RestMethod -Uri "http://127.0.0.1:$FrontendPort" -UseBasicParsing -TimeoutSec 3 | Out-Null
            Write-Host "Frontend root reachable"
            $frontendOk = $true
        } catch { }
    }

    Start-Sleep -Seconds 1
}

Write-Host "Summary: Backend=$backendOk Frontend=$frontendOk"
if (-not $backendOk) { Write-Host "Warning: Backend did not respond in time. Check backend logs in the opened window." }
if (-not $frontendOk) { Write-Host "Warning: Frontend did not respond in time. Check frontend logs in the opened window." }

Write-Host "You can close this helper window - the dev windows remain running."
