param(
  [switch]$restart
)

Write-Host 'Attempting to start services via PM2 (npx pm2)'
try {
  npx pm2 start ecosystem.config.js --update-env
  if ($restart) { npx pm2 restart all }
  npx pm2 save
  Write-Host 'Services started with PM2.'
  exit 0
} catch {
  Write-Host 'PM2 not available or failed, falling back to starting processes directly.'
}

# Fallback: start processes directly
Write-Host 'Starting backend process...'
Start-Process -FilePath node -ArgumentList 'server.js' -WorkingDirectory 'C:\xampp\htdocs\beantobin\system\backend' -NoNewWindow -PassThru | Out-Null
Start-Sleep -Seconds 1
Write-Host 'Starting frontend static server...'
Start-Process -FilePath node -ArgumentList 'serve-build.js' -WorkingDirectory 'C:\xampp\htdocs\beantobin\system\frontend' -NoNewWindow -PassThru | Out-Null
Write-Host 'Processes started (fallback).'  
