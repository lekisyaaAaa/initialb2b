Param()

# Starts backend and frontend in two separate PowerShell windows for local development
# Usage: Open an elevated PowerShell and run: .\scripts\run-dev.ps1

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host "Starting backend and frontend..." -ForegroundColor Cyan

$backendCmd = "cd '$root\\backend'; npm install; npm run start"
$frontendCmd = "cd '$root\\frontend'; npm install; npm start"

Start-Process -FilePath pwsh -ArgumentList "-NoExit","-Command","$backendCmd" -WindowStyle Normal
Start-Process -FilePath pwsh -ArgumentList "-NoExit","-Command","$frontendCmd" -WindowStyle Normal

Write-Host "Launched backend and frontend in separate PowerShell windows." -ForegroundColor Green
