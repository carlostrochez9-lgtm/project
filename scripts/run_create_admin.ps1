<#
One-click script to create a test admin in Supabase for local testing.
It will prompt for the service role key (hidden) and other optional fields,
install minimal dependencies if missing, run the Node script, then unset the key.

Usage: Right-click and choose "Run with PowerShell" or run in PowerShell:
  .\scripts\run_create_admin.ps1
#>

param(
    [string]$SupabaseUrl,
    [string]$ServiceRoleKey,
    [string]$AdminEmail = 'admin@example.com',
    [string]$AdminPassword = 'Admin123!',
    [string]$AdminName = 'Site Admin'
)

Set-StrictMode -Version Latest

function Read-Secret($prompt) {
    $secure = Read-Host -AsSecureString $prompt
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

Write-Host "Preparing to create a test admin user..." -ForegroundColor Cyan

# Verify Node is available
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is not found on PATH. Please install Node.js (LTS) first.";
    exit 1
}

# Defaults (read from .env if present)
$projectRoot = Join-Path $PSScriptRoot '..'
$envFile = Join-Path $projectRoot '.env'
$defaultUrl = ''
if (Test-Path $envFile) {
    $envLines = Get-Content $envFile | ForEach-Object { $_.Trim() }
    foreach ($line in $envLines) {
        if ($line -match '^VITE_SUPABASE_URL=(.+)$') { $defaultUrl = $Matches[1]; break }
    }
}

if (-not $SupabaseUrl) {
    $supabaseUrl = Read-Host -Prompt ("Supabase URL [{0}]" -f ($defaultUrl -ne '' ? $defaultUrl : 'enter'))
    if ([string]::IsNullOrWhiteSpace($supabaseUrl) -and $defaultUrl -ne '') { $supabaseUrl = $defaultUrl }
} else { $supabaseUrl = $SupabaseUrl }

if ([string]::IsNullOrWhiteSpace($supabaseUrl)) { Write-Error 'Supabase URL is required.'; exit 1 }

if (-not $AdminEmail) {
    $adminEmail = Read-Host -Prompt 'Admin email [admin@example.com]'
    if ([string]::IsNullOrWhiteSpace($adminEmail)) { $adminEmail = 'admin@example.com' }
} else { $adminEmail = $AdminEmail }

if (-not $AdminPassword) {
    $adminPassword = Read-Host -Prompt 'Admin password [Admin123!]' -AsSecureString
    $adminPasswordPlain = ''
    if ($adminPassword.Length -gt 0) {
        $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminPassword)
        try { $adminPasswordPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
    } else {
        $adminPasswordPlain = 'Admin123!'
    }
} else { $adminPasswordPlain = $AdminPassword }

if (-not $AdminName) {
    $adminName = Read-Host -Prompt 'Admin name [Site Admin]'
    if ([string]::IsNullOrWhiteSpace($adminName)) { $adminName = 'Site Admin' }
} else { $adminName = $AdminName }

# Service role key (hidden)
if (-not $ServiceRoleKey) {
    $serviceKey = Read-Host -AsSecureString 'Enter SUPABASE_SERVICE_ROLE_KEY (hidden)'
    $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($serviceKey)
    try { $serviceKey = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
} else { $serviceKey = $ServiceRoleKey }

if ([string]::IsNullOrWhiteSpace($serviceKey)) { Write-Error 'Service role key is required.'; exit 1 }

Write-Host "\nInstalling required npm packages if missing..." -ForegroundColor Yellow
Push-Location $projectRoot
try {
    npm list node-fetch @supabase/supabase-js --depth=0 > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Installing node-fetch and @supabase/supabase-js...'
        npm install node-fetch@2 @supabase/supabase-js --no-audit --no-fund
    } else {
        Write-Host 'Required packages already installed.'
    }
} finally { Pop-Location }

Write-Host "Running admin creation script..." -ForegroundColor Cyan

# Set env vars for the node process
$env:SUPABASE_URL = $supabaseUrl
$env:SUPABASE_SERVICE_ROLE_KEY = $serviceKey
$env:ADMIN_EMAIL = $adminEmail
$env:ADMIN_PASSWORD = $adminPasswordPlain
$env:ADMIN_NAME = $adminName

Push-Location $PSScriptRoot
try {
    node .\create_admin.js --url $supabaseUrl --service-key $serviceKey --email $adminEmail --password $adminPasswordPlain --name "$adminName"
} finally {
    Pop-Location
    # Unset service key from environment
    Remove-Item Env:\SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
}

Write-Host "\nDone. Remove the test admin in Supabase when finished." -ForegroundColor Green
