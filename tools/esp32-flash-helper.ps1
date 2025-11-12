# esp32-flash-helper.ps1
# Helper script to run esptool and prompt user to press/hold BOOT when requested.
# Usage: Open PowerShell, run: .\esp32-flash-helper.ps1 -Port COM5

param(
    [string]$Port = "COM5",
    [int]$Baud = 115200,
    [int]$Attempts = 6
)

$python = "C:/xampp/htdocs/beantobin/system/.venv/Scripts/python.exe"
if (!(Test-Path $python)) {
    Write-Host "Python executable not found at $python. Make sure the virtualenv is active or adjust path." -ForegroundColor Red
    exit 1
}

for ($i=1; $i -le $Attempts; $i++) {
    # Use ${} to delimit variable names when followed by punctuation to avoid parsing errors
    Write-Host "Attempt $i of ${Attempts}: running esptool flash-id on $Port (baud $Baud)" -ForegroundColor Cyan
    $proc = Start-Process -FilePath $python -ArgumentList "-m esptool --port $Port --baud $Baud flash-id" -NoNewWindow -PassThru -RedirectStandardOutput "esp_output.txt" -RedirectStandardError "esp_error.txt"
    Start-Sleep -Milliseconds 200

    Write-Host "When you see 'Connecting...' in the console, press and hold the BOOT (GPIO0) button on the ESP32 for ~2 seconds, then release." -ForegroundColor Yellow

    # Wait for process to exit or user to press Enter to abort
    while (-not $proc.HasExited) {
        Start-Sleep -Milliseconds 500
        if (Test-Path "esp_output.txt") {
            $content = Get-Content "esp_output.txt" -Raw -ErrorAction SilentlyContinue
            if ($content -match "Connecting") {
                Write-Host "Detected 'Connecting' in esptool output. Press and hold BOOT now, then release after 2 seconds." -ForegroundColor Green
                Start-Sleep -Seconds 3
            }
        }
    }

    $out = Get-Content "esp_output.txt" -Raw
    $err = Get-Content "esp_error.txt" -Raw

    Write-Host "--- esptool stdout ---" -ForegroundColor Gray
    Write-Host $out
    Write-Host "--- esptool stderr ---" -ForegroundColor Gray
    Write-Host $err

    if ($out -match "Manufacturer|Chip is|Detected flash size|Stub running|Uploading stub") {
        Write-Host "Success: ESP32 responded." -ForegroundColor Green
        Remove-Item "esp_output.txt","esp_error.txt" -ErrorAction SilentlyContinue
        exit 0
    }

    Write-Host "No successful response detected on attempt $i." -ForegroundColor Yellow
    Start-Sleep -Seconds 1
}

Write-Host "All attempts finished. If still failing: try different cable, different USB port, or force GPIO0->GND and retry." -ForegroundColor Red
Remove-Item "esp_output.txt","esp_error.txt" -ErrorAction SilentlyContinue
exit 1
