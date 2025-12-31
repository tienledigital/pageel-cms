# Pageel Core Release Script
# Usage: .\release.ps1 [version] [-DryRun]
# Example: .\release.ps1 1.1.0
# Example: .\release.ps1 1.1.0 -DryRun

param(
    [Parameter(Mandatory=$true)]
    [string]$Version,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$CoreDir = Join-Path $RepoRoot "core"

Write-Host "`n🚀 Pageel Core Release Script v$Version" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor DarkGray

if ($DryRun) {
    Write-Host "[DRY RUN MODE] Changes will NOT be applied`n" -ForegroundColor Yellow
}

# Step 1: Check we're in pageel-cms
Write-Host "`n📁 Step 1: Checking repository..." -ForegroundColor Green
if (-not (Test-Path (Join-Path $RepoRoot ".gitignore"))) {
    Write-Host "❌ Error: Must run from pageel-cms/scripts folder" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Repository verified: $RepoRoot"

# Step 2: Check for uncommitted changes
Write-Host "`n📝 Step 2: Checking Git status..." -ForegroundColor Green
$gitStatus = git -C $RepoRoot status --porcelain
if ($gitStatus) {
    Write-Host "⚠️  Uncommitted changes detected:" -ForegroundColor Yellow
    Write-Host $gitStatus
    $confirm = Read-Host "Continue anyway? (y/N)"
    if ($confirm -ne "y") {
        Write-Host "Aborted." -ForegroundColor Red
        exit 1
    }
}

# Step 3: Build check
Write-Host "`n🔧 Step 3: Building project..." -ForegroundColor Green
Push-Location $CoreDir
try {
    if (-not $DryRun) {
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Build failed!" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "[DRY RUN] Would run: npm run build"
    }
    Write-Host "✓ Build successful"
} finally {
    Pop-Location
}

# Step 4: Update package.json version
Write-Host "`n📦 Step 4: Updating package.json version to $Version..." -ForegroundColor Green
$packagePath = Join-Path $CoreDir "package.json"
$package = Get-Content $packagePath -Raw | ConvertFrom-Json
$oldVersion = $package.version
if (-not $DryRun) {
    $package.version = $Version
    $package | ConvertTo-Json -Depth 10 | Set-Content $packagePath -Encoding UTF8
}
Write-Host "✓ Version: $oldVersion → $Version"

# Step 5: Show files to be committed
Write-Host "`n📋 Step 5: Files tracked by Git:" -ForegroundColor Green
git -C $RepoRoot ls-files | Select-Object -First 20
Write-Host "... (showing first 20 files)"

# Step 6: Create commit and tag
Write-Host "`n🏷️  Step 6: Creating release commit and tag..." -ForegroundColor Green
if (-not $DryRun) {
    git -C $RepoRoot add .
    git -C $RepoRoot commit -m "Release v$Version"
    git -C $RepoRoot tag -a "v$Version" -m "Version $Version"
    Write-Host "✓ Commit and tag created"
} else {
    Write-Host "[DRY RUN] Would run:"
    Write-Host "  git add ."
    Write-Host "  git commit -m 'Release v$Version'"
    Write-Host "  git tag -a v$Version -m 'Version $Version'"
}

# Step 7: Push instructions
Write-Host "`n🚀 Step 7: Push to GitHub" -ForegroundColor Green
if (-not $DryRun) {
    $push = Read-Host "Push to origin? (y/N)"
    if ($push -eq "y") {
        git -C $RepoRoot push origin main
        git -C $RepoRoot push origin "v$Version"
        Write-Host "✓ Pushed to GitHub!" -ForegroundColor Green
    } else {
        Write-Host "To push manually:"
        Write-Host "  git push origin main"
        Write-Host "  git push origin v$Version"
    }
} else {
    Write-Host "[DRY RUN] Would push:"
    Write-Host "  git push origin main"
    Write-Host "  git push origin v$Version"
}

Write-Host "`n✅ Release v$Version complete!" -ForegroundColor Green
Write-Host "=" * 50 -ForegroundColor DarkGray
