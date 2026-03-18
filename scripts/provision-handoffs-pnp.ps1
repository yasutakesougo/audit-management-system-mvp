<#
.SYNOPSIS
  Handoffs リストをPnP PowerShellを使ってプロビジョニングするスクリプト

.DESCRIPTION
  Handoffs (情報共有) のリストを SharePoint サイトに作成します。
  本スクリプトは provision/schema.xml の該当部分を単独実行可能にしたものです。

.EXAMPLE
  .\scripts\provision-handoffs-pnp.ps1 -SiteUrl "https://yourtenant.sharepoint.com/sites/yoursite"
#>

[CmdletBinding()]
param (
    [Parameter(Mandatory=$true)]
    [string]$SiteUrl
)

# Connect to SharePoint
Connect-PnPOnline -Url $SiteUrl -Interactive -ClientId "0d704aa1-d263-4e76-afac-f96d92dce620"

$ListName = "Handoffs"
$ListDesc = "申し送り事項"

Write-Host "Ensuring list: $ListName" -ForegroundColor Cyan
$list = Get-PnPList -Identity $ListName -ErrorAction SilentlyContinue

if ($null -eq $list) {
    Write-Host "Creating list $ListName..."
    $list = New-PnPList -Title $ListName -Template GenericList -Url "Lists/$ListName"
    Set-PnPList -Identity $ListName -Description $ListDesc
} else {
    Write-Host "List $ListName already exists."
}

# 必要なフィールドの追加
Write-Host "Provisioning fields for $ListName..." -ForegroundColor Cyan

# Field definitions
$fields = @(
    @{ Name="cr015_recordId"; DisplayName="Record ID"; Type="Text"; Required=$true; Indexed=$true; EnforceUniqueValues=$true }
    @{ Name="cr015_userId"; DisplayName="User ID"; Type="Text"; Required=$false }
    @{ Name="cr015_targetDate"; DisplayName="対象日"; Type="Text"; Required=$true; Indexed=$true }
    @{ Name="cr015_content"; DisplayName="本文"; Type="Note"; Required=$true }
    @{ Name="cr015_priority"; DisplayName="優先度"; Type="Text"; Required=$true }
    @{ Name="cr015_status"; DisplayName="ステータス"; Type="Text"; Required=$true }
    @{ Name="cr015_reporterName"; DisplayName="記録者名"; Type="Text"; Required=$true }
    @{ Name="cr015_recordedAt"; DisplayName="記録日時"; Type="Text"; Required=$true }
)

foreach ($f in $fields) {
    $existingField = Get-PnPField -List $ListName -Identity $f.Name -ErrorAction SilentlyContinue
    if ($null -eq $existingField) {
        Write-Host "Adding field: $($f.Name) ($($f.DisplayName))"
        if ($f.Type -eq "Note") {
            Add-PnPField -List $ListName -InternalName $f.Name -DisplayName $f.DisplayName -Type Note -Required:$f.Required -AddToDefaultView | Out-Null
        } else {
            Add-PnPField -List $ListName -InternalName $f.Name -DisplayName $f.DisplayName -Type Text -Required:$f.Required -AddToDefaultView | Out-Null
        }

        # Sets Indexed and EnforceUniqueValues if specified
        if ($f.Indexed -or $f.EnforceUniqueValues) {
            $fieldRef = Get-PnPField -List $ListName -Identity $f.Name
            if ($f.Indexed) { $fieldRef.Indexed = $true }
            if ($f.EnforceUniqueValues) { $fieldRef.EnforceUniqueValues = $true }
            $fieldRef.Update()
            Invoke-PnPQuery
        }
    } else {
        Write-Host "Field already exists: $($f.Name)" -ForegroundColor DarkGray
    }
}

Write-Host "Done provisioning $ListName!" -ForegroundColor Green
