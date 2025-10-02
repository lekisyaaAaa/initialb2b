<#
.SYNOPSIS
Creates a new GitHub repository under the authenticated user's account, adds it as a remote named 'backup', and pushes all branches and tags.

USAGE
Set environment variable GITHUB_TOKEN (recommended) or pass -Token. Example:

  $env:GITHUB_TOKEN = 'ghp_...'
  .\scripts\create_github_repo.ps1 -RepoName initialb2b-backup

Or:
  .\scripts\create_github_repo.ps1 -Token ghp_... -RepoName initialb2b-backup -Private:$false

NOTES
- This script does NOT remove or change your existing 'origin' remote. It adds a new remote called 'backup'.
- Requires Git to be available in PATH.
#>

param(
    [string]$Token = $env:GITHUB_TOKEN,
    [string]$RepoName = $("initialb2b-backup-" + (Get-Date -Format "yyyyMMdd-HHmmss")),
    [string]$Description = "Backup of repository initialb2b (BeanToBin) created by helper script",
    [switch]$Private = $true
)

if (-not $Token) {
    Write-Error "GitHub token is required. Set environment variable GITHUB_TOKEN or pass -Token <token>."
    exit 1
}

try {
    $body = @{ name = $RepoName; description = $Description; private = $Private.IsPresent } | ConvertTo-Json
    Write-Output "Creating repository '$RepoName' on GitHub..."
    $headers = @{ Authorization = "token $Token"; Accept = 'application/vnd.github+json' }
    $response = Invoke-RestMethod -Uri 'https://api.github.com/user/repos' -Method Post -Headers $headers -Body $body
} catch {
    Write-Error "Failed to create repository: $_"
    exit 2
}

if (-not $response.clone_url) {
    Write-Error "Unexpected response from GitHub: $($response | ConvertTo-Json -Depth 3)"
    exit 3
}

$cloneUrl = $response.clone_url
Write-Output "Repository created: $cloneUrl"

# Add remote named 'backup' (if exists, warn and use a unique name)
$remoteName = 'backup'
try {
    $existing = git remote get-url $remoteName 2>$null
    if ($LASTEXITCODE -eq 0) {
        $remoteName = "backup-$(Get-Date -Format "yyyyMMddHHmmss")"
        Write-Warning "Remote 'backup' already exists. Using remote name: $remoteName"
    }
} catch {
    # ignore
}

git remote add $remoteName $cloneUrl
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to add remote '$remoteName' -> $cloneUrl"
    exit 4
}

Write-Output "Pushing all branches to $remoteName..."
git push --all $remoteName
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to push branches to $remoteName"
    exit 5
}

Write-Output "Pushing tags to $remoteName..."
git push --tags $remoteName
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Failed to push tags to $remoteName (this may be fine if there are no tags)."
}

Write-Output "Remote '$remoteName' created and content pushed. Clone URL: $cloneUrl"
Write-Output "To remove the remote later: git remote remove $remoteName"
