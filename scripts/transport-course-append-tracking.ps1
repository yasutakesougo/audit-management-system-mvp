#!/usr/bin/env pwsh

<#
.SYNOPSIS
  TransportCourse 移行の summary JSON から tracking CSV へ 1 行追記する。

.DESCRIPTION
  inventory/backfill の summary JSON を読み取り、運用記録 CSV に同じ列構成で 1 行追加する。
  手作業転記を減らし、runbook の定期運用を定型化する。

.EXAMPLE
  pwsh ./scripts/transport-course-append-tracking.ps1 `
    -InventorySummaryPath "./artifacts/transport-course-migration/transport-course-inventory-summary-20260325-220000.json" `
    -BackfillSummaryPath "./artifacts/transport-course-migration/transport-course-backfill-summary-20260325-220300.json" `
    -TrackingCsvPath "./docs/runbooks/templates/transport-course-fallback-tracking.csv" `
    -RecordDate "2026-03-25" `
    -Comment "initial run" `
    -NextAction "rerun in 1 day"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$InventorySummaryPath,

    [Parameter(Mandatory = $true)]
    [string]$BackfillSummaryPath,

    [string]$TrackingCsvPath = "./docs/runbooks/templates/transport-course-fallback-tracking.csv",

    [string]$RecordDate = (Get-Date -Format "yyyy-MM-dd"),

    [string]$Comment = "",

    [string]$NextAction = ""
)

$ErrorActionPreference = "Stop"

$expectedHeaders = @(
    "record_date",
    "inventory_total_items",
    "inventory_unset_count",
    "backfill_target_count",
    "fallback_hit_count",
    "fallback_unmappable_count",
    "comment",
    "next_action"
)

function Write-Info([string]$Message) {
    Write-Host "[INFO]  $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
    Write-Host "[OK]    $Message" -ForegroundColor Green
}

function Read-JsonFile([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "File not found: $Path"
    }
    $raw = Get-Content -Path $Path -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($raw)) {
        throw "JSON file is empty: $Path"
    }
    return $raw | ConvertFrom-Json
}

function Get-RequiredInt($Object, [string]$PropertyName, [string]$SourcePath) {
    $prop = $Object.PSObject.Properties[$PropertyName]
    if ($null -eq $prop) {
        throw "Required property '$PropertyName' not found in: $SourcePath"
    }
    return [int]$prop.Value
}

function Ensure-CsvHeader([string]$Path, [string[]]$Headers) {
    $expected = ($Headers -join ",")
    if (-not (Test-Path -LiteralPath $Path)) {
        $dir = Split-Path -Path $Path -Parent
        if (-not [string]::IsNullOrWhiteSpace($dir) -and -not (Test-Path -LiteralPath $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
        Set-Content -Path $Path -Value $expected -Encoding UTF8
        return
    }

    $actual = Get-Content -Path $Path -TotalCount 1 -Encoding UTF8
    if ($actual -ne $expected) {
        throw "Tracking CSV header mismatch. expected='$expected' actual='$actual' path='$Path'"
    }
}

$inventorySummary = Read-JsonFile -Path $InventorySummaryPath
$backfillSummary = Read-JsonFile -Path $BackfillSummaryPath

$row = [PSCustomObject]@{
    record_date               = $RecordDate
    inventory_total_items     = Get-RequiredInt -Object $inventorySummary -PropertyName "TotalItems" -SourcePath $InventorySummaryPath
    inventory_unset_count     = Get-RequiredInt -Object $inventorySummary -PropertyName "TransportCourseUnset" -SourcePath $InventorySummaryPath
    backfill_target_count     = Get-RequiredInt -Object $backfillSummary -PropertyName "TargetRows" -SourcePath $BackfillSummaryPath
    fallback_hit_count        = Get-RequiredInt -Object $inventorySummary -PropertyName "FallbackDependent" -SourcePath $InventorySummaryPath
    fallback_unmappable_count = Get-RequiredInt -Object $inventorySummary -PropertyName "FallbackUnmappable" -SourcePath $InventorySummaryPath
    comment                   = $Comment
    next_action               = $NextAction
}

Ensure-CsvHeader -Path $TrackingCsvPath -Headers $expectedHeaders
$row | Export-Csv -Path $TrackingCsvPath -NoTypeInformation -Encoding UTF8 -Append

Write-Host ""
Write-Info "Tracking CSV updated: $TrackingCsvPath"
Write-Host "  record_date               : $($row.record_date)"
Write-Host "  inventory_total_items     : $($row.inventory_total_items)"
Write-Host "  inventory_unset_count     : $($row.inventory_unset_count)"
Write-Host "  backfill_target_count     : $($row.backfill_target_count)"
Write-Host "  fallback_hit_count        : $($row.fallback_hit_count)"
Write-Host "  fallback_unmappable_count : $($row.fallback_unmappable_count)"
Write-Host "  comment                   : $($row.comment)"
Write-Host "  next_action               : $($row.next_action)"
Write-Host ""
Write-Ok "Append complete."

$row
