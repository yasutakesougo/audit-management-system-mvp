#!/usr/bin/env pwsh
#requires -Modules PnP.PowerShell

<#
.SYNOPSIS
  CURRENT-DATA-LIVE-MEASURE-V1 — 対象 SharePoint リストの READ ONLY 計測。

.DESCRIPTION
  以下 6 primary lists について、List existence / Item count / earliest Created / latest Modified /
  key field availability / duplicate key count / missing key count を共通計測し、
  リスト別の個別計測も実施します。

  READ surface（契約）:
    Primary (6):
      - Users_Master
      - Staff_Master
      - Org_Master
      - Daily_Attendance
      - SupportRecord_Daily
      - DailyActivityRecords
    Auxiliary child-list candidates (exact 2, READ ONLY only):
      - DailyRecordRows
      - SupportRecord_DailyRows

  本スクリプトは SharePoint へ一切書き込みません（READ ONLY）。
  組織固有の SiteUrl / ClientId はソースに持ちません。

  Exact Site Binding (C6):
    -SiteUrl と -ExpectedSiteUrl（または環境変数 CURRENT_DATA_LIVE_MEASURE_EXPECTED_SITE_URL）
    が同一の正規化 URL であること。接続後の Get-PnPWeb.Url もその URL と完全一致すること。
    既存 PnP コンテキストは一致時のみ再利用し、不一致なら中断する。

.EXAMPLE
  pwsh ./scripts/measure/CURRENT-DATA-LIVE-MEASURE-V1.ps1 -SiteUrl "https://<tenant>.sharepoint.com/sites/<site>" -ExpectedSiteUrl "https://<tenant>.sharepoint.com/sites/<site>" -ClientId "<entra-app-client-id>"

.EXAMPLE
  pwsh ./scripts/measure/CURRENT-DATA-LIVE-MEASURE-V1.ps1 -SiteUrl "https://<tenant>.sharepoint.com/sites/<site>" -ExpectedSiteUrl "https://<tenant>.sharepoint.com/sites/<site>" -UseDeviceLogin
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SiteUrl,
    [string]$ExpectedSiteUrl = "",
    [string]$ClientId = "",
    [string]$OutputDir = "./artifacts/live-measure-v1",
    [switch]$UseDeviceLogin,
    [switch]$NoExport
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "Continue"

# ──────────────────────────────────────────────────────────────
# Utilities
# ──────────────────────────────────────────────────────────────
function Write-Info([string]$Message) { Write-Host "[INFO]  $Message" -ForegroundColor Cyan }
function Write-Ok([string]$Message)   { Write-Host "[OK]    $Message" -ForegroundColor Green }
function Write-Warn([string]$Message) { Write-Host "[WARN]  $Message" -ForegroundColor Yellow }
function Write-Err([string]$Message)  { Write-Host "[ERROR] $Message" -ForegroundColor Red }

function Ensure-Directory([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Resolve-ClientId([string]$ExplicitClientId) {
    $candidates = @(
        $ExplicitClientId,
        $env:PNP_CLIENT_ID,
        $env:VITE_MSAL_CLIENT_ID,
        $env:VITE_AAD_CLIENT_ID
    )
    foreach ($candidate in $candidates) {
        if (-not [string]::IsNullOrWhiteSpace($candidate)) {
            return $candidate.Trim()
        }
    }
    throw "ClientId is required. Pass -ClientId or set PNP_CLIENT_ID / VITE_MSAL_CLIENT_ID / VITE_AAD_CLIENT_ID."
}

function ConvertTo-CanonicalSiteUrl {
    param([Parameter(Mandatory = $true)][string]$Url)
    $raw = $Url.Trim()
    if ($raw -notmatch '^https://') {
        throw "Exact Site Binding: URL must start with https://."
    }
    $uri = $null
    try {
        $uri = [Uri]$raw
    } catch {
        throw "Exact Site Binding: invalid URL."
    }
    if (-not $uri.IsAbsoluteUri) {
        throw "Exact Site Binding: URL must be absolute."
    }
    if ($uri.Scheme -ne "https") {
        throw "Exact Site Binding: URL scheme must be https."
    }
    if (-not [string]::IsNullOrWhiteSpace($uri.UserInfo)) {
        throw "Exact Site Binding: userinfo is not allowed."
    }
    if (-not [string]::IsNullOrWhiteSpace($uri.Query) -or -not [string]::IsNullOrWhiteSpace($uri.Fragment)) {
        throw "Exact Site Binding: query/fragment is not allowed."
    }
    if ([string]::IsNullOrWhiteSpace($uri.Host)) {
        throw "Exact Site Binding: host is required."
    }
    $path = $uri.AbsolutePath.TrimEnd("/")
    if ($path -match '(^|/)\.\.(/|$)') {
        throw "Exact Site Binding: path traversal is not allowed."
    }
    if ($path -notmatch '^/(sites|teams)/[^/]+$') {
        throw "Exact Site Binding: URL must be exactly https://<host>/(sites|teams)/<sitename> with no extra path."
    }
    return ("https://{0}{1}" -f $uri.Host.ToLowerInvariant(), $path.ToLowerInvariant())
}

function Resolve-ExpectedSiteUrl([string]$ExplicitExpectedSiteUrl) {
    $candidates = @(
        $ExplicitExpectedSiteUrl,
        $env:CURRENT_DATA_LIVE_MEASURE_EXPECTED_SITE_URL
    )
    foreach ($candidate in $candidates) {
        if (-not [string]::IsNullOrWhiteSpace($candidate)) {
            return $candidate.Trim()
        }
    }
    throw "ExpectedSiteUrl is required for Exact Site Binding. Pass -ExpectedSiteUrl or set CURRENT_DATA_LIVE_MEASURE_EXPECTED_SITE_URL to the same URL as -SiteUrl."
}

function Get-ConnectedWeb {
    $web = Get-PnPWeb -ErrorAction Stop
    if ($null -eq $web -or [string]::IsNullOrWhiteSpace([string]$web.Url) -or $null -eq $web.Id) {
        throw "Exact Site Binding: Get-PnPWeb did not return Url and Id."
    }
    return $web
}

function Assert-ExactSiteBinding {
    param(
        [Parameter(Mandatory = $true)][string]$BoundSiteUrl,
        [Parameter(Mandatory = $true)][string]$ConnectedWebUrl
    )
    $connectedCanonical = ConvertTo-CanonicalSiteUrl -Url $ConnectedWebUrl
    if ($connectedCanonical -cne $BoundSiteUrl) {
        throw "Exact Site Binding failed: connected web does not match the bound site. Measurement aborted."
    }
}

function Get-InternalFieldName {
    param(
        [string]$ListName,
        [string[]]$Candidates
    )
    $fields = Get-PnPField -List $ListName -ErrorAction SilentlyContinue | Select-Object -ExpandProperty InternalName
    foreach ($c in $Candidates) {
        if ($fields -contains $c) { return $c }
    }
    return $null
}

function Test-ListExists {
    param([string]$ListName)
    $list = Get-PnPList -Identity $ListName -ErrorAction SilentlyContinue
    return ($null -ne $list)
}

function Get-ItemCountEstimate {
    # Get-PnPListItem は全件返すが、件数だけ先に確認するために List.ItemCount を使う
    param([string]$ListName)
    $list = Get-PnPList -Identity $ListName -ErrorAction SilentlyContinue
    if ($list) { return $list.ItemCount }
    return 0
}

function Get-IsoString($Value) {
    if ($null -eq $Value) { return $null }
    if ($Value -is [System.DateTime]) { return $Value.ToString("yyyy-MM-ddTHH:mm:ssZ") }
    $dt = $Value -as [System.DateTime]
    if ($dt) { return $dt.ToString("yyyy-MM-ddTHH:mm:ssZ") }
    return [string]$Value
}

function Get-DateOnlyString($Value) {
    if ($null -eq $Value) { return $null }
    if ($Value -is [System.DateTime]) { return $Value.ToString("yyyy-MM-dd") }
    $s = [string]$Value
    if ($s -match "^(\d{4}-\d{2}-\d{2})") { return $Matches[1] }
    $dt = $Value -as [System.DateTime]
    if ($dt) { return $dt.ToString("yyyy-MM-dd") }
    return $s
}

# ──────────────────────────────────────────────────────────────
# Exact Site Binding + Connect
# ──────────────────────────────────────────────────────────────
$resolvedClientId = Resolve-ClientId -ExplicitClientId $ClientId
$boundSiteUrl = ConvertTo-CanonicalSiteUrl -Url $SiteUrl
$expectedCanonical = ConvertTo-CanonicalSiteUrl -Url (Resolve-ExpectedSiteUrl -ExplicitExpectedSiteUrl $ExpectedSiteUrl)
if ($boundSiteUrl -cne $expectedCanonical) {
    throw "Exact Site Binding failed: -SiteUrl and ExpectedSiteUrl do not match after canonicalization."
}

$ctx = $null
try { $ctx = Get-PnPContext -ErrorAction SilentlyContinue } catch {}
if ($ctx) {
    Write-Info "Existing PnP connection found; verifying Exact Site Binding ..."
    $connectedWeb = Get-ConnectedWeb
    Assert-ExactSiteBinding -BoundSiteUrl $boundSiteUrl -ConnectedWebUrl ([string]$connectedWeb.Url)
    Write-Ok "Reusing existing PnP connection (Exact Site Binding verified)."
} else {
    Write-Info "Connecting to bound SharePoint site (READ ONLY) ..."
    if ($UseDeviceLogin) {
        Connect-PnPOnline -Url $boundSiteUrl -DeviceLogin -ClientId $resolvedClientId
    } else {
        Connect-PnPOnline -Url $boundSiteUrl -Interactive -ClientId $resolvedClientId
    }
    $connectedWeb = Get-ConnectedWeb
    Assert-ExactSiteBinding -BoundSiteUrl $boundSiteUrl -ConnectedWebUrl ([string]$connectedWeb.Url)
    Write-Ok "Connected (Exact Site Binding verified)."
}
$boundWebId = [string]$connectedWeb.Id

# ──────────────────────────────────────────────────────────────
# Common measurement function
# ──────────────────────────────────────────────────────────────
function Measure-Common {
    param(
        [string]$ListName,
        [string[]]$KeyCandidates,
        [string[]]$DateCandidates = @()
    )

    Write-Info "Measuring $ListName ..."
    $result = [ordered]@{
        ListName            = $ListName
        Exists              = $false
        ItemCount           = 0
        EarliestCreated     = $null
        LatestModified      = $null
        KeyField            = $null
        KeyFieldAvailable   = $false
        DuplicateKeyCount   = 0
        MissingKeyCount     = 0
        Notes               = @()
    }

    if (-not (Test-ListExists $ListName)) {
        Write-Warn "List '$ListName' does not exist."
        $result.Notes += "List not found"
        return $result
    }
    $result.Exists = $true

    $keyField = Get-InternalFieldName -ListName $ListName -Candidates $KeyCandidates
    $dateField = if ($DateCandidates.Count -gt 0) { Get-InternalFieldName -ListName $ListName -Candidates $DateCandidates } else { $null }

    $result.KeyField = $keyField
    $result.KeyFieldAvailable = -not [string]::IsNullOrWhiteSpace($keyField)
    if (-not $result.KeyFieldAvailable) {
        Write-Warn "$ListName`: key field not found from candidates $($KeyCandidates -join ', ')"
        $result.Notes += "Key field not found"
    }

    $fields = @("ID", "Created", "Modified")
    if ($keyField) { $fields += $keyField }
    if ($dateField) { $fields += $dateField }
    $fields = $fields | Select-Object -Unique

    $count = Get-ItemCountEstimate -ListName $ListName
    $result.ItemCount = $count

    if ($count -eq 0) {
        Write-Ok "$ListName`: 0 items."
        return $result
    }

    # Retrieve all items with paging
    try {
        $items = Get-PnPListItem -List $ListName -PageSize 5000 -Fields $fields
    } catch {
        Write-Err "$ListName`: failed to retrieve items: $($_.Exception.Message)"
        $result.Notes += "Retrieval error: $($_.Exception.Message)"
        return $result
    }

    $createdList = New-Object System.Collections.Generic.List[System.DateTime]
    $modifiedList = New-Object System.Collections.Generic.List[System.DateTime]
    $keyGroups = @{}
    $missingKeys = 0

    foreach ($item in $items) {
        $created = $item["Created"]
        $modified = $item["Modified"]
        if ($created) { $createdList.Add([datetime]$created) }
        if ($modified) { $modifiedList.Add([datetime]$modified) }

        if ($keyField) {
            $key = [string]$item[$keyField]
            if ([string]::IsNullOrWhiteSpace($key)) {
                $missingKeys++
            } else {
                if (-not $keyGroups.ContainsKey($key)) { $keyGroups[$key] = 0 }
                $keyGroups[$key]++
            }
        }
    }

    if ($createdList.Count -gt 0) {
        $sortedCreated = $createdList | Sort-Object
        $result.EarliestCreated = Get-IsoString $sortedCreated[0]
    }
    if ($modifiedList.Count -gt 0) {
        $sortedModified = $modifiedList | Sort-Object -Descending
        $result.LatestModified = Get-IsoString $sortedModified[0]
    }

    $result.MissingKeyCount = $missingKeys
    $duplicateKeyCount = 0
    foreach ($entry in $keyGroups.GetEnumerator()) {
        if ($entry.Value -gt 1) { $duplicateKeyCount++ }
    }
    $result.DuplicateKeyCount = $duplicateKeyCount

    Write-Ok "$ListName`: count=$($result.ItemCount), key='$keyField', missing=$missingKeys, duplicate=$($result.DuplicateKeyCount)"

    return [pscustomobject]$result
}

# ──────────────────────────────────────────────────────────────
# Load Users_Master key set for orphan detection
# ──────────────────────────────────────────────────────────────
$usersMasterKeySet = $null
$usersMasterKeyField = $null
if (Test-ListExists "Users_Master") {
    $usersMasterKeyField = Get-InternalFieldName -ListName "Users_Master" -Candidates @("UserID", "UserCode")
    if ($usersMasterKeyField) {
        Write-Info "Loading Users_Master keys for orphan detection ..."
        $userItems = Get-PnPListItem -List "Users_Master" -PageSize 5000 -Fields @($usersMasterKeyField)
        $set = @{}
        foreach ($u in $userItems) {
            $k = [string]$u[$usersMasterKeyField]
            if (-not [string]::IsNullOrWhiteSpace($k)) { $set[$k] = $true }
        }
        $usersMasterKeySet = $set
        Write-Ok "Users_Master keys loaded: $($set.Count) unique."
    }
}

# ──────────────────────────────────────────────────────────────
# Individual measurements
# ──────────────────────────────────────────────────────────────
$allResults = [ordered]@{
    Timestamp              = (Get-Date).ToString("o")
    SiteBinding            = [ordered]@{
        Mode         = "EXACT"
        BoundSiteUrl = $boundSiteUrl
        BoundWebId   = $boundWebId
        Verified     = $true
    }
    ReadSurface            = [ordered]@{
        PrimaryLists              = @("Users_Master", "Staff_Master", "Org_Master", "Daily_Attendance", "SupportRecord_Daily", "DailyActivityRecords")
        AuxiliaryChildListCandidates = @("DailyRecordRows", "SupportRecord_DailyRows")
        Mode                      = "READ ONLY"
    }
    Lists                  = [ordered]@{}
}

# ── Users_Master ──
$commonUsers = Measure-Common -ListName "Users_Master" -KeyCandidates @("UserID", "UserCode")
$usersDetail = [ordered]@{
    Common                 = $commonUsers
    UserIDUniqueness       = if ($commonUsers.DuplicateKeyCount -eq 0) { "UNIQUE" } else { "DUPLICATES: $($commonUsers.DuplicateKeyCount)" }
    TransportValueCount    = 0
    BenefitValueCount      = 0
    SplitTargetCount       = 0
    TransportFieldsFound   = @()
    BenefitFieldsFound     = @()
}

if ($commonUsers.Exists) {
    $transportCandidates = @("TransportToDays", "TransportFromDays", "TransportCourse", "TransportSchedule", "TransportAdditionType")
    $benefitCandidates   = @("RecipientCertNumber", "RecipientCertExpiry", "GrantMunicipality", "GrantPeriodStart", "GrantPeriodEnd", "DisabilitySupportLevel", "GrantedDaysPerMonth", "UserCopayLimit", "MealAddition", "CopayPaymentMethod")

    $transportFields = Get-PnPField -List "Users_Master" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty InternalName | Where-Object { $transportCandidates -contains $_ }
    $benefitFields   = Get-PnPField -List "Users_Master" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty InternalName | Where-Object { $benefitCandidates -contains $_ }
    $usersDetail.TransportFieldsFound = @($transportFields)
    $usersDetail.BenefitFieldsFound   = @($benefitFields)

    $allUsers = Get-PnPListItem -List "Users_Master" -PageSize 5000 -Fields (@("ID") + $transportFields + $benefitFields | Select-Object -Unique)
    $transportCount = 0
    $benefitCount   = 0
    $splitCount     = 0

    foreach ($u in $allUsers) {
        $hasTransport = $false
        $hasBenefit   = $false
        foreach ($f in $transportFields) {
            $v = $u[$f]
            if ($v -is [System.Array] -and $v.Count -gt 0) { $hasTransport = $true }
            elseif (-not [string]::IsNullOrWhiteSpace([string]$v)) { $hasTransport = $true }
        }
        foreach ($f in $benefitFields) {
            $v = $u[$f]
            if (-not [string]::IsNullOrWhiteSpace([string]$v)) { $hasBenefit = $true }
        }
        if ($hasTransport) { $transportCount++ }
        if ($hasBenefit)   { $benefitCount++ }
        if ($hasTransport -or $hasBenefit) { $splitCount++ }
    }
    $usersDetail.TransportValueCount = $transportCount
    $usersDetail.BenefitValueCount   = $benefitCount
    $usersDetail.SplitTargetCount    = $splitCount
    Write-Ok "Users_Master: transport=$transportCount, benefit=$benefitCount, split-target=$splitCount"
}
$allResults.Lists["Users_Master"] = $usersDetail

# ── Staff_Master ──
$commonStaff = Measure-Common -ListName "Staff_Master" -KeyCandidates @("StaffID", "Staff_x0020_ID")
$staffDetail = [ordered]@{
    Common          = $commonStaff
    KeyUniqueness   = if ($commonStaff.DuplicateKeyCount -eq 0) { "UNIQUE" } else { "DUPLICATES: $($commonStaff.DuplicateKeyCount)" }
}
$allResults.Lists["Staff_Master"] = $staffDetail

# ── Org_Master ──
$commonOrg = Measure-Common -ListName "Org_Master" -KeyCandidates @("OrgCode", "Title")
$orgDetail = [ordered]@{
    Common        = $commonOrg
    KeyUniqueness = if ($commonOrg.DuplicateKeyCount -eq 0) { "UNIQUE" } else { "DUPLICATES: $($commonOrg.DuplicateKeyCount)" }
}
$allResults.Lists["Org_Master"] = $orgDetail

# ── Daily_Attendance ──
$commonDailyAtt = Measure-Common -ListName "Daily_Attendance" -KeyCandidates @("UserCode", "UserID", "UserId") -DateCandidates @("RecordDate", "Date")
$dailyAttDetail = [ordered]@{
    Common                     = $commonDailyAtt
    DateRange                  = @{ Min = $null; Max = $null }
    MissingUserCodeCount       = 0
    MissingRecordDateCount     = 0
    TargetKeyDuplicateCount    = 0
}

if ($commonDailyAtt.Exists -and $commonDailyAtt.ItemCount -gt 0) {
    $userField = Get-InternalFieldName -ListName "Daily_Attendance" -Candidates @("UserCode", "UserID", "UserId")
    $dateField = Get-InternalFieldName -ListName "Daily_Attendance" -Candidates @("RecordDate", "Date")
    $fields = @("ID", "Created", "Modified", $userField, $dateField) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique
    $items = Get-PnPListItem -List "Daily_Attendance" -PageSize 5000 -Fields $fields

    $dates = New-Object System.Collections.Generic.List[string]
    $missingUser = 0
    $missingDate = 0
    $targetGroups = @{}

    foreach ($item in $items) {
        $u = [string]$item[$userField]
        $d = Get-DateOnlyString $item[$dateField]
        if ([string]::IsNullOrWhiteSpace($u)) { $missingUser++ }
        if ([string]::IsNullOrWhiteSpace($d)) { $missingDate++ } else { $dates.Add($d) }
        if (-not [string]::IsNullOrWhiteSpace($u) -and -not [string]::IsNullOrWhiteSpace($d)) {
            $targetKey = "$($u)_$($d)"
            if (-not $targetGroups.ContainsKey($targetKey)) { $targetGroups[$targetKey] = 0 }
            $targetGroups[$targetKey]++
        }
    }

    if ($dates.Count -gt 0) {
        $sortedDates = $dates | Sort-Object
        $dailyAttDetail.DateRange.Min = $sortedDates[0]
        $dailyAttDetail.DateRange.Max = $sortedDates[-1]
    }
    $dailyAttDetail.MissingUserCodeCount   = $missingUser
    $dailyAttDetail.MissingRecordDateCount = $missingDate
    $targetDupCount = 0
    foreach ($entry in $targetGroups.GetEnumerator()) {
        if ($entry.Value -gt 1) { $targetDupCount++ }
    }
    $dailyAttDetail.TargetKeyDuplicateCount = $targetDupCount
    Write-Ok "Daily_Attendance: dateRange=$($dailyAttDetail.DateRange.Min) ~ $($dailyAttDetail.DateRange.Max), missingUser=$missingUser, missingDate=$missingDate, targetDup=$($dailyAttDetail.TargetKeyDuplicateCount)"
}
$allResults.Lists["Daily_Attendance"] = $dailyAttDetail

# ── SupportRecord_Daily ──
$commonSupportDaily = Measure-Common -ListName "SupportRecord_Daily" -KeyCandidates @("Title") -DateCandidates @("RecordDate")
$auxiliaryChildListCandidates = @("DailyRecordRows", "SupportRecord_DailyRows")
$auxiliaryChildLists = foreach ($c in $auxiliaryChildListCandidates) {
    $exists = Test-ListExists $c
    [ordered]@{
        ListName  = $c
        Exists    = $exists
        ItemCount = if ($exists) { Get-ItemCountEstimate -ListName $c } else { 0 }
        Mode      = "READ ONLY"
    }
}
$childRowTotal = 0
foreach ($aux in $auxiliaryChildLists) {
    if ($aux.Exists) { $childRowTotal += $aux.ItemCount }
}

$supportDetail = [ordered]@{
    Common                      = $commonSupportDaily
    ParentCount                 = $commonSupportDaily.ItemCount
    DateRange                   = @{ Min = $null; Max = $null }
    ParentKeyDuplicateCount     = 0
    EmbeddedRowTotal            = 0
    EmbeddedParseFailureCount   = 0
    AuxiliaryChildLists         = @($auxiliaryChildLists)
    ChildRowTotal               = $childRowTotal
    ConversionPlannedCount      = 0
    ConversionPlannedCountDefinition = "EmbeddedRowTotal + ChildRowTotal (child-row equivalents planned for normalization)"
}

if ($commonSupportDaily.Exists -and $commonSupportDaily.ItemCount -gt 0) {
    $titleField = Get-InternalFieldName -ListName "SupportRecord_Daily" -Candidates @("Title")
    $dateField  = Get-InternalFieldName -ListName "SupportRecord_Daily" -Candidates @("RecordDate")
    $jsonField  = Get-InternalFieldName -ListName "SupportRecord_Daily" -Candidates @("UserRowsJSON", "User_x0020_Rows_x0020_JSON")
    $fields = @("ID", "Created", "Modified", $titleField, $dateField, $jsonField) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique
    $parents = Get-PnPListItem -List "SupportRecord_Daily" -PageSize 5000 -Fields $fields

    $dates = New-Object System.Collections.Generic.List[string]
    $parentKeyGroups = @{}
    $embeddedTotal = 0
    $parseFailures = 0

    foreach ($p in $parents) {
        $title = [string]$p[$titleField]
        $date  = Get-DateOnlyString $p[$dateField]
        if (-not [string]::IsNullOrWhiteSpace($date)) { $dates.Add($date) }
        if (-not [string]::IsNullOrWhiteSpace($title)) {
            if (-not $parentKeyGroups.ContainsKey($title)) { $parentKeyGroups[$title] = 0 }
            $parentKeyGroups[$title]++
        }

        if ($jsonField) {
            $json = [string]$p[$jsonField]
            if (-not [string]::IsNullOrWhiteSpace($json)) {
                try {
                    $rows = $json | ConvertFrom-Json -ErrorAction Stop
                    if ($rows -is [System.Array]) {
                        $embeddedTotal += $rows.Count
                    } elseif ($rows -is [PSCustomObject]) {
                        $embeddedTotal += 1
                    }
                } catch {
                    $parseFailures++
                }
            }
        }
    }

    if ($dates.Count -gt 0) {
        $sortedDates = $dates | Sort-Object
        $supportDetail.DateRange.Min = $sortedDates[0]
        $supportDetail.DateRange.Max = $sortedDates[-1]
    }
    $parentDupCount = 0
    foreach ($entry in $parentKeyGroups.GetEnumerator()) {
        if ($entry.Value -gt 1) { $parentDupCount++ }
    }
    $supportDetail.ParentKeyDuplicateCount   = $parentDupCount
    $supportDetail.EmbeddedRowTotal          = $embeddedTotal
    $supportDetail.EmbeddedParseFailureCount = $parseFailures
}

$supportDetail.ConversionPlannedCount = $supportDetail.EmbeddedRowTotal + $supportDetail.ChildRowTotal
foreach ($aux in $auxiliaryChildLists) {
    if ($aux.Exists) {
        Write-Ok "Auxiliary child list '$($aux.ListName)' has $($aux.ItemCount) rows (READ ONLY)."
    } else {
        Write-Warn "Auxiliary child list '$($aux.ListName)' not found."
    }
}
Write-Ok "SupportRecord_Daily: dateRange=$($supportDetail.DateRange.Min) ~ $($supportDetail.DateRange.Max), embeddedRows=$($supportDetail.EmbeddedRowTotal), parseFailures=$($supportDetail.EmbeddedParseFailureCount), childRows=$($supportDetail.ChildRowTotal), conversionPlanned=$($supportDetail.ConversionPlannedCount)"
$allResults.Lists["SupportRecord_Daily"] = $supportDetail

# ── DailyActivityRecords ──
$commonDailyAct = Measure-Common -ListName "DailyActivityRecords" -KeyCandidates @("UserCode", "UserID", "UserId") -DateCandidates @("RecordDate")
$dailyActDetail = [ordered]@{
    Common                = $commonDailyAct
    DateRange             = @{ Min = $null; Max = $null }
    MissingUserKeyCount   = 0
    OrphanCandidateCount  = 0
}

if ($commonDailyAct.Exists -and $commonDailyAct.ItemCount -gt 0) {
    $userField = Get-InternalFieldName -ListName "DailyActivityRecords" -Candidates @("UserCode", "UserID", "UserId")
    $dateField = Get-InternalFieldName -ListName "DailyActivityRecords" -Candidates @("RecordDate")
    $fields = @("ID", "Created", "Modified", $userField, $dateField) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique
    $items = Get-PnPListItem -List "DailyActivityRecords" -PageSize 5000 -Fields $fields

    $dates = New-Object System.Collections.Generic.List[string]
    $missingUser = 0
    $orphan = 0

    foreach ($item in $items) {
        $u = [string]$item[$userField]
        $d = Get-DateOnlyString $item[$dateField]
        if (-not [string]::IsNullOrWhiteSpace($d)) { $dates.Add($d) }
        if ([string]::IsNullOrWhiteSpace($u)) {
            $missingUser++
        } elseif ($null -ne $usersMasterKeySet -and -not $usersMasterKeySet.ContainsKey($u)) {
            $orphan++
        }
    }

    if ($dates.Count -gt 0) {
        $sortedDates = $dates | Sort-Object
        $dailyActDetail.DateRange.Min = $sortedDates[0]
        $dailyActDetail.DateRange.Max = $sortedDates[-1]
    }
    $dailyActDetail.MissingUserKeyCount  = $missingUser
    $dailyActDetail.OrphanCandidateCount = $orphan
    Write-Ok "DailyActivityRecords: dateRange=$($dailyActDetail.DateRange.Min) ~ $($dailyActDetail.DateRange.Max), missingUser=$missingUser, orphans=$orphan"
}
$allResults.Lists["DailyActivityRecords"] = $dailyActDetail

# ──────────────────────────────────────────────────────────────
# Export
# ──────────────────────────────────────────────────────────────
if (-not $NoExport) {
    Ensure-Directory -Path $OutputDir
    $jsonPath = Join-Path $OutputDir "CURRENT-DATA-LIVE-MEASURE-V1.json"
    $allResults | ConvertTo-Json -Depth 10 | Set-Content -Path $jsonPath -Encoding UTF8
    Write-Ok "Summary JSON written: $jsonPath"

    # Flat CSV summary
    $csvRows = foreach ($listName in $allResults.Lists.Keys) {
        $r = $allResults.Lists[$listName]
        $c = $r.Common
        [PSCustomObject]@{
            ListName            = $listName
            Exists              = $c.Exists
            ItemCount           = $c.ItemCount
            EarliestCreated     = $c.EarliestCreated
            LatestModified      = $c.LatestModified
            KeyField            = $c.KeyField
            KeyFieldAvailable   = $c.KeyFieldAvailable
            MissingKeyCount     = $c.MissingKeyCount
            DuplicateKeyCount   = $c.DuplicateKeyCount
            Notes               = ($c.Notes -join "; ")
            # list-specific
            Users_TransportCount    = if ($listName -eq "Users_Master") { $r.TransportValueCount } else { $null }
            Users_BenefitCount      = if ($listName -eq "Users_Master") { $r.BenefitValueCount } else { $null }
            Users_SplitTargetCount  = if ($listName -eq "Users_Master") { $r.SplitTargetCount } else { $null }
            DailyAtt_DateMin        = if ($listName -eq "Daily_Attendance") { $r.DateRange.Min } else { $null }
            DailyAtt_DateMax        = if ($listName -eq "Daily_Attendance") { $r.DateRange.Max } else { $null }
            DailyAtt_MissingUser    = if ($listName -eq "Daily_Attendance") { $r.MissingUserCodeCount } else { $null }
            DailyAtt_MissingDate    = if ($listName -eq "Daily_Attendance") { $r.MissingRecordDateCount } else { $null }
            DailyAtt_TargetKeyDup   = if ($listName -eq "Daily_Attendance") { $r.TargetKeyDuplicateCount } else { $null }
            Support_DateMin         = if ($listName -eq "SupportRecord_Daily") { $r.DateRange.Min } else { $null }
            Support_DateMax         = if ($listName -eq "SupportRecord_Daily") { $r.DateRange.Max } else { $null }
            Support_ParentKeyDup    = if ($listName -eq "SupportRecord_Daily") { $r.ParentKeyDuplicateCount } else { $null }
            Support_EmbeddedRows    = if ($listName -eq "SupportRecord_Daily") { $r.EmbeddedRowTotal } else { $null }
            Support_ParseFailures   = if ($listName -eq "SupportRecord_Daily") { $r.EmbeddedParseFailureCount } else { $null }
            Support_ChildRows       = if ($listName -eq "SupportRecord_Daily") { $r.ChildRowTotal } else { $null }
            Support_ConversionPlanned = if ($listName -eq "SupportRecord_Daily") { $r.ConversionPlannedCount } else { $null }
            Support_DailyRecordRows_Exists = if ($listName -eq "SupportRecord_Daily") { ($r.AuxiliaryChildLists | Where-Object { $_.ListName -eq "DailyRecordRows" }).Exists } else { $null }
            Support_DailyRecordRows_Count  = if ($listName -eq "SupportRecord_Daily") { ($r.AuxiliaryChildLists | Where-Object { $_.ListName -eq "DailyRecordRows" }).ItemCount } else { $null }
            Support_SupportRecord_DailyRows_Exists = if ($listName -eq "SupportRecord_Daily") { ($r.AuxiliaryChildLists | Where-Object { $_.ListName -eq "SupportRecord_DailyRows" }).Exists } else { $null }
            Support_SupportRecord_DailyRows_Count  = if ($listName -eq "SupportRecord_Daily") { ($r.AuxiliaryChildLists | Where-Object { $_.ListName -eq "SupportRecord_DailyRows" }).ItemCount } else { $null }
            DailyAct_DateMin        = if ($listName -eq "DailyActivityRecords") { $r.DateRange.Min } else { $null }
            DailyAct_DateMax        = if ($listName -eq "DailyActivityRecords") { $r.DateRange.Max } else { $null }
            DailyAct_MissingUser    = if ($listName -eq "DailyActivityRecords") { $r.MissingUserKeyCount } else { $null }
            DailyAct_Orphans        = if ($listName -eq "DailyActivityRecords") { $r.OrphanCandidateCount } else { $null }
        }
    }
    $csvPath = Join-Path $OutputDir "CURRENT-DATA-LIVE-MEASURE-V1.csv"
    $csvRows | Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8
    Write-Ok "Summary CSV written: $csvPath"
}

Write-Host ""
Write-Host "=== Live measurement complete (READ ONLY) ===" -ForegroundColor Green
