[CmdletBinding()]
param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

function Write-Section {
    param([string]$Message)
    Write-Host "== $Message =="
}

function Write-Info {
    param([string]$Message)
    Write-Host $Message
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-WarningLine {
    param([string]$Message)
    Write-Warning $Message
}

function Write-Failure {
    param([string]$Message)
    Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Confirm-Deployment {
    param([switch]$AutoApprove)
    if ($AutoApprove) {
        return
    }

    $response = Read-Host "This will redeploy backend and frontend. Continue? (y/n)"
    if ($response -ne 'y') {
        Write-Failure "Deployment cancelled by user."
        exit 1
    }
}

function Ensure-Workspace {
    Write-Section "Checking active workspace"
    $workspaceJson = $null
    try {
        $workspaceJson = & render workspace current --output json 2>$null
    } catch {
        $workspaceJson = $null
    }

    if (-not $workspaceJson) {
        Write-Failure "No Render workspace is set. Run 'render workspace set' once, then re-run this script."
        exit 1
    }

    try {
        $workspace = $workspaceJson | ConvertFrom-Json
        if ($workspace.name) {
            Write-Success "Using workspace: $($workspace.name) ($($workspace.id))"
        } else {
            Write-Info "Active workspace detected."
        }
    } catch {
        Write-Info "Active workspace detected."
    }
}

function Invoke-Deploy {
    param(
        [string]$ServiceId,
        [string]$ServiceName
    )

    Write-Section "Redeploying $ServiceName"
    Write-Info "Command: render deploys create $ServiceId --wait --confirm"

    & render deploys create $ServiceId --wait --confirm
    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0) {
        Write-Success "$ServiceName deploy completed."
    } else {
        Write-WarningLine "$ServiceName deploy exited with code $exitCode. Continuing with remaining steps."
    }

    return $exitCode
}

function Get-ServiceStatus {
    param(
        [object]$Services,
        [string]$ServiceId
    )

    if (-not $Services) {
        return 'unknown'
    }

    foreach ($svc in $Services) {
        if ($svc.id -eq $ServiceId) {
            if ($null -ne $svc.status) { return $svc.status }
            if ($svc.state) { return $svc.state }
        }
        if ($svc.service -and $svc.service.id -eq $ServiceId) {
            if ($svc.service.status) { return $svc.service.status }
            if ($svc.service.state) { return $svc.service.state }
        }
    }

    return 'unknown'
}

function Show-ServiceStatuses {
    param(
        [string[]]$ServiceIds
    )

    Write-Section "Checking deployment statuses"
    $servicesJson = $null
    try {
        $servicesJson = & render services list --output json 2>$null
    } catch {
        $servicesJson = $null
    }

    if (-not $servicesJson) {
        Write-WarningLine "Could not retrieve services list."
        return $null
    }

    $services = $null
    try {
        $services = $servicesJson | ConvertFrom-Json
    } catch {
        $services = $null
    }

    if (-not $services) {
        Write-WarningLine "Services list was not parseable JSON."
        return $null
    }

    $statusTable = foreach ($id in $ServiceIds) {
        [PSCustomObject]@{
            Id     = $id
            Status = Get-ServiceStatus -Services $services -ServiceId $id
        }
    }

    $statusTable | Format-Table -AutoSize | Out-String | ForEach-Object { Write-Info $_ }
    return $statusTable
}

function Show-BackendLogs {
    param(
        [string]$ServiceId
    )

    Write-Section "Fetching latest logs from backend"
    & render logs $ServiceId --limit 50
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Backend logs displayed."
    } else {
        Write-WarningLine "Failed to fetch backend logs (exit code $LASTEXITCODE)."
    }
}

# Script parameters and constants
$backendId = 'srv-d43v9q0dl3ps73aarv30'
$frontendId = 'srv-d43v9h0dl3ps73aarlgg'

Write-Section "Starting full VermiLinks deployment"
Confirm-Deployment -AutoApprove:$Force
Ensure-Workspace

$backendExit = Invoke-Deploy -ServiceId $backendId -ServiceName 'VermiLinks Backend'
$frontendExit = Invoke-Deploy -ServiceId $frontendId -ServiceName 'VermiLinks Frontend'

$statuses = Show-ServiceStatuses -ServiceIds @($backendId, $frontendId)
Show-BackendLogs -ServiceId $backendId

if ($backendExit -eq 0 -and $frontendExit -eq 0) {
    $allLive = $false
    if ($statuses) {
        $allLive = $true
        foreach ($row in $statuses) {
            if ($row.Status -ne 'live') {
                $allLive = $false
            }
        }
    }

    if ($allLive) {
        Write-Success "VermiLinks deployment complete. All services report live."
    } else {
        Write-Success "VermiLinks deployment complete. Verify service statuses above."
    }

    Write-Info "Backend URL: https://vermilinks-backend.onrender.com"
    Write-Info "Frontend URL: https://vermilinks-frontend.onrender.com"
    exit 0
} else {
    Write-Failure "One or more deploy commands exited with an error. Review logs above."
    exit 1
}
