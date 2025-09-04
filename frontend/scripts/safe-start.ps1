Param()

# Safe starter for frontend dev server (Windows PowerShell)
# - Kills any process listening on $PORT (or 3002) to avoid "site can't be reached" after restarts
# - Starts the react dev server via npm run start:dev

try {
    $port = $env:PORT
    if ([string]::IsNullOrWhiteSpace($port)) { $port = 3002 }
    Write-Host "[safe-start] Using port: $port"

    # Find TCP listeners on the port
    $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }
    if ($conns) {
        $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($processId in $pids) {
            try {
                Write-Host "[safe-start] Stopping process $processId using port $port..."
                Stop-Process -Id $processId -Force -ErrorAction Stop
                Write-Host "[safe-start] Stopped process $processId"
            } catch {
                Write-Host ('[safe-start] Failed to stop {0}: {1}' -f $processId, $_) -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "[safe-start] No process listening on port $port"
    }

    Write-Host "[safe-start] Starting frontend dev server..."
    # Run the actual start script which calls react-scripts start
    # Use exec so the npm child inherits the console and stays attached
    # This will block until the dev server exits
    npm run start:dev

} catch {
    Write-Host "[safe-start] Error: $_" -ForegroundColor Red
    exit 1
}
