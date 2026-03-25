#!/usr/bin/env pwsh
#requires -Modules PnP.PowerShell

<#
.SYNOPSIS
  Users_Master の TransportCourse backfill を実行する。

.DESCRIPTION
  未設定の `TransportCourse` のみを対象に、旧キー値を正規化して backfill する。
  `-DryRun $true` が既定。実行結果 CSV / サマリ JSON / rollback 入力 CSV を出力する。

.EXAMPLE
  pwsh ./scripts/transport-course-backfill.ps1 -SiteUrl "https://<tenant>.sharepoint.com/sites/<site>" -DryRun $true

.EXAMPLE
  pwsh ./scripts/transport-course-backfill.ps1 -SiteUrl "https://<tenant>.sharepoint.com/sites/<site>" -DryRun $false -InputCsvPath "./artifacts/transport-course-migration/transport-course-backfill-plan-20260325-220000.csv"
#>

[CmdletBinding()]
param(
    [string]$SiteUrl = "https://isogokatudouhome.sharepoint.com/sites/welfare",
    [string]$ListName = "Users_Master",
    [string]$ClientId = "ef918e68-3755-4ce9-9dac-af0495f89450",
    [string]$OutputDir = "./artifacts/transport-course-migration",
    [string]$InputCsvPath = "",
    [bool]$DryRun = $true,
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

function Write-WarnMsg([string]$Message) {
    Write-Host "[WARN]  $Message" -ForegroundColor Yellow
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

function Ensure-Directory([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
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

function ConvertTo-Bool($Value) {
    if ($null -eq $Value) { return $false }
    $s = $Value.ToString().Trim().ToLowerInvariant()
    return $s -in @("true", "1", "yes", "y")
}

function Build-PlanFromList {
    param(
        [string]$TargetListName,
        [string[]]$LegacyKeys
    )

    $allFields = Get-PnPField -List $TargetListName | Select-Object -ExpandProperty InternalName
    $existingLegacyKeys = $LegacyKeys | Where-Object { $allFields -contains $_ }
    $fields = @("ID", "UserID", "FullName", "TransportCourse") + $existingLegacyKeys
    $fields = $fields | Select-Object -Unique

    $items = Get-PnPListItem -List $TargetListName -PageSize 500 -Fields $fields
    $rows = New-Object System.Collections.Generic.List[object]

    foreach ($item in $items) {
        $id = [int]$item["ID"]
        $userId = [string]$item["UserID"]
        $fullName = [string]$item["FullName"]
        $currentRaw = [string]$item["TransportCourse"]
        $currentHasValue = -not [string]::IsNullOrWhiteSpace($currentRaw)
        $currentNormalized = Normalize-TransportCourse -Value $currentRaw

        $legacy = Get-LegacyCourseCandidate -Item $item -Keys $existingLegacyKeys
        $proposed = $legacy.Normalized

        $shouldBackfill = $false
        $decisionReason = "ready_to_backfill"

        if ($currentHasValue) {
            $decisionReason = if ($currentNormalized) { "has_transport_course" } else { "invalid_transport_course_existing" }
        } elseif (-not $legacy.Raw) {
            $decisionReason = "no_legacy_value"
        } elseif (-not $proposed) {
            $decisionReason = "legacy_unmappable"
        } else {
            $shouldBackfill = $true
        }

        $rows.Add([PSCustomObject]@{
            Id                               = $id
            UserID                           = $userId
            FullName                         = $fullName
            CurrentTransportCourseRaw        = $currentRaw
            CurrentTransportCourseNormalized = $currentNormalized
            CurrentTransportCourseHasValue   = $currentHasValue
            LegacySourceKey                  = $legacy.Key
            LegacyRaw                        = $legacy.Raw
            LegacyNormalized                 = $legacy.Normalized
            ProposedTransportCourse          = $proposed
            ShouldBackfill                   = $shouldBackfill
            DecisionReason                   = $decisionReason
        })
    }

    return [PSCustomObject]@{
        PlanRows           = $rows
        ExistingLegacyKeys = $existingLegacyKeys
    }
}

function Import-PlanCsv {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "InputCsvPath not found: $Path"
    }

    $imported = Import-Csv -Path $Path -Encoding UTF8
    $rows = New-Object System.Collections.Generic.List[object]

    foreach ($row in $imported) {
        if (-not $row.Id) {
            continue
        }

        $proposed = [string]$row.ProposedTransportCourse
        if ([string]::IsNullOrWhiteSpace($proposed)) {
            $proposed = [string]$row.LegacyNormalized
        }
        $proposed = Normalize-TransportCourse -Value $proposed

        $shouldBackfill = if ($row.PSObject.Properties.Name -contains "ShouldBackfill") {
            ConvertTo-Bool -Value $row.ShouldBackfill
        } else {
            -not [string]::IsNullOrWhiteSpace($proposed)
        }

        $rows.Add([PSCustomObject]@{
            Id                               = [int]$row.Id
            UserID                           = [string]$row.UserID
            FullName                         = [string]$row.FullName
            CurrentTransportCourseRaw        = [string]$row.CurrentTransportCourseRaw
            CurrentTransportCourseNormalized = [string]$row.CurrentTransportCourseNormalized
            CurrentTransportCourseHasValue   = ConvertTo-Bool -Value $row.CurrentTransportCourseHasValue
            LegacySourceKey                  = [string]$row.LegacySourceKey
            LegacyRaw                        = [string]$row.LegacyRaw
            LegacyNormalized                 = [string]$row.LegacyNormalized
            ProposedTransportCourse          = $proposed
            ShouldBackfill                   = $shouldBackfill
            DecisionReason                   = if ($row.DecisionReason) { [string]$row.DecisionReason } else { "from_input_csv" }
        })
    }

    return $rows
}

Write-Host ""
Write-Host "=== TransportCourse Backfill ===" -ForegroundColor Magenta
Write-Info "Mode: $(if ($DryRun) { 'DRYRUN' } else { 'APPLY' })"
Write-Info "SiteUrl: $SiteUrl"
Write-Info "ListName: $ListName"

if ($UseDeviceLogin) {
    Connect-PnPOnline -Url $SiteUrl -DeviceLogin -ClientId $ClientId
} else {
    Connect-PnPOnline -Url $SiteUrl -Interactive -ClientId $ClientId
}

Ensure-Directory -Path $OutputDir
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"

$planRows = $null
$planPath = $null
$existingLegacyKeys = @()

if ([string]::IsNullOrWhiteSpace($InputCsvPath)) {
    $planResult = Build-PlanFromList -TargetListName $ListName -LegacyKeys $legacyKeys
    $planRows = $planResult.PlanRows
    $existingLegacyKeys = $planResult.ExistingLegacyKeys

    $planPath = Join-Path $OutputDir "transport-course-backfill-plan-$stamp.csv"
    $planRows | Sort-Object Id | Export-Csv -Path $planPath -NoTypeInformation -Encoding UTF8
    Write-Ok "Generated plan CSV: $planPath"
} else {
    $planRows = Import-PlanCsv -Path $InputCsvPath
    $planPath = $InputCsvPath
    Write-Info "Using input plan CSV: $InputCsvPath"
}

$targetRows = ($planRows | Where-Object { $_.ShouldBackfill } | Measure-Object).Count
Write-Info "Plan rows total : $($planRows.Count)"
Write-Info "Backfill targets: $targetRows"

$currentItems = Get-PnPListItem -List $ListName -PageSize 500 -Fields @("ID", "UserID", "FullName", "TransportCourse")
$currentById = @{}
foreach ($item in $currentItems) {
    $currentById[[int]$item["ID"]] = $item
}

$executionRows = New-Object System.Collections.Generic.List[object]
$rollbackRows = New-Object System.Collections.Generic.List[object]

$applied = 0
$previewed = 0
$skippedNotTarget = 0
$skippedMissingItem = 0
$skippedCurrentNotEmpty = 0
$skippedInvalidProposed = 0
$failed = 0

foreach ($plan in $planRows) {
    if (-not $plan.ShouldBackfill) {
        $skippedNotTarget++
        continue
    }

    $id = [int]$plan.Id
    if (-not $currentById.ContainsKey($id)) {
        $skippedMissingItem++
        $executionRows.Add([PSCustomObject]@{
            Id                    = $id
            UserID                = [string]$plan.UserID
            FullName              = [string]$plan.FullName
            ProposedTransportCourse = [string]$plan.ProposedTransportCourse
            Status                = "SKIP_MISSING_ITEM"
            Message               = "Current list item was not found."
        })
        continue
    }

    $current = $currentById[$id]
    $currentRaw = [string]$current["TransportCourse"]
    $currentHasValue = -not [string]::IsNullOrWhiteSpace($currentRaw)
    $proposed = Normalize-TransportCourse -Value ([string]$plan.ProposedTransportCourse)

    if ($currentHasValue) {
        $skippedCurrentNotEmpty++
        $executionRows.Add([PSCustomObject]@{
            Id                     = $id
            UserID                 = [string]$current["UserID"]
            FullName               = [string]$current["FullName"]
            CurrentTransportCourse = $currentRaw
            ProposedTransportCourse = $proposed
            Status                 = "SKIP_CURRENT_NOT_EMPTY"
            Message                = "TransportCourse already has value. No overwrite."
        })
        continue
    }

    if ([string]::IsNullOrWhiteSpace($proposed)) {
        $skippedInvalidProposed++
        $executionRows.Add([PSCustomObject]@{
            Id                    = $id
            UserID                = [string]$current["UserID"]
            FullName              = [string]$current["FullName"]
            ProposedTransportCourse = [string]$plan.ProposedTransportCourse
            Status                = "SKIP_INVALID_PROPOSED"
            Message               = "Proposed value is empty or unmappable."
        })
        continue
    }

    try {
        if ($DryRun) {
            $previewed++
            $status = "DRYRUN"
        } else {
            Set-PnPListItem -List $ListName -Identity $id -Values @{ TransportCourse = $proposed } | Out-Null
            $applied++
            $status = "APPLIED"
        }

        $executionRows.Add([PSCustomObject]@{
            Id                     = $id
            UserID                 = [string]$current["UserID"]
            FullName               = [string]$current["FullName"]
            CurrentTransportCourse = $currentRaw
            ProposedTransportCourse = $proposed
            LegacySourceKey        = [string]$plan.LegacySourceKey
            LegacyRaw              = [string]$plan.LegacyRaw
            Status                 = $status
            Message                = ""
        })

        $rollbackRows.Add([PSCustomObject]@{
            Id                         = $id
            UserID                     = [string]$current["UserID"]
            FullName                   = [string]$current["FullName"]
            PreviousTransportCourseRaw = $currentRaw
            AppliedTransportCourse     = $proposed
            RollbackTransportCourseRaw = $currentRaw
            LegacySourceKey            = [string]$plan.LegacySourceKey
            LegacyRaw                  = [string]$plan.LegacyRaw
            GeneratedAt                = (Get-Date).ToString("o")
            Mode                       = if ($DryRun) { "DRYRUN" } else { "APPLY" }
        })
    } catch {
        $failed++
        $executionRows.Add([PSCustomObject]@{
            Id                     = $id
            UserID                 = [string]$current["UserID"]
            FullName               = [string]$current["FullName"]
            CurrentTransportCourse = $currentRaw
            ProposedTransportCourse = $proposed
            Status                 = "ERROR"
            Message                = $_.Exception.Message
        })
    }
}

$resultsPath = Join-Path $OutputDir "transport-course-backfill-results-$stamp.csv"
$rollbackPath = Join-Path $OutputDir "transport-course-backfill-rollback-$stamp.csv"
$summaryPath = Join-Path $OutputDir "transport-course-backfill-summary-$stamp.json"

$executionRows | Sort-Object Id | Export-Csv -Path $resultsPath -NoTypeInformation -Encoding UTF8
$rollbackRows | Sort-Object Id | Export-Csv -Path $rollbackPath -NoTypeInformation -Encoding UTF8

$summary = [PSCustomObject]@{
    Timestamp                = (Get-Date).ToString("o")
    SiteUrl                  = $SiteUrl
    ListName                 = $ListName
    DryRun                   = $DryRun
    InputPlanCsvPath         = $planPath
    ExistingLegacyKeys       = $existingLegacyKeys
    PlanRowsTotal            = $planRows.Count
    TargetRows               = $targetRows
    AppliedRows              = $applied
    DryRunRows               = $previewed
    SkippedNotTarget         = $skippedNotTarget
    SkippedMissingItem       = $skippedMissingItem
    SkippedCurrentNotEmpty   = $skippedCurrentNotEmpty
    SkippedInvalidProposed   = $skippedInvalidProposed
    FailedRows               = $failed
    ResultsCsvPath           = $resultsPath
    RollbackCsvPath          = $rollbackPath
}
$summary | ConvertTo-Json -Depth 5 | Set-Content -Path $summaryPath -Encoding UTF8

Write-Host ""
Write-Host "Backfill Summary" -ForegroundColor White
Write-Host "  Mode                         : $(if ($DryRun) { 'DRYRUN' } else { 'APPLY' })"
Write-Host "  Plan rows                    : $($summary.PlanRowsTotal)"
Write-Host "  Target rows                  : $($summary.TargetRows)"
Write-Host "  Applied rows                 : $($summary.AppliedRows)"
Write-Host "  Dry-run rows                 : $($summary.DryRunRows)"
Write-Host "  Skipped (not target)         : $($summary.SkippedNotTarget)"
Write-Host "  Skipped (missing item)       : $($summary.SkippedMissingItem)"
Write-Host "  Skipped (current not empty)  : $($summary.SkippedCurrentNotEmpty)"
Write-Host "  Skipped (invalid proposed)   : $($summary.SkippedInvalidProposed)"
Write-Host "  Failed rows                  : $($summary.FailedRows)"
Write-Host ""
Write-Ok "Results CSV exported : $resultsPath"
Write-Ok "Rollback CSV exported: $rollbackPath"
Write-Ok "Summary JSON exported: $summaryPath"

[PSCustomObject]@{
    SummaryPath  = $summaryPath
    ResultsPath  = $resultsPath
    RollbackPath = $rollbackPath
    PlanPath     = $planPath
    Summary      = $summary
}
