param(
  [int]$Port = 5000,
  [switch]$Kill
)

Write-Host 'Looking for listeners on port' $Port '...'

try {
  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
} catch {
  # If Get-NetTCPConnection isn't available, fall back to netstat parsing
  Write-Host 'Get-NetTCPConnection not available; falling back to netstat parsing'
  $netLines = netstat -ano | Select-String ":$Port" | ForEach-Object { $_.ToString() }
  if (-not $netLines) { Write-Host 'No listeners found on port' $Port; exit 0 }
  $ownerIds = @()
  foreach ($lineText in $netLines) {
    $parts = ($lineText -split '\s+') | Where-Object { $_ -ne '' }
    $candidate = $parts[-1]
    if ($candidate -and ($candidate -as [int])) { $ownerIds += [int]$candidate }
  }
  $ownerIds = $ownerIds | Sort-Object -Unique
  $connections = @()
  foreach ($ownerId in $ownerIds) {
    $connections += [PSCustomObject]@{ OwningProcess = $ownerId }
  }
}

if (-not $connections -or $connections.Count -eq 0) {
  Write-Host 'No listeners found on port' $Port
  exit 0
}


$foundOwners = $connections | Select-Object -ExpandProperty OwningProcess -Unique

foreach ($owner in $foundOwners) {
  Write-Host 'ProcessId' $owner
  Try {
    Get-Process -Id $owner -ErrorAction Stop | Select-Object Id, ProcessName, StartTime | Format-List
  } Catch {
    Write-Host 'Process' $owner 'not found or access denied'
  }
  # (Removed wmic usage for portability and to avoid analyzer issues.)
  if ($Kill) {
    Write-Host 'Attempting to stop process' $owner
    try {
      Stop-Process -Id $owner -Force -ErrorAction Stop
      Write-Host 'Stopped' $owner
    } catch {
      Write-Host 'Failed to stop' $owner '-' ($_.Exception.Message)
    }
  }
}

Write-Host 'Done.'
