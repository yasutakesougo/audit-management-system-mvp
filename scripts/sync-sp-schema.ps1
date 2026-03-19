#requires -Modules PnP.PowerShell

<#
SP Schema Sync Runbook Script
Target site: https://isogokatudouhome.sharepoint.com/sites/welfare

使い方:
1. PowerShell で実行
2. 初回は $DryRun = $true
3. 内容確認後、$DryRun = $false で本実行

前提:
- PnP PowerShell インストール済み
  Install-Module PnP.PowerShell -Scope CurrentUser
#>

param(
    [string]$SiteUrl = "https://isogokatudouhome.sharepoint.com/sites/welfare",
    [bool]$DryRun = $true
)

$ErrorActionPreference = "Stop"

function Write-Info($msg)  { Write-Host "[INFO]  $msg" -ForegroundColor Cyan }
function Write-Ok($msg)    { Write-Host "[OK]    $msg" -ForegroundColor Green }
function Write-WarnMsg($msg){ Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Write-ErrMsg($msg){ Write-Host "[ERROR] $msg" -ForegroundColor Red }

function Invoke-IfNotDryRun {
    param(
        [scriptblock]$Action,
        [string]$Description
    )
    if ($DryRun) {
        Write-Host "[DRYRUN] $Description" -ForegroundColor Magenta
    } else {
        & $Action
        Write-Ok $Description
    }
}

function Get-ListSafe {
    param([string]$ListTitle)
    try {
        return Get-PnPList -Identity $ListTitle -ErrorAction Stop
    } catch {
        return $null
    }
}

function Ensure-List {
    param(
        [string]$Title,
        [string]$Template = "GenericList"
    )

    $existing = Get-ListSafe -ListTitle $Title
    if ($null -ne $existing) {
        Write-Info "List exists: $Title"
        return $existing
    }

    Invoke-IfNotDryRun -Description "Create list '$Title'" -Action {
        New-PnPList -Title $Title -Template $Template -OnQuickLaunch:$true
    }

    if (-not $DryRun) {
        return Get-ListSafe -ListTitle $Title
    }
    return $null
}

function Get-FieldSafe {
    param(
        [string]$ListTitle,
        [string]$InternalName
    )
    try {
        $fields = Get-PnPField -List $ListTitle
        return $fields | Where-Object { $_.InternalName -eq $InternalName } | Select-Object -First 1
    } catch {
        return $null
    }
}

function Ensure-FieldText {
    param(
        [string]$ListTitle,
        [string]$InternalName,
        [string]$DisplayName = $InternalName,
        [bool]$Required = $false
    )
    $field = Get-FieldSafe -ListTitle $ListTitle -InternalName $InternalName
    if ($field) {
        Write-Info "Field exists: $ListTitle.$InternalName"
        return
    }

    Invoke-IfNotDryRun -Description "Add Text field '$InternalName' to '$ListTitle'" -Action {
        Add-PnPField -List $ListTitle -DisplayName $DisplayName -InternalName $InternalName -Type Text -AddToDefaultView
        if ($Required) {
            Set-PnPField -List $ListTitle -Identity $InternalName -Values @{ Required = $true }
        }
    }
}

function Ensure-FieldNote {
    param(
        [string]$ListTitle,
        [string]$InternalName,
        [string]$DisplayName = $InternalName,
        [bool]$Required = $false,
        [int]$NumberOfLines = 6
    )
    $field = Get-FieldSafe -ListTitle $ListTitle -InternalName $InternalName
    if ($field) {
        Write-Info "Field exists: $ListTitle.$InternalName"
        return
    }

    Invoke-IfNotDryRun -Description "Add Note field '$InternalName' to '$ListTitle'" -Action {
        Add-PnPField -List $ListTitle -DisplayName $DisplayName -InternalName $InternalName -Type Note -AddToDefaultView
        Set-PnPField -List $ListTitle -Identity $InternalName -Values @{
            Required      = $Required
            NumberOfLines = $NumberOfLines
            RichText      = $false
        }
    }
}

function Ensure-FieldBoolean {
    param(
        [string]$ListTitle,
        [string]$InternalName,
        [string]$DisplayName = $InternalName,
        [bool]$Required = $false,
        [bool]$DefaultValue = $false
    )
    $field = Get-FieldSafe -ListTitle $ListTitle -InternalName $InternalName
    if ($field) {
        Write-Info "Field exists: $ListTitle.$InternalName"
        return
    }

    Invoke-IfNotDryRun -Description "Add Boolean field '$InternalName' to '$ListTitle'" -Action {
        Add-PnPField -List $ListTitle -DisplayName $DisplayName -InternalName $InternalName -Type Boolean -AddToDefaultView
        Set-PnPField -List $ListTitle -Identity $InternalName -Values @{
            Required     = $Required
            DefaultValue = $DefaultValue
        }
    }
}

function Ensure-FieldDateTime {
    param(
        [string]$ListTitle,
        [string]$InternalName,
        [string]$DisplayName = $InternalName,
        [bool]$Required = $false,
        [string]$Format = "DateTime"
    )
    $field = Get-FieldSafe -ListTitle $ListTitle -InternalName $InternalName
    if ($field) {
        Write-Info "Field exists: $ListTitle.$InternalName"
        return
    }

    Invoke-IfNotDryRun -Description "Add DateTime field '$InternalName' to '$ListTitle'" -Action {
        Add-PnPField -List $ListTitle -DisplayName $DisplayName -InternalName $InternalName -Type DateTime -AddToDefaultView
        Set-PnPField -List $ListTitle -Identity $InternalName -Values @{
            Required = $Required
            Format   = $Format
        }
    }
}

function Ensure-FieldNumber {
    param(
        [string]$ListTitle,
        [string]$InternalName,
        [string]$DisplayName = $InternalName,
        [bool]$Required = $false
    )
    $field = Get-FieldSafe -ListTitle $ListTitle -InternalName $InternalName
    if ($field) {
        Write-Info "Field exists: $ListTitle.$InternalName"
        return
    }

    Invoke-IfNotDryRun -Description "Add Number field '$InternalName' to '$ListTitle'" -Action {
        Add-PnPField -List $ListTitle -DisplayName $DisplayName -InternalName $InternalName -Type Number -AddToDefaultView
        if ($Required) {
            Set-PnPField -List $ListTitle -Identity $InternalName -Values @{ Required = $true }
        }
    }
}

function Ensure-FieldChoice {
    param(
        [string]$ListTitle,
        [string]$InternalName,
        [string[]]$Choices,
        [string]$DisplayName = $InternalName,
        [bool]$Required = $false
    )
    $field = Get-FieldSafe -ListTitle $ListTitle -InternalName $InternalName
    if ($field) {
        Write-Info "Field exists: $ListTitle.$InternalName"
        return
    }

    $choicesXml = ($Choices | ForEach-Object { "<CHOICE>$_</CHOICE>" }) -join ""
    $requiredXml = if ($Required) { "TRUE" } else { "FALSE" }

    $xml = @"
<Field Type="Choice"
       DisplayName="$DisplayName"
       Name="$InternalName"
       StaticName="$InternalName"
       Required="$requiredXml"
       Format="Dropdown">
  <CHOICES>
    $choicesXml
  </CHOICES>
</Field>
"@

    Invoke-IfNotDryRun -Description "Add Choice field '$InternalName' to '$ListTitle' with choices [$($Choices -join ', ')]" -Action {
        Add-PnPFieldFromXml -List $ListTitle -FieldXml $xml
    }
}

function Ensure-Index {
    param(
        [string]$ListTitle,
        [string]$InternalName
    )
    $field = Get-FieldSafe -ListTitle $ListTitle -InternalName $InternalName
    if (-not $field) {
        Write-WarnMsg "Cannot add index. Field not found: $ListTitle.$InternalName"
        return
    }

    if ($field.Indexed -eq $true) {
        Write-Info "Index exists: $ListTitle.$InternalName"
        return
    }

    Invoke-IfNotDryRun -Description "Add index to '$ListTitle.$InternalName'" -Action {
        Set-PnPField -List $ListTitle -Identity $InternalName -Values @{ Indexed = $true }
    }
}

function Report-FieldType {
    param(
        [string]$ListTitle,
        [string[]]$InternalNames
    )
    Write-Host ""
    Write-Host "=== Field type report: $ListTitle ===" -ForegroundColor White
    foreach ($name in $InternalNames) {
        $field = Get-FieldSafe -ListTitle $ListTitle -InternalName $name
        if ($field) {
            Write-Host (" - {0}: TypeAsString={1}, Indexed={2}" -f $name, $field.TypeAsString, $field.Indexed)
        } else {
            Write-WarnMsg "$ListTitle.$name not found"
        }
    }
}

# ------------------------------
# Connect
# ------------------------------
Write-Info "Connecting to $SiteUrl"
Connect-PnPOnline -Url $SiteUrl -Interactive

# ------------------------------
# 1) CallLogs
# ------------------------------
Write-Host ""
Write-Host "=== Ensure CallLogs ===" -ForegroundColor White
Ensure-List -Title "CallLogs"

Ensure-FieldDateTime -ListTitle "CallLogs" -InternalName "ReceivedAt" -Required $true
Ensure-FieldText     -ListTitle "CallLogs" -InternalName "CallerName" -Required $true
Ensure-FieldText     -ListTitle "CallLogs" -InternalName "CallerOrg"
Ensure-FieldText     -ListTitle "CallLogs" -InternalName "TargetStaffName" -Required $true
Ensure-FieldText     -ListTitle "CallLogs" -InternalName "ReceivedByName" -Required $true
Ensure-FieldNote     -ListTitle "CallLogs" -InternalName "MessageBody" -Required $true
Ensure-FieldBoolean  -ListTitle "CallLogs" -InternalName "NeedCallback" -Required $true -DefaultValue $false
Ensure-FieldChoice   -ListTitle "CallLogs" -InternalName "Urgency" -Choices @("normal","today","urgent") -Required $true
Ensure-FieldChoice   -ListTitle "CallLogs" -InternalName "Status" -Choices @("new","callback_pending","done") -Required $true
Ensure-FieldText     -ListTitle "CallLogs" -InternalName "RelatedUserId"
Ensure-FieldText     -ListTitle "CallLogs" -InternalName "RelatedUserName"
Ensure-FieldDateTime -ListTitle "CallLogs" -InternalName "CallbackDueAt"
Ensure-FieldDateTime -ListTitle "CallLogs" -InternalName "CompletedAt"

# ------------------------------
# 2) Handoff / Handoffs
# ------------------------------
Write-Host ""
Write-Host "=== Ensure Handoff/Handoffs ===" -ForegroundColor White

$handoffListTitle = $null
if (Get-ListSafe -ListTitle "Handoff") {
    $handoffListTitle = "Handoff"
} elseif (Get-ListSafe -ListTitle "Handoffs") {
    $handoffListTitle = "Handoffs"
    Write-WarnMsg "Using existing list 'Handoffs'. Registry target is 'Handoff'. Consider unification later."
} else {
    $handoffListTitle = "Handoff"
    Ensure-List -Title $handoffListTitle
}

Ensure-FieldNote     -ListTitle $handoffListTitle -InternalName "Message" -Required $true
Ensure-FieldText     -ListTitle $handoffListTitle -InternalName "UserCode"
Ensure-FieldText     -ListTitle $handoffListTitle -InternalName "UserDisplayName"
Ensure-FieldText     -ListTitle $handoffListTitle -InternalName "Category" -Required $true
Ensure-FieldText     -ListTitle $handoffListTitle -InternalName "Severity" -Required $true
Ensure-FieldText     -ListTitle $handoffListTitle -InternalName "Status" -Required $true
Ensure-FieldText     -ListTitle $handoffListTitle -InternalName "TimeBand" -Required $true
Ensure-FieldText     -ListTitle $handoffListTitle -InternalName "MeetingSessionKey"
Ensure-FieldText     -ListTitle $handoffListTitle -InternalName "SourceType"
Ensure-FieldText     -ListTitle $handoffListTitle -InternalName "SourceId"
Ensure-FieldText     -ListTitle $handoffListTitle -InternalName "SourceUrl"
Ensure-FieldText     -ListTitle $handoffListTitle -InternalName "SourceKey"
Ensure-FieldText     -ListTitle $handoffListTitle -InternalName "SourceLabel"
Ensure-FieldText     -ListTitle $handoffListTitle -InternalName "CreatedBy" -Required $true
Ensure-FieldDateTime -ListTitle $handoffListTitle -InternalName "CreatedAt" -Required $true
Ensure-FieldText     -ListTitle $handoffListTitle -InternalName "ModifiedBy"
Ensure-FieldDateTime -ListTitle $handoffListTitle -InternalName "ModifiedAt"

# ------------------------------
# 3) MeetingMinutes
# ------------------------------
Write-Host ""
Write-Host "=== Ensure MeetingMinutes ===" -ForegroundColor White

if (Get-ListSafe -ListTitle "MeetingMinutes") {
    Ensure-FieldNote    -ListTitle "MeetingMinutes" -InternalName "StaffAttendance"
    Ensure-FieldNote    -ListTitle "MeetingMinutes" -InternalName "UserHealthNotes"
    Ensure-FieldBoolean -ListTitle "MeetingMinutes" -InternalName "IsPublished" -DefaultValue $false
    Ensure-FieldText    -ListTitle "MeetingMinutes" -InternalName "DistributionScope"
} else {
    Write-WarnMsg "List not found: MeetingMinutes"
}

# ------------------------------
# 4) AttendanceUsers
# ------------------------------
Write-Host ""
Write-Host "=== Ensure AttendanceUsers ===" -ForegroundColor White

if (Get-ListSafe -ListTitle "AttendanceUsers") {
    Ensure-FieldText    -ListTitle "AttendanceUsers" -InternalName "UserCode"
    Ensure-FieldBoolean -ListTitle "AttendanceUsers" -InternalName "IsTransportTarget" -DefaultValue $false
    Ensure-FieldNumber  -ListTitle "AttendanceUsers" -InternalName "StandardMinutes"
    Ensure-FieldBoolean -ListTitle "AttendanceUsers" -InternalName "IsActive" -DefaultValue $true

    # optional
    Ensure-FieldText    -ListTitle "AttendanceUsers" -InternalName "DefaultTransportToMethod"
    Ensure-FieldText    -ListTitle "AttendanceUsers" -InternalName "DefaultTransportFromMethod"
    Ensure-FieldText    -ListTitle "AttendanceUsers" -InternalName "DefaultTransportToNote"
    Ensure-FieldText    -ListTitle "AttendanceUsers" -InternalName "DefaultTransportFromNote"
} else {
    Write-WarnMsg "List not found: AttendanceUsers"
}

# ------------------------------
# 5) Transport_Log
# ------------------------------
Write-Host ""
Write-Host "=== Ensure Transport_Log ===" -ForegroundColor White

if (Get-ListSafe -ListTitle "Transport_Log") {
    Ensure-FieldText     -ListTitle "Transport_Log" -InternalName "UserCode"
    Ensure-FieldDateTime -ListTitle "Transport_Log" -InternalName "RecordDate" -Format "DateOnly"
    Ensure-FieldChoice   -ListTitle "Transport_Log" -InternalName "Direction" -Choices @("to","from")
    Ensure-FieldChoice   -ListTitle "Transport_Log" -InternalName "Status" -Choices @("pending","in-progress","arrived","absent","self")
    Ensure-FieldChoice   -ListTitle "Transport_Log" -InternalName "Method" -Choices @("facility-vehicle","family","taxi","walk","self","other")
    Ensure-FieldText     -ListTitle "Transport_Log" -InternalName "ScheduledTime"
    Ensure-FieldText     -ListTitle "Transport_Log" -InternalName "ActualTime"
    Ensure-FieldText     -ListTitle "Transport_Log" -InternalName "DriverName"
    Ensure-FieldNote     -ListTitle "Transport_Log" -InternalName "Notes"
    Ensure-FieldText     -ListTitle "Transport_Log" -InternalName "UpdatedBy"
    Ensure-FieldDateTime -ListTitle "Transport_Log" -InternalName "UpdatedAt"
} else {
    Write-WarnMsg "List not found: Transport_Log"
}

# ------------------------------
# 6) ISP_Master report only
# ------------------------------
Write-Host ""
Write-Host "=== Inspect ISP_Master ===" -ForegroundColor White

if (Get-ListSafe -ListTitle "ISP_Master") {
    Report-FieldType -ListTitle "ISP_Master" -InternalNames @(
        "UserCode",
        "IsCurrent",
        "PlanStartDate",
        "PlanEndDate",
        "Status",
        "VersionNo"
    )
} else {
    Write-WarnMsg "List not found: ISP_Master"
}

# ------------------------------
# 7) Holiday_Master report only
# ------------------------------
Write-Host ""
Write-Host "=== Inspect Holiday_Master ===" -ForegroundColor White

if (Get-ListSafe -ListTitle "Holiday_Master") {
    Report-FieldType -ListTitle "Holiday_Master" -InternalNames @("IsActive")
} else {
    Write-WarnMsg "List not found: Holiday_Master"
}

# ------------------------------
# 8) Indexes
# ------------------------------
Write-Host ""
Write-Host "=== Ensure indexes ===" -ForegroundColor White

if (Get-ListSafe -ListTitle "ISP_Master") {
    Ensure-Index -ListTitle "ISP_Master" -InternalName "UserCode"
    Ensure-Index -ListTitle "ISP_Master" -InternalName "IsCurrent"
}

if (Get-ListSafe -ListTitle "AttendanceUsers") {
    Ensure-Index -ListTitle "AttendanceUsers" -InternalName "UserCode"
}

if (Get-ListSafe -ListTitle "Transport_Log") {
    Ensure-Index -ListTitle "Transport_Log" -InternalName "UserCode"
    Ensure-Index -ListTitle "Transport_Log" -InternalName "RecordDate"
}

if (Get-ListSafe -ListTitle $handoffListTitle) {
    Ensure-Index -ListTitle $handoffListTitle -InternalName "CreatedAt"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor White
if ($DryRun) {
    Write-Host "DRY RUN completed. No changes were applied." -ForegroundColor Magenta
    Write-Host "Review output, then run again with: -DryRun `$false" -ForegroundColor Magenta
} else {
    Write-Host "Schema sync completed." -ForegroundColor Green
}
Write-Host "========================================" -ForegroundColor White
