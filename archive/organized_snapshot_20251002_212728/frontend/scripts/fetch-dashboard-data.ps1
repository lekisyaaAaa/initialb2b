# Fetch sensors, alerts and health using saved admin token
$loginFile = Join-Path $PSScriptRoot 'login-success-sample.json'
if (-not (Test-Path $loginFile)) { Write-Error "Login sample not found: $loginFile"; exit 2 }
$login = Get-Content $loginFile -Raw | ConvertFrom-Json
$token = $login.data.data.token
if (-not $token) { Write-Error 'No token found in login sample'; exit 3 }
$headers = @{ Authorization = "Bearer $token" }

function Save-Json($obj, $path) {
    $json = $obj | ConvertTo-Json -Depth 10
    $json | Out-File -FilePath $path -Encoding utf8
}

# sensors/latest
try {
    $sensors = Invoke-RestMethod -Uri 'http://localhost:5000/api/sensors/latest' -Headers $headers -TimeoutSec 10
    Save-Json $sensors (Join-Path $PSScriptRoot 'sensors-latest.json')
    Write-Host "sensors-latest: saved (items: $($sensors | Measure-Object).Count)"
} catch {
    Write-Warning "sensors-latest fetch failed: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $sr.ReadToEnd()
        $body | Out-File -FilePath (Join-Path $PSScriptRoot 'sensors-latest.error.json') -Encoding utf8
        Write-Host "sensors-latest: saved error body"
    }
}

# alerts/recent
try {
    $alerts = Invoke-RestMethod -Uri 'http://localhost:5000/api/alerts/recent?limit=5' -Headers $headers -TimeoutSec 10
    Save-Json $alerts (Join-Path $PSScriptRoot 'alerts-recent.json')
    Write-Host "alerts-recent: saved"
} catch {
    Write-Warning "alerts-recent fetch failed: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $sr.ReadToEnd()
        $body | Out-File -FilePath (Join-Path $PSScriptRoot 'alerts-recent.error.json') -Encoding utf8
        Write-Host "alerts-recent: saved error body"
    }
}

# health
try {
    $health = Invoke-RestMethod -Uri 'http://localhost:5000/api/health' -Headers $headers -TimeoutSec 10
    Save-Json $health (Join-Path $PSScriptRoot 'health.json')
    Write-Host "health: saved"
} catch {
    Write-Warning "health fetch failed: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $sr.ReadToEnd()
        $body | Out-File -FilePath (Join-Path $PSScriptRoot 'health.error.json') -Encoding utf8
        Write-Host "health: saved error body"
    }
}
