#requires -Version 7.0
<#
.SYNOPSIS
    LIVE-SCHEMA-GATE-V1 read-only PnP inventory (GET / Get-PnPField only).

.DESCRIPTION
    Reads SupportRecord_Daily and DailyRecordRows field metadata:
    InternalName, TypeAsString, Indexed, EnforceUniqueValues.

    This script MUST NOT call Add-PnPField, Set-PnPField, New-PnPList,
    Remove-PnPField, or any HTTP method other than GET.

.EXAMPLE
    .\scripts\ops\live-schema-gate-inventory.ps1 -SiteUrl "https://isogokatudouhome.sharepoint.com/sites/welfare" -UseWebLogin
#>
[CmdletBinding()]
param(
    [string]$SiteUrl = 'https://isogokatudouhome.sharepoint.com/sites/welfare',
    [string]$OutPath = (Join-Path $PSScriptRoot '..' '..' 'docs' 'evidence' 'live-schema-gate-v1' 'captures' 'LIVE_SCHEMA_INVENTORY.raw.json'),
    [switch]$UseWebLogin,
    [switch]$DeviceLogin,
    [string]$ClientId = '31359c7f-bd7e-475c-86db-fdb8c937548e'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$forbidden = @(
    'Add-PnPField', 'Set-PnPField', 'Remove-PnPField', 'Add-PnPFieldFromXml',
    'New-PnPList', 'Remove-PnPList', 'Set-PnPList',
    'Add-PnPListItem', 'Set-PnPListItem', 'Remove-PnPListItem'
)
foreach ($name in $forbidden) {
    Set-Item -Path "function:$name" -Value {
        throw "[LIVE-SCHEMA-GATE-V1] Refusing mutating command. This inventory is GET-only."
    } -Force
}

function Write-Step([string]$msg) { Write-Host ">> $msg" -ForegroundColor Cyan }

if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
    throw 'PnP.PowerShell is not installed. Install-Module PnP.PowerShell -Scope CurrentUser'
}
Import-Module PnP.PowerShell -ErrorAction Stop

Write-Step "Connecting (read) $SiteUrl"
$connectParams = @{ Url = $SiteUrl; ClientId = $ClientId }
if ($DeviceLogin) { $connectParams.DeviceLogin = $true }
elseif ($UseWebLogin) { $connectParams.UseWebLogin = $true }
else { $connectParams.Interactive = $true }
Connect-PnPOnline @connectParams

$titles = @('SupportRecord_Daily', 'DailyRecordRows')
$lists = [ordered]@{}

foreach ($title in $titles) {
    Write-Step "Get-PnPField -List $title"
    try {
        $list = Get-PnPList -Identity $title -ErrorAction Stop
        $fields = Get-PnPField -List $title | ForEach-Object {
            [pscustomobject]@{
                InternalName         = $_.InternalName
                Title                = $_.Title
                TypeAsString         = $_.TypeAsString
                Indexed              = [bool]$_.Indexed
                EnforceUniqueValues  = [bool]$_.EnforceUniqueValues
                Hidden               = [bool]$_.Hidden
                ReadOnlyField        = [bool]$_.ReadOnlyField
            }
        }
        $lists[$title] = @{
            found                     = $true
            uniqueConstraintReadable  = $true
            error                     = $null
            listId                    = [string]$list.Id
            fields                    = @($fields)
        }
    } catch {
        $message = $_.Exception.Message
        $missing = $message -match 'does not exist|404|not found'
        $lists[$title] = @{
            found                     = if ($missing) { $false } else { $null }
            uniqueConstraintReadable  = $true
            error                     = $message
            fields                    = if ($missing) { @() } else { $null }
        }
    }
}

$dump = [ordered]@{
    schemaVersion = 1
    id            = 'LIVE-SCHEMA-GATE-V1'
    mode          = 'pnp'
    siteUrl       = $SiteUrl
    httpMethods   = @('GET')
    mutation      = $false
    deploy        = 'NOT_AUTHORIZED'
    generatedAt   = (Get-Date).ToUniversalTime().ToString('o')
    lists         = $lists
}

$outFull = [System.IO.Path]::GetFullPath($OutPath)
$dir = Split-Path -Parent $outFull
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
$dump | ConvertTo-Json -Depth 8 | Set-Content -Path $outFull -Encoding utf8
Write-Host "[OK] Raw dump: $outFull" -ForegroundColor Green

$classify = Join-Path $PSScriptRoot 'live-schema-gate-inventory.mjs'
if (Get-Command node -ErrorAction SilentlyContinue) {
    $classified = [System.IO.Path]::ChangeExtension($outFull, '.classified.json')
    & node $classify --mode file --input $outFull --out $classified
} else {
    Write-Host '[WARN] node not found; classify later with live-schema-gate-inventory.mjs --mode file' -ForegroundColor Yellow
}

Disconnect-PnPOnline | Out-Null
