# DailyOpsSignals SharePoint リスト作成スクリプト
# Usage: pwsh ./scripts/create-dailyops-list.ps1

$siteUrl = "https://isogokatudouhome.sharepoint.com/sites/app-test"
$listName = "DailyOpsSignals"

Write-Host "接続中: $siteUrl" -ForegroundColor Cyan
Connect-PnPOnline -Url $siteUrl -Interactive

Write-Host "リスト作成: $listName" -ForegroundColor Cyan
$list = New-PnPList -Title $listName -Template GenericList -ErrorAction Stop
Write-Host "✓ リスト作成完了: $($list.Title)" -ForegroundColor Green

Write-Host "`n列作成中..." -ForegroundColor Cyan

# 1. date (DateTime - dateOnly, required)
Add-PnPField -List $listName -DisplayName "date" -InternalName "date" -Type DateTime -AddToDefaultView -Required | Out-Null
Write-Host "  ✓ date (DateTime, required)" -ForegroundColor Green

# 2. targetType (Choice)
Add-PnPField -List $listName -DisplayName "targetType" -InternalName "targetType" -Type Choice -Choices @("User","Staff","Facility","Vehicle") -AddToDefaultView | Out-Null
Write-Host "  ✓ targetType (Choice: User/Staff/Facility/Vehicle)" -ForegroundColor Green

# 3. targetId (Text, required)
Add-PnPField -List $listName -DisplayName "targetId" -InternalName "targetId" -Type Text -AddToDefaultView -Required | Out-Null
Write-Host "  ✓ targetId (Text, required)" -ForegroundColor Green

# 4. kind (Choice)
Add-PnPField -List $listName -DisplayName "kind" -InternalName "kind" -Type Choice -Choices @("EarlyLeave","Late","Absent","PickupChange","Visitor","Meeting","Other") -AddToDefaultView | Out-Null
Write-Host "  ✓ kind (Choice: 7 options)" -ForegroundColor Green

# 5. time (Text, optional)
Add-PnPField -List $listName -DisplayName "time" -InternalName "time" -Type Text -AddToDefaultView | Out-Null
Write-Host "  ✓ time (Text, optional)" -ForegroundColor Green

# 6. summary (Note - 複数行テキスト)
Add-PnPField -List $listName -DisplayName "summary" -InternalName "summary" -Type Note -AddToDefaultView | Out-Null
Write-Host "  ✓ summary (Note - 複数行テキスト)" -ForegroundColor Green

# 7. status (Choice with default=Active)
Add-PnPField -List $listName -DisplayName "status" -InternalName "status" -Type Choice -Choices @("Active","Resolved") -AddToDefaultView | Out-Null
Set-PnPField -List $listName -Identity "status" -Values @{DefaultValue="Active"} | Out-Null
Write-Host "  ✓ status (Choice: Active/Resolved, default=Active)" -ForegroundColor Green

# 8. source (Choice with default=Other)
Add-PnPField -List $listName -DisplayName "source" -InternalName "source" -Type Choice -Choices @("Phone","Note","InPerson","Other") -AddToDefaultView | Out-Null
Set-PnPField -List $listName -Identity "source" -Values @{DefaultValue="Other"} | Out-Null
Write-Host "  ✓ source (Choice: Phone/Note/InPerson/Other, default=Other)" -ForegroundColor Green

Write-Host "`n=== 作成完了 ===" -ForegroundColor Green
Write-Host "リスト名: $listName"
Write-Host "URL: $siteUrl/Lists/$listName"

# 列一覧確認
Write-Host "`n列一覧:" -ForegroundColor Cyan
$fields = Get-PnPField -List $listName | Where-Object { $_.InternalName -in @("date","targetType","targetId","kind","time","summary","status","source") } | Select-Object InternalName, Title, TypeAsString, Required, DefaultValue
$fields | Format-Table -AutoSize

Disconnect-PnPOnline
