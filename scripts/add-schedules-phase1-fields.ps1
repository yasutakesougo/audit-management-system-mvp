# Schedules リストに Phase 1 必須フィールドを追加
# Usage: pwsh ./scripts/add-schedules-phase1-fields.ps1

$siteUrl = "https://isogokatudouhome.sharepoint.com/sites/app-test"
$listName = "Schedules"

Write-Host "接続中: $siteUrl" -ForegroundColor Cyan
Connect-PnPOnline -Url $siteUrl -DeviceLogin

Write-Host "`n=== Phase 1 必須フィールド追加: $listName ===" -ForegroundColor Green

# リスト存在確認
$list = Get-PnPList -Identity $listName -ErrorAction SilentlyContinue
if (-not $list) {
    Write-Host "❌ リスト '$listName' が見つかりません" -ForegroundColor Red
    Write-Host "まず create-schedules-list.ps1 を実行してください" -ForegroundColor Yellow
    exit 1
}

Write-Host "列作成中..." -ForegroundColor Cyan

# 1. EventDate (DateTime, required) - 開始日時
try {
    Add-PnPField -List $listName -DisplayName "EventDate" -InternalName "EventDate" -Type DateTime -AddToDefaultView -Required -ErrorAction Stop | Out-Null
    Write-Host "  ✓ EventDate (DateTime, required)" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ EventDate (既存 or エラー)" -ForegroundColor Yellow
}

# 2. EndDate (DateTime, required) - 終了日時
try {
    Add-PnPField -List $listName -DisplayName "EndDate" -InternalName "EndDate" -Type DateTime -AddToDefaultView -Required -ErrorAction Stop | Out-Null
    Write-Host "  ✓ EndDate (DateTime, required)" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ EndDate (既存 or エラー)" -ForegroundColor Yellow
}

# 3. Status (Choice) - ステータス
try {
    Add-PnPField -List $listName -DisplayName "Status" -InternalName "Status" -Type Choice -Choices @("Draft","Confirmed","Cancelled") -AddToDefaultView -ErrorAction Stop | Out-Null
    Set-PnPField -List $listName -Identity "Status" -Values @{DefaultValue="Draft"} -ErrorAction SilentlyContinue | Out-Null
    Write-Host "  ✓ Status (Choice: Draft/Confirmed/Cancelled)" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Status (既存 or エラー)" -ForegroundColor Yellow
}

# 4. ServiceType (Choice) - サービス種別
try {
    Add-PnPField -List $listName -DisplayName "ServiceType" -InternalName "ServiceType" -Type Choice -Choices @("生活介護","就労継続支援A","就労継続支援B","就労移行","その他") -AddToDefaultView -ErrorAction Stop | Out-Null
    Write-Host "  ✓ ServiceType (Choice)" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ ServiceType (既存 or エラー)" -ForegroundColor Yellow
}

# 5. cr014_personType (Choice, required) - User/Staff/Org
try {
    Add-PnPField -List $listName -DisplayName "cr014_personType" -InternalName "cr014_personType" -Type Choice -Choices @("User","Staff","Org") -AddToDefaultView -Required -ErrorAction Stop | Out-Null
    Write-Host "  ✓ cr014_personType (Choice: User/Staff/Org, required)" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ cr014_personType (既存 or エラー)" -ForegroundColor Yellow
}

# 6. cr014_personId (Text, required) - 対象者ID
try {
    Add-PnPField -List $listName -DisplayName "cr014_personId" -InternalName "cr014_personId" -Type Text -AddToDefaultView -Required -ErrorAction Stop | Out-Null
    Write-Host "  ✓ cr014_personId (Text, required)" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ cr014_personId (既存 or エラー)" -ForegroundColor Yellow
}

# 7. cr014_personName (Text) - 対象者名
try {
    Add-PnPField -List $listName -DisplayName "cr014_personName" -InternalName "cr014_personName" -Type Text -AddToDefaultView -ErrorAction Stop | Out-Null
    Write-Host "  ✓ cr014_personName (Text)" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ cr014_personName (既存 or エラー)" -ForegroundColor Yellow
}

# 8. AssignedStaffId (Text) - 担当職員ID
try {
    Add-PnPField -List $listName -DisplayName "AssignedStaffId" -InternalName "AssignedStaffId" -Type Text -AddToDefaultView -ErrorAction Stop | Out-Null
    Write-Host "  ✓ AssignedStaffId (Text)" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ AssignedStaffId (既存 or エラー)" -ForegroundColor Yellow
}

# 9. TargetUserId (Text) - 対象利用者ID
try {
    Add-PnPField -List $listName -DisplayName "TargetUserId" -InternalName "TargetUserId" -Type Text -AddToDefaultView -ErrorAction Stop | Out-Null
    Write-Host "  ✓ TargetUserId (Text)" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ TargetUserId (既存 or エラー)" -ForegroundColor Yellow
}

# 10. RowKey (Text, required) - 内部一意キー
try {
    Add-PnPField -List $listName -DisplayName "RowKey" -InternalName "RowKey" -Type Text -AddToDefaultView -Required -ErrorAction Stop | Out-Null
    Write-Host "  ✓ RowKey (Text, required - GUID推奨)" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ RowKey (既存 or エラー)" -ForegroundColor Yellow
}

# 11. cr014_dayKey (Date, required) - 日単位キー
try {
    Add-PnPField -List $listName -DisplayName "cr014_dayKey" -InternalName "cr014_dayKey" -Type DateTime -AddToDefaultView -Required -ErrorAction Stop | Out-Null
    Write-Host "  ✓ cr014_dayKey (Date, required)" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ cr014_dayKey (既存 or エラー)" -ForegroundColor Yellow
}

# 12. MonthKey (Text, required) - 月単位キー
try {
    Add-PnPField -List $listName -DisplayName "MonthKey" -InternalName "MonthKey" -Type Text -AddToDefaultView -Required -ErrorAction Stop | Out-Null
    Write-Host "  ✓ MonthKey (Text, required - yyyy-MM 形式)" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ MonthKey (既存 or エラー)" -ForegroundColor Yellow
}

# 13. cr014_fiscalYear (Text, required) - 年度
try {
    Add-PnPField -List $listName -DisplayName "cr014_fiscalYear" -InternalName "cr014_fiscalYear" -Type Text -AddToDefaultView -Required -ErrorAction Stop | Out-Null
    Write-Host "  ✓ cr014_fiscalYear (Text, required)" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ cr014_fiscalYear (既存 or エラー)" -ForegroundColor Yellow
}

# 14. cr014_orgAudience (Text) - 対象組織
try {
    Add-PnPField -List $listName -DisplayName "cr014_orgAudience" -InternalName "cr014_orgAudience" -Type Text -AddToDefaultView -ErrorAction Stop | Out-Null
    Write-Host "  ✓ cr014_orgAudience (Text)" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ cr014_orgAudience (既存 or エラー)" -ForegroundColor Yellow
}

# 15. Note (Note - 複数行テキスト) - 備考
try {
    Add-PnPField -List $listName -DisplayName "Note" -InternalName "Note" -Type Note -AddToDefaultView -ErrorAction Stop | Out-Null
    Write-Host "  ✓ Note (Note - multiline text)" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Note (既存 or エラー)" -ForegroundColor Yellow
}

# 16. CreatedAt (DateTime) - アプリ管理用作成日時
try {
    Add-PnPField -List $listName -DisplayName "CreatedAt" -InternalName "CreatedAt" -Type DateTime -AddToDefaultView -ErrorAction Stop | Out-Null
    Write-Host "  ✓ CreatedAt (DateTime)" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ CreatedAt (既存 or エラー)" -ForegroundColor Yellow
}

# 17. UpdatedAt (DateTime) - アプリ管理用更新日時
try {
    Add-PnPField -List $listName -DisplayName "UpdatedAt" -InternalName "UpdatedAt" -Type DateTime -AddToDefaultView -ErrorAction Stop | Out-Null
    Write-Host "  ✓ UpdatedAt (DateTime)" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ UpdatedAt (既存 or エラー)" -ForegroundColor Yellow
}

Write-Host "`n=== 列一覧確認 ===" -ForegroundColor Cyan
$fields = Get-PnPField -List $listName | Where-Object { 
    $_.InternalName -in @(
        "Title","EventDate","EndDate","Status","ServiceType",
        "cr014_personType","cr014_personId","cr014_personName",
        "AssignedStaffId","TargetUserId","RowKey",
        "cr014_dayKey","MonthKey","cr014_fiscalYear","cr014_orgAudience",
        "Note","CreatedAt","UpdatedAt"
    ) 
} | Select-Object InternalName, Title, TypeAsString, Required
$fields | Format-Table -AutoSize

Write-Host "`n=== 完了 ===" -ForegroundColor Green
Write-Host "Phase 1 必須フィールドの追加が完了しました"
Write-Host "`n次のステップ:"
Write-Host "  1. Integration テスト実行:"
Write-Host "     npm run test:integration -- schedules.sp.integration.spec.ts"
Write-Host "  2. リスト動作確認:"
Write-Host "     $siteUrl/Lists/$listName"

Disconnect-PnPOnline
