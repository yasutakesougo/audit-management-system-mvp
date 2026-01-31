# DailyOpsSignals リスト作成スクリプト

# 0) モジュール確認
Write-Host "=== Checking Microsoft.Graph module ===" -ForegroundColor Green
Get-Module Microsoft.Graph -ListAvailable | Select-Object Name, Version

# 1) 既存セッションをリセット
Write-Host "`n=== Cleaning up existing session ===" -ForegroundColor Green
Disconnect-MgGraph -ErrorAction SilentlyContinue
Remove-Variable -Name tenantId -ErrorAction SilentlyContinue

# 2) Graph 接続（Sites.Manage.All で同意）
Write-Host "`n=== Connecting to Microsoft Graph ===" -ForegroundColor Green
$tenantId = "650ea331-3451-4bd8-8b5d-b88cc49e6144"
Connect-MgGraph -TenantId $tenantId -Scopes "Sites.Manage.All"

# 3) サイトID取得
Write-Host "`n=== Getting Site ID ===" -ForegroundColor Green
$site = Get-MgSite -SiteId "isogokatudouhome.sharepoint.com:/sites/app-test:"
Write-Host "site.Id: $($site.Id)"

# 4) リスト作成
Write-Host "`n=== Creating DailyOpsSignals list ===" -ForegroundColor Green
$params = @{
  displayName = "DailyOpsSignals"
  list = @{ template = "genericList" }
}

$list = New-MgSiteList -SiteId $site.Id -BodyParameter $params
Write-Host "list.Id: $($list.Id)"
Write-Host "list.DisplayName: $($list.DisplayName)"

# 5) 作成確認
Write-Host "`n=== Verifying list creation ===" -ForegroundColor Green
Get-MgSiteList -SiteId $site.Id | Where-Object { $_.DisplayName -eq "DailyOpsSignals" } | Select-Object Id, DisplayName

Write-Host "`n=== SUCCESS ===" -ForegroundColor Green
Write-Host "Next steps:"
Write-Host "1. Open SharePoint site: https://isogokatudouhome.sharepoint.com/sites/app-test"
Write-Host "2. Create columns in DailyOpsSignals list (see documentation)"
Write-Host "3. Report column internal names back"
