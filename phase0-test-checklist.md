# E2Eテスト実行チェックリスト

## 🎯 Phase 0: 開発環境テスト

### 前提条件チェック ✅
- [x] PnP.PowerShell 3.1.0 利用可能
- [x] 月次集計ロジック: 39テスト全通過
- [x] E2Eテスト戦略文書: 作成完了
- [ ] SharePoint サイト接続確認
- [ ] AppSettings リスト準備
- [ ] Users_Master テストデータ準備

### Phase 0 実行手順

#### Step 1: SharePoint環境確認

```powershell
# SharePoint接続テスト
Connect-PnPOnline -Url "https://yourtenant.sharepoint.com/sites/audit-management" -Interactive

# 必要なリスト存在確認
$requiredLists = @("MonthlyRecord_Summary", "SupportRecord_Daily", "AppSettings", "Users_Master")
foreach ($list in $requiredLists) {
    $listInfo = Get-PnPList -Identity $list -ErrorAction SilentlyContinue
    if ($listInfo) {
        Write-Host "✅ $list リスト存在確認" -ForegroundColor Green
    } else {
        Write-Host "❌ $list リストが見つかりません" -ForegroundColor Red
    }
}
```

#### Step 2: Phase 0 AppSettings設定

```powershell
# Phase 0 設定適用
$phase0Settings = @(
    @{ Key = "MonthlyAggregation_IsEnabled"; Value = "true" },
    @{ Key = "MonthlyAggregation_Phase"; Value = "0" },
    @{ Key = "MonthlyAggregation_MaxUsers"; Value = "5" },
    @{ Key = "MonthlyAggregation_TimeoutMinutes"; Value = "2" },
    @{ Key = "MonthlyAggregation_RetryCount"; Value = "2" },
    @{ Key = "MonthlyAggregation_TeamsWebhookUrl"; Value = "TEST_WEBHOOK_URL" },
    @{ Key = "MonthlyAggregation_AzureFunctionsUrl"; Value = "TEST_FUNCTIONS_URL" },
    @{ Key = "MonthlyAggregation_LastRunStatus"; Value = "Ready" },
    @{ Key = "MonthlyAggregation_EmergencyStop"; Value = "false" },
    @{ Key = "MonthlyAggregation_SuccessThreshold"; Value = "0.99" },
    @{ Key = "MonthlyAggregation_ProcessingTimeThreshold"; Value = "120" }
)

foreach ($setting in $phase0Settings) {
    # 既存確認
    $existing = Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>$($setting.Key)</Value></Eq></Where></Query></View>" -ErrorAction SilentlyContinue

    if ($existing) {
        Set-PnPListItem -List "AppSettings" -Identity $existing.Id -Values @{
            "Value" = $setting.Value
            "IsActive" = $true
        }
        Write-Host "🔄 更新: $($setting.Key)" -ForegroundColor Yellow
    } else {
        Add-PnPListItem -List "AppSettings" -Values @{
            "Key" = $setting.Key
            "Value" = $setting.Value
            "Description" = "Phase 0 - Development Test"
            "IsActive" = $true
        }
        Write-Host "➕ 作成: $($setting.Key)" -ForegroundColor Green
    }
}
```

#### Step 3: テストユーザー準備

```powershell
# 開発テスト用ユーザー5名設定
$testUsers = @(
    @{ UserCode = "DEV001"; UserName = "開発テスト1"; IsActive = $true; IsPilot = $false; IsPartialDeploy = $false },
    @{ UserCode = "DEV002"; UserName = "開発テスト2"; IsActive = $true; IsPilot = $false; IsPartialDeploy = $false },
    @{ UserCode = "DEV003"; UserName = "開発テスト3"; IsActive = $true; IsPilot = $false; IsPartialDeploy = $false },
    @{ UserCode = "DEV004"; UserName = "開発テスト4"; IsActive = $true; IsPilot = $false; IsPartialDeploy = $false },
    @{ UserCode = "DEV005"; UserName = "開発テスト5"; IsActive = $true; IsPilot = $false; IsPartialDeploy = $false }
)

foreach ($user in $testUsers) {
    $existing = Get-PnPListItem -List "Users_Master" -Query "<View><Query><Where><Eq><FieldRef Name='UserCode'/><Value Type='Text'>$($user.UserCode)</Value></Eq></Where></Query></View>" -ErrorAction SilentlyContinue

    if ($existing) {
        Set-PnPListItem -List "Users_Master" -Identity $existing.Id -Values $user
        Write-Host "🔄 ユーザー更新: $($user.UserCode)" -ForegroundColor Yellow
    } else {
        Add-PnPListItem -List "Users_Master" -Values $user
        Write-Host "👤 ユーザー作成: $($user.UserCode)" -ForegroundColor Green
    }
}
```

#### Step 4: テストデータ作成

```powershell
# 2024年11月のテスト用日次データ作成
$currentMonth = "2024-11"
$testDates = @("2024-11-01", "2024-11-04", "2024-11-05", "2024-11-06", "2024-11-07") # 営業日

foreach ($userCode in @("DEV001", "DEV002", "DEV003", "DEV004", "DEV005")) {
    foreach ($date in $testDates) {
        $testRecord = @{
            "Title" = "$userCode-$date"
            "UserId" = $userCode
            "RecordDate" = $date
            "Completed" = $true
            "HasSpecialNotes" = $false
            "HasIncidents" = $false
            "IsEmpty" = $false
            "Notes" = "Phase 0 テストデータ"
        }

        Add-PnPListItem -List "SupportRecord_Daily" -Values $testRecord
        Write-Host "📝 テストデータ作成: $userCode - $date" -ForegroundColor Blue
    }
}
```

### Phase 0 実行・検証手順

#### Step 5: 手動実行テスト

**Power Automate手動トリガー**
1. Power Automate ポータルにアクセス
2. 月次記録集計フローを選択
3. 「手動実行」をクリック
4. パラメータ設定:
   - `YearMonth`: "2024-11"
   - `TestMode`: true
   - `MaxUsers`: 5

#### Step 6: 結果検証

```powershell
# 実行結果確認
$results = Get-PnPListItem -List "MonthlyRecord_Summary" -Query "<View><Query><Where><Contains><FieldRef Name='YearMonth'/><Value Type='Text'>2024-11</Value></Contains></Where></Query></View>"

Write-Host "=== Phase 0 結果検証 ===" -ForegroundColor Cyan
Write-Host "処理対象ユーザー数: $($results.Count)" -ForegroundColor White
Write-Host "期待値: 5名" -ForegroundColor Gray

foreach ($result in $results) {
    $userCode = $result.FieldValues.UserCode
    $completionRate = $result.FieldValues.CompletionRate
    $totalDays = $result.FieldValues.KPI_TotalDays
    $completedRows = $result.FieldValues.KPI_CompletedRows

    Write-Host "👤 $userCode" -ForegroundColor Yellow
    Write-Host "  完了率: $completionRate%" -ForegroundColor White
    Write-Host "  総日数: $totalDays日" -ForegroundColor White
    Write-Host "  完了件数: $completedRows件" -ForegroundColor White

    # 成功基準チェック
    if ($completionRate -ge 99) {
        Write-Host "  ✅ 成功基準達成" -ForegroundColor Green
    } else {
        Write-Host "  ❌ 成功基準未達成" -ForegroundColor Red
    }
}
```

#### Step 7: KPI検証

```powershell
# KPI成功基準チェック
$successCount = 0
$totalUsers = $results.Count
$avgCompletionRate = 0

if ($totalUsers -gt 0) {
    $avgCompletionRate = ($results | ForEach-Object { $_.FieldValues.CompletionRate } | Measure-Object -Average).Average
    $successCount = ($results | Where-Object { $_.FieldValues.CompletionRate -ge 99 }).Count
}

$successRate = if ($totalUsers -gt 0) { ($successCount / $totalUsers) * 100 } else { 0 }

Write-Host "=== Phase 0 KPI サマリー ===" -ForegroundColor Cyan
Write-Host "処理成功率: $([math]::Round($successRate, 2))% (目標: 100%)" -ForegroundColor White
Write-Host "平均完了率: $([math]::Round($avgCompletionRate, 2))% (目標: ≥99%)" -ForegroundColor White
Write-Host "処理時間: [実行ログで確認] (目標: ≤2分)" -ForegroundColor White

# Phase 0成功判定
$phase0Success = ($successRate -eq 100) -and ($avgCompletionRate -ge 99)

if ($phase0Success) {
    Write-Host "🎉 Phase 0 テスト成功！Phase 1 に進行可能" -ForegroundColor Green

    # Phase 1準備フラグ設定
    Set-PnPListItem -List "AppSettings" -Identity (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_LastRunStatus</Value></Eq></Where></Query></View>").Id -Values @{ "Value" = "Phase0_Success_Ready_For_Phase1" }
} else {
    Write-Host "⚠️ Phase 0 テスト要修正項目あり" -ForegroundColor Red
    Set-PnPListItem -List "AppSettings" -Identity (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_LastRunStatus</Value></Eq></Where></Query></View>").Id -Values @{ "Value" = "Phase0_Issues_Need_Fix" }
}
```

## 次のアクション

### Phase 0 成功時 → Phase 1 準備
- パイロットユーザー10名の設定
- AppSettings Phase変更 (0→1)
- 負荷テスト準備

### Phase 0 失敗時 → 修正・再実行
- Power Automateフローのデバッグ
- SharePointデータ整合性確認
- Azure Functions接続確認

---

## 実行状況記録

- [ ] **Step 1**: SharePoint環境確認
- [ ] **Step 2**: Phase 0 AppSettings設定
- [ ] **Step 3**: テストユーザー準備
- [ ] **Step 4**: テストデータ作成
- [ ] **Step 5**: 手動実行テスト
- [ ] **Step 6**: 結果検証
- [ ] **Step 7**: KPI検証

**判定結果**: 未実行
**次のフェーズ**: Phase 1 (条件: Phase 0 成功)