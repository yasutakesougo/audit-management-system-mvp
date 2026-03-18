<#
.SYNOPSIS
    SharePoint List Audit Script - compares manifest with SP site and outputs diff

.PARAMETER SiteUrl
    Target SharePoint site URL

.PARAMETER ManifestPath
    Path to lists.manifest.json

.PARAMETER OutputDir
    Output directory for audit results (created if not exists)

.PARAMETER UseWebLogin
    Browser-based login using legacy web login (no App Registration required).
    Recommended for personal tenants or when no Entra ID app is registered.

.PARAMETER InteractiveLogin
    Use PnP Interactive login (requires Entra ID App Registration with -ClientId).

.PARAMETER ClientId
    Entra ID App Registration Client ID (required when using -InteractiveLogin).

.PARAMETER Credential
    PSCredential for service account login

.EXAMPLE
    # Simplest: no App Registration needed
    .\audit-sharepoint-lists.ps1 `
        -SiteUrl "https://tenant.sharepoint.com/sites/mysite" `
        -ManifestPath ".\scripts\sp-preprod\lists.manifest.json" `
        -OutputDir ".\out\sp-audit" `
        -UseWebLogin

    # With App Registration
    .\audit-sharepoint-lists.ps1 `
        -SiteUrl "https://tenant.sharepoint.com/sites/mysite" `
        -ManifestPath ".\scripts\sp-preprod\lists.manifest.json" `
        -OutputDir ".\out\sp-audit" `
        -InteractiveLogin -ClientId "your-client-id"
#>


[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$SiteUrl,

    [Parameter(Mandatory)]
    [string]$ManifestPath,

    [Parameter(Mandatory)]
    [string]$OutputDir,

    # Use PnP Management Shell (no app registration required) - DEFAULT
    [switch]$InteractiveLogin,

    # Use device code flow (for environments where browser cannot open)
    [switch]$DeviceLogin,

    # Custom Entra ID App ClientId (optional - defaults to PnP Management Shell)
    [string]$ClientId,

    [PSCredential]$Credential
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# PnP Management Shell official multi-tenant ClientId (no app registration required)
$PNP_MANAGEMENT_SHELL_CLIENTID = '31359c7f-bd7e-475c-86db-fdb8c937548e'
# Helpers
function Write-Step([string]$msg) { Write-Host ">> $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn([string]$msg) { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Miss([string]$msg) { Write-Host "  [MISSING] $msg" -ForegroundColor Red }

# Check PnP.PowerShell
Write-Step "Checking PnP.PowerShell..."
if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
    Write-Error "PnP.PowerShell is not installed. Run: Install-Module PnP.PowerShell -Scope CurrentUser"
    exit 1
}
Import-Module PnP.PowerShell -ErrorAction Stop

# Resolve ClientId (fall back to PnP Management Shell)
$resolvedClientId = if ($ClientId) { $ClientId } else { $PNP_MANAGEMENT_SHELL_CLIENTID }

# Connect
Write-Step "Connecting to SharePoint: $SiteUrl"
if ($DeviceLogin) {
    # Device code flow - browser not required, opens code in terminal
    Connect-PnPOnline -Url $SiteUrl -DeviceLogin -ClientId $resolvedClientId
} elseif ($Credential) {
    Connect-PnPOnline -Url $SiteUrl -Credentials $Credential
} else {
    # Default: Interactive browser login via PnP Management Shell (no app registration needed)
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

# Prepare output dir
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$csvPath   = Join-Path $OutputDir "sp-list-audit-results_$timestamp.csv"
$mdPath    = Join-Path $OutputDir "sp-list-audit-report_$timestamp.md"
$latestCsv = Join-Path $OutputDir "sp-list-audit-results.csv"
$latestMd  = Join-Path $OutputDir "sp-list-audit-report.md"

$results = [System.Collections.Generic.List[PSCustomObject]]::new()

# Get SP lists (cached)
Write-Step "Fetching SP list inventory..."
$spLists = Get-PnPList | Where-Object { -not $_.Hidden } | Group-Object Title -AsHashTable -AsString
Write-Ok "SP lists fetched ($($spLists.Count) lists)"

# Audit loop
foreach ($listDef in $manifest.lists) {
    $listTitle = $listDef.listTitle
    Write-Step "Auditing [$listTitle]..."

    # 1. List existence
    if (-not $spLists.ContainsKey($listTitle)) {
        Write-Miss "List not found: $listTitle"
        $results.Add([PSCustomObject]@{
            ListTitle   = $listTitle
            Category    = 'Missing'
            SubCategory = 'List'
            FieldName   = ''
            Expected    = $listTitle
            Actual      = '(not found)'
            Message     = "List '$listTitle' does not exist in SP"
        })
        continue
    }

    Write-Ok "List exists: $listTitle"

    # 2. Field inventory
    $spFields = Get-PnPField -List $listTitle | Group-Object InternalName -AsHashTable -AsString

    # 3. Field audit
    foreach ($fieldDef in $listDef.requiredFields) {
        $internalName = $fieldDef.internalName

        # Skip SP built-in fields
        if ($internalName -in @('Id', 'Title', 'Created', 'Modified', 'Author', 'Editor')) {
            continue
        }

        if (-not $spFields.ContainsKey($internalName)) {
            Write-Miss "Field missing: $internalName"
            $results.Add([PSCustomObject]@{
                ListTitle   = $listTitle
                Category    = 'Missing'
                SubCategory = 'Field'
                FieldName   = $internalName
                Expected    = $fieldDef.type
                Actual      = '(not found)'
                Message     = "Field '$internalName' missing (expected type: $($fieldDef.type))"
            })
            continue
        }

        $spField = $spFields[$internalName]

        # Type check (loose match)
        $spTypeName   = $spField.TypeAsString
        $expectedType = $fieldDef.type
        $typeOk = switch ($expectedType) {
            'Text'     { $spTypeName -in @('Text', 'Choice', 'Computed') }
            'Note'     { $spTypeName -eq 'Note' }
            'Number'   { $spTypeName -eq 'Number' }
            'Boolean'  { $spTypeName -eq 'Boolean' }
            'DateTime' { $spTypeName -eq 'DateTime' }
            'Choice'   { $spTypeName -in @('Choice', 'MultiChoice') }
            'Lookup'   { $spTypeName -in @('Lookup', 'LookupMulti') }
            'URL'      { $spTypeName -eq 'URL' }
            default    { $true }
        }

        if (-not $typeOk) {
            Write-Warn "Type mismatch: $internalName (expected: $expectedType / actual: $spTypeName)"
            $results.Add([PSCustomObject]@{
                ListTitle   = $listTitle
                Category    = 'Mismatch'
                SubCategory = 'FieldType'
                FieldName   = $internalName
                Expected    = $expectedType
                Actual      = $spTypeName
                Message     = "Field type mismatch: expected=$expectedType, actual=$spTypeName"
            })
        } else {
            $results.Add([PSCustomObject]@{
                ListTitle   = $listTitle
                Category    = 'OK'
                SubCategory = 'Field'
                FieldName   = $internalName
                Expected    = $expectedType
                Actual      = $spTypeName
                Message     = 'OK'
            })
        }

        # Required check
        if ($fieldDef.required -eq $true -and $spField.Required -ne $true) {
            Write-Warn "Required mismatch: $internalName"
            $results.Add([PSCustomObject]@{
                ListTitle   = $listTitle
                Category    = 'Mismatch'
                SubCategory = 'Required'
                FieldName   = $internalName
                Expected    = 'true'
                Actual      = $spField.Required.ToString()
                Message     = "Required flag mismatch: manifest=true, SP=$($spField.Required)"
            })
        }
    }

    # 4. Index / Unique audit
    if ($listDef.indexes -and $listDef.indexes.Count -gt 0) {
        $spIndexedFields = $spFields.Values |
            Where-Object { $_.Indexed -eq $true } |
            Select-Object -ExpandProperty InternalName

        foreach ($idxDef in $listDef.indexes) {
            $idxField = $idxDef.field

            if ($idxField -notin $spIndexedFields) {
                Write-Warn "Index missing: $idxField"
                $results.Add([PSCustomObject]@{
                    ListTitle   = $listTitle
                    Category    = 'Mismatch'
                    SubCategory = 'Indexed'
                    FieldName   = $idxField
                    Expected    = 'Indexed'
                    Actual      = 'Not Indexed'
                    Message     = "Field '$idxField' has no index"
                })
            } else {
                Write-Ok "Index OK: $idxField"
                $results.Add([PSCustomObject]@{
                    ListTitle   = $listTitle
                    Category    = 'OK'
                    SubCategory = 'Indexed'
                    FieldName   = $idxField
                    Expected    = 'Indexed'
                    Actual      = 'Indexed'
                    Message     = 'OK'
                })
            }

            # Unique constraint
            if ($idxDef.unique -eq $true) {
                $spFieldObj = $spFields[$idxField]
                if ($spFieldObj -and $spFieldObj.EnforceUniqueValues -ne $true) {
                    Write-Warn "Unique constraint missing: $idxField"
                    $results.Add([PSCustomObject]@{
                        ListTitle   = $listTitle
                        Category    = 'Mismatch'
                        SubCategory = 'Unique'
                        FieldName   = $idxField
                        Expected    = 'Unique=true'
                        Actual      = 'Unique=false'
                        Message     = "Field '$idxField' has no unique constraint"
                    })
                } else {
                    $results.Add([PSCustomObject]@{
                        ListTitle   = $listTitle
                        Category    = 'OK'
                        SubCategory = 'Unique'
                        FieldName   = $idxField
                        Expected    = 'Unique=true'
                        Actual      = 'Unique=true'
                        Message     = 'OK'
                    })
                }
            }
        }
    }

    Write-Ok "[$listTitle] audit complete"
}

# Export CSV
Write-Step "Exporting CSV: $csvPath"
$results | Export-Csv -Path $csvPath -Encoding UTF8 -NoTypeInformation
Copy-Item $csvPath $latestCsv -Force
Write-Ok "CSV exported"

# Build Markdown report
Write-Step "Building Markdown report: $mdPath"
$now          = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$missing      = $results | Where-Object { $_.Category -eq 'Missing' }
$mismatches   = $results | Where-Object { $_.Category -eq 'Mismatch' }
$oks          = $results | Where-Object { $_.Category -eq 'OK' }
$missingList  = $missing    | Where-Object { $_.SubCategory -eq 'List' }
$missingField = $missing    | Where-Object { $_.SubCategory -eq 'Field' }
$mismatchType = $mismatches | Where-Object { $_.SubCategory -eq 'FieldType' }
$mismatchReq  = $mismatches | Where-Object { $_.SubCategory -eq 'Required' }
$mismatchIdx  = $mismatches | Where-Object { $_.SubCategory -eq 'Indexed' }
$mismatchUniq = $mismatches | Where-Object { $_.SubCategory -eq 'Unique' }

$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add("# SP List Audit Report")
$lines.Add("")
$lines.Add("- **Date**: $now")
$lines.Add("- **Site**: $SiteUrl")
$lines.Add("- **Manifest**: $ManifestPath")
$lines.Add("- **Lists in manifest**: $($manifest.lists.Count)")
$lines.Add("")
$lines.Add("---")
$lines.Add("")
$lines.Add("## Summary")
$lines.Add("")
$lines.Add("| Category | Count | Action |")
$lines.Add("|---|---|---|")
$lines.Add("| Missing / List | $($missingList.Count) | provision candidate |")
$lines.Add("| Missing / Field | $($missingField.Count) | provision candidate |")
$lines.Add("| Mismatch / Indexed | $($mismatchIdx.Count) | provision candidate |")
$lines.Add("| Mismatch / Unique | $($mismatchUniq.Count) | provision candidate |")
$lines.Add("| Mismatch / FieldType | $($mismatchType.Count) | **manual review** |")
$lines.Add("| Mismatch / Required | $($mismatchReq.Count) | **manual review** |")
$lines.Add("| OK | $($oks.Count) | - |")
$lines.Add("")
$lines.Add("---")
$lines.Add("")

# Missing / List
$lines.Add("## Missing / List (provision candidate)")
$lines.Add("")
if ($missingList.Count -eq 0) {
    $lines.Add("> **None** - all lists exist in SP")
} else {
    $lines.Add("| List | Message |")
    $lines.Add("|---|---|")
    foreach ($r in $missingList) { $lines.Add("| ``$($r.ListTitle)`` | $($r.Message) |") }
}
$lines.Add("")

# Missing / Field
$lines.Add("## Missing / Field (provision candidate)")
$lines.Add("")
if ($missingField.Count -eq 0) {
    $lines.Add("> **None**")
} else {
    $lines.Add("| List | Field | Expected Type | Message |")
    $lines.Add("|---|---|---|---|")
    foreach ($r in $missingField) { $lines.Add("| ``$($r.ListTitle)`` | ``$($r.FieldName)`` | $($r.Expected) | $($r.Message) |") }
}
$lines.Add("")

# Mismatch / Indexed
$lines.Add("## Mismatch / Indexed (provision candidate)")
$lines.Add("")
if ($mismatchIdx.Count -eq 0) {
    $lines.Add("> **None**")
} else {
    $lines.Add("| List | Field | Message |")
    $lines.Add("|---|---|---|")
    foreach ($r in $mismatchIdx) { $lines.Add("| ``$($r.ListTitle)`` | ``$($r.FieldName)`` | $($r.Message) |") }
}
$lines.Add("")

# Mismatch / Unique
$lines.Add("## Mismatch / Unique (provision candidate)")
$lines.Add("")
if ($mismatchUniq.Count -eq 0) {
    $lines.Add("> **None**")
} else {
    $lines.Add("| List | Field | Message |")
    $lines.Add("|---|---|---|")
    foreach ($r in $mismatchUniq) { $lines.Add("| ``$($r.ListTitle)`` | ``$($r.FieldName)`` | $($r.Message) |") }
}
$lines.Add("")

# Mismatch / FieldType
$lines.Add("## Mismatch / FieldType (manual review required)")
$lines.Add("")
if ($mismatchType.Count -eq 0) {
    $lines.Add("> **None**")
} else {
    $lines.Add("> Existing data/app impact - do NOT auto-fix. Review each case individually.")
    $lines.Add("")
    $lines.Add("| List | Field | Expected | Actual | Message |")
    $lines.Add("|---|---|---|---|---|")
    foreach ($r in $mismatchType) { $lines.Add("| ``$($r.ListTitle)`` | ``$($r.FieldName)`` | $($r.Expected) | $($r.Actual) | $($r.Message) |") }
}
$lines.Add("")

# Mismatch / Required
$lines.Add("## Mismatch / Required (manual review required)")
$lines.Add("")
if ($mismatchReq.Count -eq 0) {
    $lines.Add("> **None**")
} else {
    $lines.Add("| List | Field | Message |")
    $lines.Add("|---|---|---|")
    foreach ($r in $mismatchReq) { $lines.Add("| ``$($r.ListTitle)`` | ``$($r.FieldName)`` | $($r.Message) |") }
}
$lines.Add("")
$lines.Add("---")
$lines.Add("")
$lines.Add("## Next Steps")
$lines.Add("")
$lines.Add("After reviewing provision candidates, run:")
$lines.Add("")
$lines.Add('```powershell')
$lines.Add("# dry run")
$lines.Add(".\\scripts\\sp-preprod\\provision-missing-lists.ps1 ``")
$lines.Add("    -SiteUrl `"$SiteUrl`" ``")
$lines.Add("    -ManifestPath `".\\scripts\\sp-preprod\\lists.manifest.json`" ``")
$lines.Add("    -InteractiveLogin ``")
$lines.Add("    -WhatIfMode")
$lines.Add("")
$lines.Add("# actual run")
$lines.Add(".\\scripts\\sp-preprod\\provision-missing-lists.ps1 ``")
$lines.Add("    -SiteUrl `"$SiteUrl`" ``")
$lines.Add("    -ManifestPath `".\\scripts\\sp-preprod\\lists.manifest.json`" ``")
$lines.Add("    -InteractiveLogin")
$lines.Add('```')
$lines.Add("")
$lines.Add("Always re-run the audit after provisioning.")

$lines -join "`n" | Out-File -FilePath $mdPath -Encoding UTF8
Copy-Item $mdPath $latestMd -Force
Write-Ok "Markdown report exported"

# Final summary
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host " AUDIT COMPLETE" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Missing / List  : $($missingList.Count)"  -ForegroundColor $(if ($missingList.Count -gt 0)  { 'Red' }     else { 'Green' })
Write-Host "  Missing / Field : $($missingField.Count)" -ForegroundColor $(if ($missingField.Count -gt 0) { 'Red' }     else { 'Green' })
Write-Host "  Mismatch/Indexed: $($mismatchIdx.Count)"  -ForegroundColor $(if ($mismatchIdx.Count -gt 0)  { 'Yellow' }  else { 'Green' })
Write-Host "  Mismatch/Unique : $($mismatchUniq.Count)" -ForegroundColor $(if ($mismatchUniq.Count -gt 0) { 'Yellow' }  else { 'Green' })
Write-Host "  Mismatch/Type   : $($mismatchType.Count)" -ForegroundColor $(if ($mismatchType.Count -gt 0) { 'Magenta' } else { 'Green' })
Write-Host "  Mismatch/Req    : $($mismatchReq.Count)"  -ForegroundColor $(if ($mismatchReq.Count -gt 0)  { 'Magenta' } else { 'Green' })
Write-Host "  OK              : $($oks.Count)"           -ForegroundColor Green
Write-Host "------------------------------------------------" -ForegroundColor Cyan
Write-Host "  CSV : $latestCsv"
Write-Host "  MD  : $latestMd"
Write-Host "================================================" -ForegroundColor Cyan

Disconnect-PnPOnline
