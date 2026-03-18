<#
.SYNOPSIS
    SharePoint List Provisioning Script - creates missing lists/fields/indexes/unique constraints

.DESCRIPTION
    Reads lists.manifest.json and creates only elements that do not exist in SP.
    Does NOT modify existing fields (no type change, no Choice removal, no Lookup change).

    Operations:
      [YES] Create missing List
      [YES] Add missing Field
      [YES] Add missing Index
      [YES] Set missing Unique constraint
      [NO]  Change FieldType (manual action required)
      [NO]  Change Required flag (manual action required)
      [NO]  Remove Choice values (manual action required)

.PARAMETER SiteUrl
    Target SharePoint site URL

.PARAMETER ManifestPath
    Path to lists.manifest.json

.PARAMETER UseWebLogin
    Browser-based login using legacy web login (no App Registration required).
    Recommended for personal tenants.

.PARAMETER InteractiveLogin
    Use PnP Interactive login (requires Entra ID App Registration with -ClientId).

.PARAMETER ClientId
    Entra ID App Registration Client ID (required when using -InteractiveLogin).

.PARAMETER Credential
    PSCredential for service account login

.PARAMETER WhatIfMode
    Dry run - shows what would be done without making any changes

.EXAMPLE
    # dry run (no App Registration needed)
    .\provision-missing-lists.ps1 `
        -SiteUrl "https://tenant.sharepoint.com/sites/mysite" `
        -ManifestPath ".\scripts\sp-preprod\lists.manifest.json" `
        -UseWebLogin `
        -WhatIfMode

    # actual run
    .\provision-missing-lists.ps1 `
        -SiteUrl "https://tenant.sharepoint.com/sites/mysite" `
        -ManifestPath ".\scripts\sp-preprod\lists.manifest.json" `
        -UseWebLogin
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)]
    [string]$SiteUrl,

    [Parameter(Mandatory)]
    [string]$ManifestPath,

    [switch]$DeviceLogin,

    [string]$ClientId,

    [PSCredential]$Credential,

    [switch]$WhatIfMode
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Helpers
function Write-Step([string]$msg) { Write-Host ">> $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Dry([string]$msg)  { Write-Host "  [DRY] $msg" -ForegroundColor Yellow }
function Write-Act([string]$msg)  { Write-Host "  [ACT] $msg" -ForegroundColor Magenta }
function Write-Skip([string]$msg) { Write-Host "  [SKIP] $msg" -ForegroundColor Gray }

$actionLog = [System.Collections.Generic.List[PSCustomObject]]::new()

function Log-Action([string]$list, [string]$action, [string]$target, [string]$status, [string]$detail = '') {
    $actionLog.Add([PSCustomObject]@{
        ListTitle = $list
        Action    = $action
        Target    = $target
        Status    = $status
        Detail    = $detail
    })
}

function Get-FieldType([string]$manifestType) {
    switch ($manifestType) {
        'Text'     { return 'Text' }
        'Note'     { return 'Note' }
        'Number'   { return 'Number' }
        'Boolean'  { return 'Boolean' }
        'DateTime' { return 'DateTime' }
        'Choice'   { return 'Choice' }
        'Lookup'   { return 'Lookup' }
        'URL'      { return 'URL' }
        default    { return 'Text' }
    }
}

# Check PnP.PowerShell
Write-Step "Checking PnP.PowerShell..."
if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
    Write-Error "PnP.PowerShell is not installed. Run: Install-Module PnP.PowerShell -Scope CurrentUser"
    exit 1
}
Import-Module PnP.PowerShell -ErrorAction Stop

if ($WhatIfMode) {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Yellow
    Write-Host "  DRY RUN MODE - no changes will be made  " -ForegroundColor Yellow
    Write-Host "============================================" -ForegroundColor Yellow
    Write-Host ""
}

# PnP Management Shell official multi-tenant ClientId (no app registration required)
$PNP_MANAGEMENT_SHELL_CLIENTID = '31359c7f-bd7e-475c-86db-fdb8c937548e'
$resolvedClientId = if ($ClientId) { $ClientId } else { $PNP_MANAGEMENT_SHELL_CLIENTID }

# Connect
Write-Step "Connecting to SharePoint: $SiteUrl"
if ($DeviceLogin) {
    Connect-PnPOnline -Url $SiteUrl -DeviceLogin -ClientId $resolvedClientId
} elseif ($Credential) {
    Connect-PnPOnline -Url $SiteUrl -Credentials $Credential
} else {
    # Default: Interactive browser login via PnP Management Shell
    Connect-PnPOnline -Url $SiteUrl -Interactive -ClientId $resolvedClientId
}
Write-Ok "Connected"

# Load manifest
Write-Step "Loading manifest: $ManifestPath"
if (-not (Test-Path $ManifestPath)) {
    Write-Error "Manifest not found: $ManifestPath"
    exit 1
}
$manifest = Get-Content $ManifestPath -Encoding UTF8 | ConvertFrom-Json
Write-Ok "Manifest loaded ($($manifest.lists.Count) lists)"

# Get SP list cache
Write-Step "Fetching SP list inventory..."
$spLists = Get-PnPList | Where-Object { -not $_.Hidden } | Group-Object Title -AsHashTable -AsString

# Provisioning loop
foreach ($listDef in $manifest.lists) {
    $listTitle = $listDef.listTitle
    Write-Step "Processing [$listTitle]..."

    # 1. Create list if missing
    if (-not $spLists.ContainsKey($listTitle)) {
        if ($WhatIfMode) {
            Write-Dry "Would create list: $listTitle"
            Log-Action $listTitle 'Create List' $listTitle 'DRY_RUN' $listDef.description
        } else {
            Write-Act "Creating list: $listTitle"
            $null = New-PnPList -Title $listTitle -Template GenericList -OnQuickLaunch
            Write-Ok "List created: $listTitle"
            Log-Action $listTitle 'Create List' $listTitle 'DONE' $listDef.description
            $spLists[$listTitle] = Get-PnPList -Identity $listTitle
        }
    } else {
        Write-Skip "List already exists: $listTitle"
        Log-Action $listTitle 'Create List' $listTitle 'SKIPPED' 'already exists'
    }

    # 2. Add missing fields
    if ($listDef.requiredFields -and $listDef.requiredFields.Count -gt 0) {
        $spFields = Get-PnPField -List $listTitle | Group-Object InternalName -AsHashTable -AsString

        foreach ($fieldDef in $listDef.requiredFields) {
            $internalName = $fieldDef.internalName

            if ($internalName -in @('Id', 'Title', 'Created', 'Modified', 'Author', 'Editor')) {
                continue
            }

            if ($spFields.ContainsKey($internalName)) {
                Write-Skip "Field already exists: $internalName"
                continue
            }

            $pnpType = Get-FieldType $fieldDef.type

            if ($WhatIfMode) {
                Write-Dry "Would add field: $internalName ($pnpType)"
                Log-Action $listTitle 'Add Field' $internalName 'DRY_RUN' "type=$pnpType"
            } else {
                Write-Act "Adding field: $internalName ($pnpType)"
                try {
                    if ($pnpType -eq 'Choice' -and $fieldDef.choices) {
                        $choiceXml = ($fieldDef.choices | ForEach-Object { "<CHOICE>$_</CHOICE>" }) -join ''
                        $req = if ($fieldDef.required) { 'TRUE' } else { 'FALSE' }
                        $xmlSchema = "<Field Type='Choice' DisplayName='$internalName' Name='$internalName' StaticName='$internalName' Required='$req'><CHOICES>$choiceXml</CHOICES></Field>"
                        Add-PnPFieldFromXml -List $listTitle -FieldXml $xmlSchema | Out-Null
                    } else {
                        Add-PnPField -List $listTitle `
                            -InternalName $internalName `
                            -DisplayName $internalName `
                            -Type $pnpType `
                            -Required:($fieldDef.required -eq $true) | Out-Null
                    }
                    Write-Ok "Field added: $internalName"
                    Log-Action $listTitle 'Add Field' $internalName 'DONE' "type=$pnpType"
                } catch {
                    Write-Warning "Failed to add field: $internalName - $($_.Exception.Message)"
                    Log-Action $listTitle 'Add Field' $internalName 'ERROR' $_.Exception.Message
                }
            }
        }
    }

    # 3. Add indexes and unique constraints
    if ($listDef.indexes -and $listDef.indexes.Count -gt 0) {
        $spFields = Get-PnPField -List $listTitle | Group-Object InternalName -AsHashTable -AsString

        foreach ($idxDef in $listDef.indexes) {
            $idxField = $idxDef.field

            if (-not $spFields.ContainsKey($idxField)) {
                Write-Warning "Index target field not found, skipping: $idxField"
                Log-Action $listTitle 'Add Index' $idxField 'SKIPPED' 'field not found'
                continue
            }

            $spField = $spFields[$idxField]

            # Index
            if ($spField.Indexed -ne $true) {
                if ($WhatIfMode) {
                    Write-Dry "Would add index: $idxField"
                    Log-Action $listTitle 'Add Index' $idxField 'DRY_RUN' ''
                } else {
                    Write-Act "Adding index: $idxField"
                    try {
                        Set-PnPField -List $listTitle -Identity $idxField -Values @{ Indexed = $true }
                        Write-Ok "Index added: $idxField"
                        Log-Action $listTitle 'Add Index' $idxField 'DONE' ''
                    } catch {
                        Write-Warning "Failed to add index: $idxField - $($_.Exception.Message)"
                        Log-Action $listTitle 'Add Index' $idxField 'ERROR' $_.Exception.Message
                    }
                }
            } else {
                Write-Skip "Index already exists: $idxField"
            }

            # Unique constraint
            if ($idxDef.unique -eq $true -and $spField.EnforceUniqueValues -ne $true) {
                if ($WhatIfMode) {
                    Write-Dry "Would set unique constraint: $idxField"
                    Log-Action $listTitle 'Set Unique' $idxField 'DRY_RUN' ''
                } else {
                    Write-Act "Setting unique constraint: $idxField"
                    try {
                        Set-PnPField -List $listTitle -Identity $idxField -Values @{
                            Indexed             = $true
                            EnforceUniqueValues = $true
                        }
                        Write-Ok "Unique constraint set: $idxField"
                        Log-Action $listTitle 'Set Unique' $idxField 'DONE' ''
                    } catch {
                        Write-Warning "Failed to set unique constraint: $idxField - $($_.Exception.Message) (check for duplicate values first)"
                        Log-Action $listTitle 'Set Unique' $idxField 'ERROR' $_.Exception.Message
                    }
                }
            }
        }
    }

    Write-Ok "[$listTitle] done"
}

# Export log
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$mode      = if ($WhatIfMode) { 'dryrun' } else { 'actual' }
$logPath   = Join-Path (Split-Path $ManifestPath) "provision-log_${mode}_${timestamp}.csv"
$actionLog | Export-Csv -Path $logPath -Encoding UTF8 -NoTypeInformation

# Final summary
$doneCount  = ($actionLog | Where-Object { $_.Status -eq 'DONE' }).Count
$dryCount   = ($actionLog | Where-Object { $_.Status -eq 'DRY_RUN' }).Count
$skipCount  = ($actionLog | Where-Object { $_.Status -eq 'SKIPPED' }).Count
$errorCount = ($actionLog | Where-Object { $_.Status -eq 'ERROR' }).Count

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host " PROVISIONING COMPLETE$(if ($WhatIfMode) { ' [DRY RUN]' })" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Done    : $doneCount"  -ForegroundColor Green
if ($WhatIfMode) {
    Write-Host "  Planned : $dryCount" -ForegroundColor Yellow
}
Write-Host "  Skipped : $skipCount"  -ForegroundColor Gray
Write-Host "  Errors  : $errorCount" -ForegroundColor $(if ($errorCount -gt 0) { 'Red' } else { 'Green' })
Write-Host "------------------------------------------------" -ForegroundColor Cyan
Write-Host "  Log: $logPath"
if (-not $WhatIfMode) {
    Write-Host ""
    Write-Host "  Re-run the audit to verify all gaps are resolved." -ForegroundColor Yellow
}
Write-Host "================================================" -ForegroundColor Cyan

Disconnect-PnPOnline
