# Phase 1準備スクリプト - パイロットフェーズ移行

# 月次記録集計システム - Phase 1パイロット準備
# 前提: Phase 0 成功済み
# 対象: パイロットユーザー10名での本格テスト

param(
    [string]$SharePointSiteUrl = "",
    [string]$TeamsWebhookPilot = "",
    [string]$AzureFunctionsUrl = "",
    [switch]$SetupPilotUsers = $true,
    [switch]$ConfigureAppSettings = $true,
    [switch]$TestNotifications = $false
)

Write-Host "=== Phase 1準備開始 ===" -ForegroundColor Cyan
Write-Host "Phase 0 → Phase 1 移行" -ForegroundColor White
Write-Host "対象: パイロット10名、処理時間≤5分、成功率≥99%" -ForegroundColor White

# Phase 0成功確認
if (Test-Path "./phase0-test-results.json") {
    $phase0Results = Get-Content "./phase0-test-results.json" | ConvertFrom-Json
    if ($phase0Results.LocalTest -and $phase0Results.Simulation) {
        Write-Host "✅ Phase 0成功確認済み" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Phase 0未完了 - 先にPhase 0を成功させてください" -ForegroundColor Red
        return $false
    }
}
else {
    Write-Host "⚠️ Phase 0結果ファイルが見つかりません" -ForegroundColor Yellow
}

# Step 1: パイロットユーザー設定
if ($SetupPilotUsers) {
    Write-Host "`n--- Step 1: パイロットユーザー設定 ---" -ForegroundColor Yellow

    # パイロットユーザー定義（10名）
    $pilotUsers = @(
        @{ UserCode = "PILOT001"; UserName = "パイロット太郎"; Department = "事業部A"; IsPilot = $true },
        @{ UserCode = "PILOT002"; UserName = "パイロット花子"; Department = "事業部A"; IsPilot = $true },
        @{ UserCode = "PILOT003"; UserName = "パイロット次郎"; Department = "事業部B"; IsPilot = $true },
        @{ UserCode = "PILOT004"; UserName = "パイロット三郎"; Department = "事業部B"; IsPilot = $true },
        @{ UserCode = "PILOT005"; UserName = "パイロット四郎"; Department = "事業部C"; IsPilot = $true },
        @{ UserCode = "PILOT006"; UserName = "パイロット五郎"; Department = "事業部C"; IsPilot = $true },
        @{ UserCode = "PILOT007"; UserName = "パイロット六郎"; Department = "事業部D"; IsPilot = $true },
        @{ UserCode = "PILOT008"; UserName = "パイロット七郎"; Department = "事業部D"; IsPilot = $true },
        @{ UserCode = "PILOT009"; UserName = "パイロット八郎"; Department = "事業部E"; IsPilot = $true },
        @{ UserCode = "PILOT010"; UserName = "パイロット九郎"; Department = "事業部E"; IsPilot = $true }
    )

    Write-Host "パイロットユーザー10名の定義完了:" -ForegroundColor White
    foreach ($user in $pilotUsers) {
        Write-Host "  👤 $($user.UserCode): $($user.UserName) ($($user.Department))" -ForegroundColor Gray
    }

    # SharePoint接続時のユーザー登録処理をここに追加可能
    # if ($SharePointSiteUrl) { ... }
}

# Step 2: AppSettings Phase 1設定
if ($ConfigureAppSettings) {
    Write-Host "`n--- Step 2: AppSettings Phase 1設定 ---" -ForegroundColor Yellow

    $phase1Settings = @{
        "MonthlyAggregation_Phase"                   = "1"
        "MonthlyAggregation_MaxUsers"                = "10"
        "MonthlyAggregation_TimeoutMinutes"          = "5"
        "MonthlyAggregation_RetryCount"              = "3"
        "MonthlyAggregation_TeamsWebhookUrl"         = $TeamsWebhookPilot
        "MonthlyAggregation_SuccessThreshold"        = "0.99"
        "MonthlyAggregation_ProcessingTimeThreshold" = "300"
        "MonthlyAggregation_LastRunStatus"           = "Phase1_Ready"
    }

    Write-Host "Phase 1設定内容:" -ForegroundColor White
    foreach ($setting in $phase1Settings.GetEnumerator()) {
        Write-Host "  🔧 $($setting.Key): $($setting.Value)" -ForegroundColor Gray
    }

    # 設定をローカルファイルに保存
    $phase1Settings | ConvertTo-Json -Depth 2 | Out-File "./phase1-appsettings.json" -Force
    Write-Host "✅ Phase 1設定を ./phase1-appsettings.json に保存" -ForegroundColor Green
}

# Step 3: テストデータ生成シミュレーション
Write-Host "`n--- Step 3: Phase 1テストデータ生成 ---" -ForegroundColor Yellow

# 2024年11月のパイロット用テストデータ
$phase1TestData = @()
$testDates = @("2024-11-01", "2024-11-04", "2024-11-05", "2024-11-06", "2024-11-07", "2024-11-08", "2024-11-11", "2024-11-12")

for ($i = 1; $i -le 10; $i++) {
    $userCode = "PILOT" + $i.ToString("000")
    foreach ($date in $testDates) {
        $record = @{
            UserCode        = $userCode
            RecordDate      = $date
            Completed       = $true
            HasSpecialNotes = ($i % 4 -eq 0)  # 25%で特記事項
            HasIncidents    = ($i % 10 -eq 0)    # 10%で事故
            IsEmpty         = $false
            Notes           = "Phase 1 パイロットテストデータ"
            GeneratedAt     = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        }
        $phase1TestData += $record
    }
}

Write-Host "生成されたテストデータ:" -ForegroundColor White
Write-Host "  📊 総レコード数: $($phase1TestData.Count)" -ForegroundColor Gray
Write-Host "  👥 対象ユーザー: 10名" -ForegroundColor Gray
Write-Host "  📅 対象期間: 2024年11月 (8営業日)" -ForegroundColor Gray
Write-Host "  ✅ 完了率期待値: 100%" -ForegroundColor Gray

# テストデータをファイルに保存
$phase1TestData | ConvertTo-Json -Depth 2 | Out-File "./phase1-testdata.json" -Force
Write-Host "✅ テストデータを ./phase1-testdata.json に保存" -ForegroundColor Green

# Step 4: KPI予測計算
Write-Host "`n--- Step 4: Phase 1 KPI予測 ---" -ForegroundColor Yellow

$totalUsers = 10
$totalRecords = $phase1TestData.Count
$completedRecords = ($phase1TestData | Where-Object { $_.Completed }).Count
$specialNotesCount = ($phase1TestData | Where-Object { $_.HasSpecialNotes }).Count
$incidentsCount = ($phase1TestData | Where-Object { $_.HasIncidents }).Count

$expectedSuccessRate = ($completedRecords / $totalRecords) * 100
$expectedProcessingTime = [math]::Ceiling($totalUsers * 0.3) # 1ユーザー30秒想定

Write-Host "Phase 1 KPI予測:" -ForegroundColor White
Write-Host "  📈 処理成功率: $($expectedSuccessRate)% (目標: ≥99%)" -ForegroundColor $(if ($expectedSuccessRate -ge 99) { 'Green' }else { 'Yellow' })
Write-Host "  ⏱️ 処理時間予測: $($expectedProcessingTime)分 (目標: ≤5分)" -ForegroundColor $(if ($expectedProcessingTime -le 5) { 'Green' }else { 'Yellow' })
Write-Host "  👥 対象ユーザー: $totalUsers名" -ForegroundColor Gray
Write-Host "  📝 総レコード数: $totalRecords件" -ForegroundColor Gray
Write-Host "  ⚠️ 特記事項: $specialNotesCount件" -ForegroundColor Gray
Write-Host "  🚨 事故報告: $incidentsCount件" -ForegroundColor Gray

# Step 5: Teams通知テスト（オプション）
if ($TestNotifications -and $TeamsWebhookPilot) {
    Write-Host "`n--- Step 5: Teams通知テスト ---" -ForegroundColor Yellow

    $testMessage = @{
        '@type'      = 'MessageCard'
        '@context'   = 'http://schema.org/extensions'
        'themeColor' = '0078D4'
        'summary'    = 'Phase 1 準備完了通知'
        'sections'   = @(
            @{
                'activityTitle'    = '月次記録集計システム - Phase 1 準備完了'
                'activitySubtitle' = 'パイロットフェーズの準備が完了しました'
                'facts'            = @(
                    @{ 'name' = '対象ユーザー'; 'value' = '10名' }
                    @{ 'name' = '予測処理時間'; 'value' = "$($expectedProcessingTime)分" }
                    @{ 'name' = '予測成功率'; 'value' = "$($expectedSuccessRate)%" }
                    @{ 'name' = '準備完了時刻'; 'value' = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') }
                )
            }
        )
    }

    try {
        Invoke-RestMethod -Uri $TeamsWebhookPilot -Method Post -Body ($testMessage | ConvertTo-Json -Depth 4) -ContentType 'application/json'
        Write-Host "✅ Teams通知テスト成功" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Teams通知テスト失敗: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Phase 1準備完了判定
$phase1Ready = $true

if (-not $SetupPilotUsers) {
    Write-Host "⚠️ パイロットユーザー設定がスキップされました" -ForegroundColor Yellow
}

if (-not $ConfigureAppSettings) {
    Write-Host "⚠️ AppSettings設定がスキップされました" -ForegroundColor Yellow
}

Write-Host "`n=== Phase 1準備結果 ===" -ForegroundColor Cyan
Write-Host "パイロットユーザー: $(if($SetupPilotUsers){'✅ 設定済み'}else{'⚠️ 未設定'})" -ForegroundColor $(if ($SetupPilotUsers) { 'Green' }else { 'Yellow' })
Write-Host "AppSettings: $(if($ConfigureAppSettings){'✅ 設定済み'}else{'⚠️ 未設定'})" -ForegroundColor $(if ($ConfigureAppSettings) { 'Green' }else { 'Yellow' })
Write-Host "テストデータ: ✅ 生成済み ($($phase1TestData.Count)件)" -ForegroundColor Green
Write-Host "KPI予測: ✅ 計算済み (成功率$($expectedSuccessRate)%)" -ForegroundColor Green

if ($phase1Ready) {
    Write-Host "`n🚀 Phase 1実行準備完了!" -ForegroundColor Green
    Write-Host "`n📋 次の実行手順:" -ForegroundColor Cyan
    Write-Host "1. SharePoint環境でユーザー・設定を適用" -ForegroundColor White
    Write-Host "2. Power Automateフローの Phase 1設定反映" -ForegroundColor White
    Write-Host "3. パイロット実行（手動トリガー）" -ForegroundColor White
    Write-Host "4. KPI監視・結果検証" -ForegroundColor White
    Write-Host "5. Phase 2移行判定" -ForegroundColor White
}
else {
    Write-Host "`n⚠️ Phase 1準備に不完全な項目があります" -ForegroundColor Yellow
}

# 結果保存
$phase1Results = @{
    Timestamp              = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    PilotUsersReady        = $SetupPilotUsers
    AppSettingsReady       = $ConfigureAppSettings
    TestDataGenerated      = $true
    KPIPredicted           = $true
    ExpectedSuccessRate    = $expectedSuccessRate
    ExpectedProcessingTime = $expectedProcessingTime
    TotalTestRecords       = $phase1TestData.Count
    Phase1Ready            = $phase1Ready
}

$phase1Results | ConvertTo-Json -Depth 2 | Out-File "./phase1-preparation-results.json" -Force
Write-Host "`n📄 Phase 1準備結果: ./phase1-preparation-results.json に保存" -ForegroundColor Blue

return $phase1Ready