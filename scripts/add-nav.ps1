[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SiteUrl,
    [Parameter(Mandatory = $true)]
    [string]$TenantId,
    [Parameter(Mandatory = $true)]
    [string]$ClientId,
    [string]$ClientSecret,
    [string]$CertificatePath,
    [object]$CertificatePassword,
    [switch]$AddTopNav
)

$ErrorActionPreference = 'Stop'

function Connect-SharePoint {
    param(
        [string]$SiteUrl,
        [string]$TenantId,
        [string]$ClientId,
        [string]$ClientSecret,
        [string]$CertificatePath,
        [object]$CertificatePassword
    )

    if ([string]::IsNullOrWhiteSpace($SiteUrl)) {
        throw 'SiteUrl is required'
    }

    if ((Test-Path $CertificatePath) -and $CertificatePassword) {
        $secureCert = if ($CertificatePassword -is [System.Security.SecureString]) {
            $CertificatePassword
        } else {
            ConvertTo-SecureString $CertificatePassword -AsPlainText -Force
        }
        Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Tenant $TenantId -CertificatePath $CertificatePath -CertificatePassword $secureCert
        return
    }

    if ($ClientSecret) {
        $secure = ConvertTo-SecureString $ClientSecret -AsPlainText -Force
        Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Tenant $TenantId -ClientSecret $secure
        return
    }

    throw 'Provide either certificate credentials or ClientSecret to connect.'
}

function Set-NavigationNodes {
    param(
        [ValidateSet('QuickLaunch', 'TopNavigationBar')]
        [string]$Location,
        [array]$Nodes
    )

    if (-not $Nodes -or $Nodes.Count -eq 0) {
        Write-Host "No nodes to process for $Location"
        return
    }

    $existing = @(Get-PnPNavigationNode -Location $Location -Tree | ForEach-Object { $_ })

    foreach ($node in $Nodes) {
        $title = $node.Title
        $url = $node.Url
        $current = $existing | Where-Object { $_.Title -eq $title }

        if ($current) {
            if ($current.Url -eq $url) {
                Write-Host "[NAV:$Location] Skip (already up-to-date): $title -> $url"
                continue
            }

            Write-Host "[NAV:$Location] Update: $title -> $url"
            Remove-PnPNavigationNode -Identity $current.Id -Force -Confirm:$false | Out-Null
            Add-PnPNavigationNode -Title $title -Url $url -Location $Location | Out-Null
            continue
        }

        Write-Host "[NAV:$Location] Add: $title -> $url"
        Add-PnPNavigationNode -Title $title -Url $url -Location $Location | Out-Null
    }
}

Import-Module PnP.PowerShell -ErrorAction Stop
Connect-SharePoint -SiteUrl $SiteUrl -TenantId $TenantId -ClientId $ClientId -ClientSecret $ClientSecret -CertificatePath $CertificatePath -CertificatePassword $CertificatePassword

$web = Get-PnPWeb
$serverRelative = $web.ServerRelativeUrl
if (-not $serverRelative) { $serverRelative = '/' }
$serverRelative = $serverRelative.TrimEnd('/')
if ($serverRelative.Length -eq 0) { $serverRelative = '/' }

function Get-ServerRelativeUrl {
    param(
        [string]$Base,
        [string]$Path
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        throw 'Navigation path cannot be empty.'
    }

    if ($Path.StartsWith('http')) {
        return $Path
    }

    $clean = $Path.TrimStart('/')
    if ($Base -eq '/') {
        return "/$clean"
    }

    return "$Base/$clean"
}

$quickLaunchNodes = @(
    @{ Title = '日次記録'; Url = Get-ServerRelativeUrl -Base $serverRelative -Path 'Lists/SupportRecord_Daily/AllItems.aspx' },
    @{ Title = '監査ログ'; Url = Get-ServerRelativeUrl -Base $serverRelative -Path 'Lists/Audit_Events/AllItems.aspx' }
)

try {
    Get-PnPList -Identity 'Compliance_Checklist' -ErrorAction Stop | Out-Null
    $quickLaunchNodes += @{ Title = '自己点検'; Url = Get-ServerRelativeUrl -Base $serverRelative -Path 'Lists/Compliance_Checklist/AllItems.aspx' }
} catch {
    Write-Host '[NAV] Skipping Compliance_Checklist (list not found).'
}

Set-NavigationNodes -Location 'QuickLaunch' -Nodes $quickLaunchNodes

if ($AddTopNav.IsPresent) {
    Set-NavigationNodes -Location 'TopNavigationBar' -Nodes $quickLaunchNodes
} else {
    Write-Host '[NAV] Skipping TopNavigationBar update (flag not set).'
}

