param(
    [int]$BackendPort = 5000,
    [int]$FrontendPort = 3002,
    [int]$TimeoutSeconds = 30
)

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
