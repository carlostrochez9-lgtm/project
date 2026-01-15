<#
Safe migrations runner: runs backups and SQL migrations but captures errors
and keeps the PowerShell session open for inspection instead of exiting.

Usage:
  Right-click and Run with PowerShell, or from project root:
    .\scripts\run_migrations_safe.ps1

You may set $env:PGPASSWORD before running, or uncomment the prompt below.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# -- Configure these if not provided via env
$pgHost = 'db.qinrujwleqjghqtqkvak.supabase.co'
$user = 'postgres'
$db   = 'postgres'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectRoot = Join-Path $projectRoot '..' | Resolve-Path -Relative
$projectRoot = (Resolve-Path $projectRoot).Path

# Tools (Scoop default)
$pgDump = Join-Path $env:USERPROFILE 'scoop\apps\postgresql\current\bin\pg_dump.exe'
$psql   = Join-Path $env:USERPROFILE 'scoop\apps\postgresql\current\bin\psql.exe'

function FailAndPause($msg) {
    Write-Error $msg
    Write-Host "Press Enter to continue and keep this terminal open..." -ForegroundColor Yellow
    Read-Host | Out-Null
}

try {
    if (-not (Test-Path $pgDump) -or -not (Test-Path $psql)) {
        FailAndPause "pg_dump or psql not found at expected paths. Ensure PostgreSQL is installed and in your PATH."
        return
    }

    $backupDir = Join-Path $projectRoot 'backups'
    if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir | Out-Null }
    $timestamp = (Get-Date -Format 'yyyyMMdd_HHmmss')
    $backupFile = Join-Path $backupDir "prod_backup_$timestamp.dump"

    Write-Host "Backing up production DB to $backupFile ..." -ForegroundColor Cyan
    try {
        & $pgDump -h $pgHost -U $user -d $db -F c -b -v -f $backupFile 2>&1 | Tee-Object -Variable _pgDumpOut
        if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE`n$(_pgDumpOut)" }
        Write-Host "Backup saved to $backupFile" -ForegroundColor Green
    } catch {
        FailAndPause "Backup failed: $($_.Exception.Message)"
        return
    }

    # Apply migrations in order
    $migs = Get-ChildItem -Path (Join-Path $projectRoot 'supabase\migrations') -Filter '*.sql' | Sort-Object Name
    foreach ($m in $migs) {
        Write-Host "Applying migration: $($m.Name)" -ForegroundColor Cyan
        try {
            & $psql -h $pgHost -U $user -d $db -v ON_ERROR_STOP=1 -f $m.FullName 2>&1 | Tee-Object -Variable _psqlOut
            if ($LASTEXITCODE -ne 0) { throw "psql failed with exit code $LASTEXITCODE`n$(_psqlOut)" }
            Write-Host "$($m.Name) applied successfully." -ForegroundColor Green
        } catch {
            FailAndPause "Migration failed: $($m.Name) - $($_.Exception.Message)"
            return
        }
    }

    Write-Host "All migrations applied. Verifying policies..." -ForegroundColor Cyan
    try {
        & $psql -h $pgHost -U $user -d $db -c "SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename IN ('events','employees','shifts','beos','profiles');" 2>&1 | Tee-Object -Variable _polOut
        if ($LASTEXITCODE -ne 0) { throw "psql query failed with exit code $LASTEXITCODE`n$(_polOut)" }
        Write-Host "Done." -ForegroundColor Green
    } catch {
        FailAndPause "Policy verification failed: $($_.Exception.Message)"
        return
    }
} catch {
    FailAndPause "Migration process failed: $($_.Exception.Message)"
}

# Keep terminal open for inspection
Write-Host "Script finished. Terminal remains open for debugging." -ForegroundColor Yellow
Read-Host 'Press Enter to exit'
