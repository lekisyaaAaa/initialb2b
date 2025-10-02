<#
pm2-windows-setup.ps1

What it does:
- Installs pm2 globally via npm if not present
- Installs pm2-windows-startup helper to register PM2 to start on boot
- Starts the ecosystem defined in ecosystem.config.js
- Saves the pm2 process list

Run as Administrator for the startup registration step to succeed.
#>

function Ensure-NodeNpm {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js is not installed or not in PATH. Please install Node.js first from https://nodejs.org/" -ForegroundColor Red
    exit 1
  }
}

Ensure-NodeNpm

Write-Host "Checking for pm2..."
if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
  Write-Host "pm2 not found; installing globally via npm (this may require admin privileges)..." -ForegroundColor Yellow
  npm i -g pm2
}

Write-Host "Installing pm2-windows-startup helper (best-effort)..."
npm i -g pm2-windows-startup

Write-Host "Starting PM2 ecosystem..."
Push-Location (Join-Path (Get-Location) "..")
try {
  pm2 start ecosystem.config.js
  pm2 save
  Write-Host "PM2 processes started and saved." -ForegroundColor Green
} catch {
  Write-Host "Failed to start PM2 ecosystem: $_" -ForegroundColor Red
}
Pop-Location

Write-Host "Registering PM2 to start at boot (requires admin). If this fails, run the following command as Administrator:" -ForegroundColor Cyan
Write-Host "  pm2-startup install" -ForegroundColor Gray

try {
  pm2-startup install
  Write-Host "pm2 startup registered." -ForegroundColor Green
} catch {
  Write-Host "pm2-startup registration failed; please run 'pm2-startup install' as Administrator." -ForegroundColor Yellow
}

Write-Host "Done. Use 'pm2 list' to view running processes and 'pm2 logs' to inspect logs." -ForegroundColor Green
