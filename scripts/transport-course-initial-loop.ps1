#!/usr/bin/env pwsh

<#
.SYNOPSIS
  TransportCourse 移行の初回ループ（inventory -> dry-run -> tracking追記）を1回で実行する。

.DESCRIPTION
  以下を順番に実行する:
  1. transport-course-inventory.ps1
  2. transport-course-backfill.ps1 (-DryRun $true)
  3. 最新 summary JSON を自動取得
  4. transport-course-append-tracking.ps1 で tracking CSV に追記

.EXAMPLE
  pwsh ./scripts/transport-course-initial-loop.ps1 `
    -SiteUrl "https://<tenant>.sharepoint.com/sites/<site>"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SiteUrl,

    [string]$OutputDir = "./artifacts/transport-course-migration",

    [string]$TrackingCsvPath = "./docs/runbooks/templates/transport-course-fallback-tracking.csv",

    [string]$RecordDate = (Get-Date -Format "yyyy-MM-dd"),

    [string]$Comment = "",

    [string]$NextAction = "",

    [string]$ClientId = "ef918e68-3755-4ce9-9dac-af0495f89450",

    [switch]$UseDeviceLogin
)

$ErrorActionPreference = "Stop"

function Write-Info([string]$Message) {
    Write-Host "[INFO]  $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
    Write-Host "[OK]    $Message" -ForegroundColor Green
}

function Get-LatestFile([string]$Pattern, [string]$NotFoundMessage) {
    $found = Get-ChildItem -Path $Pattern -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if ($null -eq $found) {
        throw $NotFoundMessage
    }
    return $found.FullName
}

$scriptRoot = Split-Path -Parent $PSCommandPath
$inventoryScript = Join-Path $scriptRoot "transport-course-inventory.ps1"
$backfillScript = Join-Path $scriptRoot "transport-course-backfill.ps1"
$appendScript = Join-Path $scriptRoot "transport-course-append-tracking.ps1"

foreach ($scriptPath in @($inventoryScript, $backfillScript, $appendScript)) {
    if (-not (Test-Path -LiteralPath $scriptPath)) {
        throw "Required script not found: $scriptPath"
    }
}

Write-Host ""
Write-Host "=== TransportCourse Initial Loop ===" -ForegroundColor Magenta
Write-Info "SiteUrl: $SiteUrl"
Write-Info "OutputDir: $OutputDir"
Write-Info "TrackingCsvPath: $TrackingCsvPath"
Write-Info "RecordDate: $RecordDate"

Write-Host ""
Write-Info "Step 1/4 inventory"
$inventoryParams = @{
    SiteUrl   = $SiteUrl
    OutputDir = $OutputDir
    ClientId  = $ClientId
}
if ($UseDeviceLogin) {
    $inventoryParams.UseDeviceLogin = $true
}
& $inventoryScript @inventoryParams | Out-Null

Write-Host ""
Write-Info "Step 2/4 backfill dry-run"
$backfillParams = @{
    SiteUrl   = $SiteUrl
    DryRun    = $true
    OutputDir = $OutputDir
    ClientId  = $ClientId
}
if ($UseDeviceLogin) {
    $backfillParams.UseDeviceLogin = $true
}
& $backfillScript @backfillParams | Out-Null

Write-Host ""
Write-Info "Step 3/4 locate latest summary JSON"
$inventorySummaryPath = Get-LatestFile `
    -Pattern (Join-Path $OutputDir "transport-course-inventory-summary-*.json") `
    -NotFoundMessage "Inventory summary JSON not found under: $OutputDir"
$backfillSummaryPath = Get-LatestFile `
    -Pattern (Join-Path $OutputDir "transport-course-backfill-summary-*.json") `
    -NotFoundMessage "Backfill summary JSON not found under: $OutputDir"
Write-Info "Inventory summary: $inventorySummaryPath"
Write-Info "Backfill summary : $backfillSummaryPath"

Write-Host ""
Write-Info "Step 4/4 append tracking CSV"
$appendParams = @{
    InventorySummaryPath = $inventorySummaryPath
    BackfillSummaryPath  = $backfillSummaryPath
    TrackingCsvPath      = $TrackingCsvPath
    RecordDate           = $RecordDate
    Comment              = $Comment
    NextAction           = $NextAction
}
$result = & $appendScript @appendParams

Write-Host ""
Write-Ok "Initial loop complete."

[PSCustomObject]@{
    InventorySummaryPath = $inventorySummaryPath
    BackfillSummaryPath  = $backfillSummaryPath
    TrackingCsvPath      = $TrackingCsvPath
    RecordDate           = $RecordDate
    TrackingRow          = $result
}
