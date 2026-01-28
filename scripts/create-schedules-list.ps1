# Schedules SharePoint リスト作成スクリプト
# Usage: pwsh ./scripts/create-schedules-list.ps1

$siteUrl = "https://isogokatudouhome.sharepoint.com/sites/app-test"
$listName = "Schedules"

Write-Host "接続中: $siteUrl" -ForegroundColor Cyan
Connect-PnPOnline -Url $siteUrl -Interactive

Write-Host "`n=== Schedules リスト作成 ===" -ForegroundColor Green

# 既存チェック
$existing = Get-PnPList -Identity $listName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "⚠ リスト '$listName' は既に存在します" -ForegroundColor Yellow
    Write-Host "フィールド追加のみ実行する場合: pwsh ./scripts/add-schedules-phase1-fields.ps1" -ForegroundColor Cyan
    exit 0
}

Write-Host "リスト作成: $listName" -ForegroundColor Cyan
$list = New-PnPList -Title $listName -Template GenericList -ErrorAction Stop
Write-Host "✓ リスト作成完了: $($list.Title)" -ForegroundColor Green

Write-Host "`n=== 完了 ===" -ForegroundColor Green
Write-Host "リスト名: $listName"
Write-Host "URL: $siteUrl/Lists/$listName"
Write-Host "`n次のステップ:"
Write-Host "  1. Phase 1 必須フィールドを追加:"
Write-Host "     pwsh ./scripts/add-schedules-phase1-fields.ps1"
Write-Host "  2. 既存データ確認:"
Write-Host "     Get-PnPListItem -List '$listName' -PageSize 10"

Disconnect-PnPOnline
