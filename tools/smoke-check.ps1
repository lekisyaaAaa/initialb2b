Param()

Write-Host "Verifying backend and frontend endpoints..." -ForegroundColor Cyan

try {
    $health = Invoke-RestMethod -Uri http://localhost:5000/api/health -Method Get -TimeoutSec 5 -ErrorAction Stop
    Write-Host "Backend health: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "Backend health check failed: $_" -ForegroundColor Red
}

# Open the contact page in default browser
$contactUrl = 'http://127.0.0.1:3000/contact'
Start-Process $contactUrl
Write-Host "Opened $contactUrl in default browser." -ForegroundColor Green

*** End Patch