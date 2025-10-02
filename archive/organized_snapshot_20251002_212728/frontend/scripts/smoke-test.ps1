# Improved smoke test for client-rendered app
# Strategy:
# 1. Fetch index.html
# 2. Extract /static/js/main.*.js from the script tag
# 3. Fetch that JS bundle and search its content for expected UI strings
# This avoids false failures when the page is server-served but client-side renders the UI.

$uri = 'http://127.0.0.1:3002'
Write-Host "Probing $uri ..."
try {
    $resp = Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec 5
} catch {
    Write-Error "Failed to fetch $uri : $_"
    exit 2
}

$content = $resp.Content

# Try to find the main JS bundle reference (CRA uses /static/js/main.<hash>.js)
$scriptMatch = [regex]::Match($content, 'src\s*=\s*"(/static/js/main\.[^"]+\.js)"')
if (-not $scriptMatch.Success) {
    Write-Error "Could not find main JS bundle reference in index.html"
    exit 4
}

$mainJsPath = $scriptMatch.Groups[1].Value
Write-Host "Found main JS bundle: $mainJsPath"

$mainJsUrl = "http://127.0.0.1:3002$mainJsPath"
try {
    $jsResp = Invoke-WebRequest -Uri $mainJsUrl -UseBasicParsing -TimeoutSec 5
} catch {
    Write-Error "Failed to fetch main JS bundle ($mainJsUrl): $_"
    exit 5
}

$jsContent = $jsResp.Content

$expected = @('BeanToBin','Sign in')
$found = $expected | Where-Object { $jsContent -match [regex]::Escape($_) }
if ($found.Count -gt 0) {
    Write-Host "Smoke test passed: found expected strings in JS bundle: $($found -join ', ')"
    exit 0
} else {
    Write-Error "Smoke test failed: expected UI strings not found in JS bundle"
    exit 6
}
