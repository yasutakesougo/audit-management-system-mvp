#!/usr/bin/env pwsh
#requires -Modules PnP.PowerShell

<#
.SYNOPSIS
  Users_Master の TransportCourse 移行棚卸しを行う。

.DESCRIPTION
  `TransportCourse` の未設定件数、fallback 依存件数、正規化不能件数を集計し、
  明細 CSV とサマリ JSON を出力する。

.EXAMPLE
  pwsh ./scripts/transport-course-inventory.ps1 -SiteUrl "https://<tenant>.sharepoint.com/sites/<site>"
#>

[CmdletBinding()]
param(
    [string]$SiteUrl = "https://isogokatudouhome.sharepoint.com/sites/welfare",
    [string]$ListName = "Users_Master",
    [string]$ClientId = "ef918e68-3755-4ce9-9dac-af0495f89450",
    [string]$OutputDir = "./artifacts/transport-course-migration",
    [switch]$NoExport,
    [switch]$UseDeviceLogin
)

$ErrorActionPreference = "Stop"

$legacyKeys = @(
    "TransportCourseId",
    "TransportFixedCourse",
    "TransportRouteCourse",
    "Course",
    "course",
    "courseId",
    "transportCourse",
    "transportCourseId",
    "defaultTransportCourse"
)

function Write-Info([string]$Message) {
    Write-Host "[INFO]  $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
    Write-Host "[OK]    $Message" -ForegroundColor Green
}

function Normalize-TransportCourse([string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $null
    }

    $trimmed = $Value.Trim()
    $lower = $trimmed.ToLowerInvariant()
    switch ($lower) {
        "isogo" { return "isogo" }
        "kan2" { return "kan2" }
        "kanazawa" { return "kanazawa" }
    }

    $compact = $trimmed -replace "\s", ""
    switch ($compact) {
        "磯子" { return "isogo" }
        "磯子コース" { return "isogo" }
        "環2" { return "kan2" }
        "環２" { return "kan2" }
        "環2コース" { return "kan2" }
        "環２コース" { return "kan2" }
        "金沢" { return "kanazawa" }
        "金沢コース" { return "kanazawa" }
        default { return $null }
    }
}

function Get-LegacyCourseCandidate {
    param(
        $Item,
        [string[]]$Keys
    )

    foreach ($key in $Keys) {
        $raw = [string]$Item[$key]
        if (-not [string]::IsNullOrWhiteSpace($raw)) {
            return [PSCustomObject]@{
                Key        = $key
                Raw        = $raw
                Normalized = Normalize-TransportCourse -Value $raw
            }
        }
    }

    return [PSCustomObject]@{
        Key        = $null
        Raw        = $null
        Normalized = $null
    }
}

function Ensure-Directory([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

Write-Host ""
Write-Host "=== TransportCourse Inventory ===" -ForegroundColor Magenta
Write-Info "SiteUrl: $SiteUrl"
Write-Info "ListName: $ListName"

if ($UseDeviceLogin) {
    Connect-PnPOnline -Url $SiteUrl -DeviceLogin -ClientId $ClientId
} else {
    Connect-PnPOnline -Url $SiteUrl -Interactive -ClientId $ClientId
}

$allFields = Get-PnPField -List $ListName | Select-Object -ExpandProperty InternalName
$existingLegacyKeys = $legacyKeys | Where-Object { $allFields -contains $_ }

$fields = @("ID", "UserID", "FullName", "TransportCourse") + $existingLegacyKeys
$fields = $fields | Select-Object -Unique

Write-Info "Legacy keys detected: $($existingLegacyKeys.Count)"
if ($existingLegacyKeys.Count -gt 0) {
    Write-Info "Detected keys: $($existingLegacyKeys -join ', ')"
}

$items = Get-PnPListItem -List $ListName -PageSize 500 -Fields $fields

$rows = New-Object System.Collections.Generic.List[object]
$total = 0
$transportCourseSet = 0
$transportCourseUnset = 0
$transportCourseInvalid = 0
$fallbackDependent = 0
$fallbackBackfillable = 0
$fallbackUnmappable = 0

foreach ($item in $items) {
    $total++
    $id = [int]$item["ID"]
    $userId = [string]$item["UserID"]
    $fullName = [string]$item["FullName"]

    $transportCourseRaw = [string]$item["TransportCourse"]
    $transportCourseHasValue = -not [string]::IsNullOrWhiteSpace($transportCourseRaw)
    $transportCourseNormalized = Normalize-TransportCourse -Value $transportCourseRaw

    if ($transportCourseHasValue -and $transportCourseNormalized) {
        $transportCourseSet++
    } elseif ($transportCourseHasValue -and -not $transportCourseNormalized) {
        $transportCourseInvalid++
    } else {
        $transportCourseUnset++
    }

    $legacy = Get-LegacyCourseCandidate -Item $item -Keys $existingLegacyKeys
    $isFallbackDependent = (-not $transportCourseHasValue) -and (-not [string]::IsNullOrWhiteSpace($legacy.Raw))
    $isBackfillable = $isFallbackDependent -and (-not [string]::IsNullOrWhiteSpace($legacy.Normalized))

    if ($isFallbackDependent) {
        $fallbackDependent++
        if ($isBackfillable) {
            $fallbackBackfillable++
        } else {
            $fallbackUnmappable++
        }
    }

    $rows.Add([PSCustomObject]@{
        Id                         = $id
        UserID                     = $userId
        FullName                   = $fullName
        TransportCourseRaw         = $transportCourseRaw
        TransportCourseNormalized  = $transportCourseNormalized
        TransportCourseHasValue    = $transportCourseHasValue
        LegacySourceKey            = $legacy.Key
        LegacyRaw                  = $legacy.Raw
        LegacyNormalized           = $legacy.Normalized
        FallbackDependent          = $isFallbackDependent
        BackfillCandidate          = $isBackfillable
    })
}

$summary = [PSCustomObject]@{
    Timestamp                    = (Get-Date).ToString("o")
    SiteUrl                      = $SiteUrl
    ListName                     = $ListName
    TotalItems                   = $total
    TransportCourseSet           = $transportCourseSet
    TransportCourseUnset         = $transportCourseUnset
    TransportCourseInvalid       = $transportCourseInvalid
    FallbackDependent            = $fallbackDependent
    FallbackBackfillable         = $fallbackBackfillable
    FallbackUnmappable           = $fallbackUnmappable
    ExistingLegacyKeys           = $existingLegacyKeys
    LegacyKeysChecked            = $legacyKeys
}

Write-Host ""
Write-Host "Inventory Summary" -ForegroundColor White
Write-Host "  Total items                  : $($summary.TotalItems)"
Write-Host "  TransportCourse set          : $($summary.TransportCourseSet)"
Write-Host "  TransportCourse unset        : $($summary.TransportCourseUnset)"
Write-Host "  TransportCourse invalid      : $($summary.TransportCourseInvalid)"
Write-Host "  Fallback dependent           : $($summary.FallbackDependent)"
Write-Host "  Fallback backfillable        : $($summary.FallbackBackfillable)"
Write-Host "  Fallback unmappable          : $($summary.FallbackUnmappable)"

$inventoryPath = $null
$summaryPath = $null
if (-not $NoExport) {
    Ensure-Directory -Path $OutputDir
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"

    $inventoryPath = Join-Path $OutputDir "transport-course-inventory-$stamp.csv"
    $summaryPath = Join-Path $OutputDir "transport-course-inventory-summary-$stamp.json"

    $rows | Sort-Object Id | Export-Csv -Path $inventoryPath -NoTypeInformation -Encoding UTF8
    $summary | ConvertTo-Json -Depth 5 | Set-Content -Path $summaryPath -Encoding UTF8

    Write-Ok "Inventory CSV exported: $inventoryPath"
    Write-Ok "Summary JSON exported : $summaryPath"
}

[PSCustomObject]@{
    Summary       = $summary
    InventoryPath = $inventoryPath
    SummaryPath   = $summaryPath
}
