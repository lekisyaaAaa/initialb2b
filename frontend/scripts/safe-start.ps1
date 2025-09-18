Param()

# Safe starter for frontend dev server (Windows PowerShell)
# - Kills any process listening on $PORT (or 3002) to avoid "site can't be reached" after restarts
# - Starts the react dev server via npm run start:dev

try {
    $startPort = 3000
    if ($env:PORT -and [int]::TryParse($env:PORT, [ref]$null)) {
        $startPort = [int]$env:PORT
    }

    Write-Host "[safe-start] Searching for available port starting at $startPort..."
    $port = $null
    for ($p = $startPort; $p -lt ($startPort + 50); $p++) {
        $conn = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }
        if (-not $conn) {
            $port = $p
            break
        }
    }

    if (-not $port) {
        Write-Host "[safe-start] No free port found in range $startPort..($startPort+49)" -ForegroundColor Red
        exit 1
    }

    Write-Host "[safe-start] Selected port: $port"

    # If a process is currently listening on the selected port, try to stop it
    $connCurrent = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }
    if ($connCurrent) {
        $owningPid = $connCurrent.OwningProcess
        try {
            $proc = Get-Process -Id $owningPid -ErrorAction Stop
            if ($proc.ProcessName -match 'node|npm|nodejs') {
                Write-Host "[safe-start] Found $($proc.ProcessName) (PID $owningPid) listening on port $port. Stopping it to free the port..."
                Stop-Process -Id $owningPid -Force -ErrorAction SilentlyContinue
                Start-Sleep -Milliseconds 500
            } else {
                Write-Host "[safe-start] PID $owningPid ($($proc.ProcessName)) is listening on port $port. Not stopping non-node processes." -ForegroundColor Yellow
            }
        } catch {
            Write-Host ("[safe-start] Couldn't inspect or stop process PID {0}: {1}" -f ${owningPid}, $_.Exception.Message) -ForegroundColor Yellow
        }
    }

    # Export environment variables for the dev server
    $env:PORT = $port
    $env:HOST = '127.0.0.1'
    Write-Host "[safe-start] HOST set to $env:HOST (binding to loopback for local dev)"
    Write-Host "[safe-start] Starting frontend dev server on port $port..."

    # Start react-scripts in the same window so logs are visible. If it errors, bubble up the exit code.
    $nodeExit = npm run start:dev
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[safe-start] Frontend start failed with exit code $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }

} catch {
    Write-Host "[safe-start] Error: $_" -ForegroundColor Red
    exit 1
}
