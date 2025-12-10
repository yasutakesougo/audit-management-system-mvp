# 月次記録集計システム 運用手順書

## 🎯 システム概要

**目的**: 月次記録集計を `aggregateMonthlyKpi` と同等の処理をPower Automateで自動化
**対象**: SupportRecord_Daily → MonthlyRecord_Summary への集計処理
**運用形態**: 4段階展開 (Phase 0→1→2→3) による段階的本番化

## 📅 日次運用チェックリスト

### 毎朝の確認事項 (9:00-9:15)

```powershell
# 日次監視実行
./monitoring-tasks.ps1 -SiteUrl "https://yourtenant.sharepoint.com/sites/audit-management"
```

- [ ] システム稼働状況確認 (緑: 正常 / 赤: 異常)
- [ ] 前日実行結果確認 (成功率 ≥99%)
- [ ] フェーズ状態確認 (0:Dev / 1:Pilot / 2:Partial / 3:Full)
- [ ] 緊急停止フラグ確認 (false = 正常)
- [ ] エラーログ確認

### トラブル発生時の初期対応

| 状況 | 判定基準 | 対応アクション |
|------|----------|---------------|
| 🟢 正常 | 成功率≥99%, 処理時間≤10分 | 通常監視継続 |
| 🟡 注意 | 成功率95-99%, 処理時間10-15分 | 詳細調査、次回実行で改善確認 |
| 🔴 異常 | 成功率<95% または処理時間>15分 | 緊急停止実行 |

## 🚨 緊急時対応フロー

### Step 1: 緊急停止実行

```powershell
# 緊急停止（例: 高エラー率検出）
./emergency-stop.ps1 -SiteUrl "https://yourtenant.sharepoint.com/sites/audit-management" -Reason "成功率85%以下検出"
```

### Step 2: 問題調査

1. **Power Automate実行履歴確認**
   - 失敗したフロー特定
   - エラーメッセージ分析
   - 影響範囲確認

2. **SharePointデータ確認**
   - SupportRecord_Daily データ整合性
   - MonthlyRecord_Summary 不整合レコード
   - AppSettings 設定値確認

3. **Azure Functions確認**
   - 稼働日計算API応答確認
   - エラーログ確認

### Step 3: 復旧手順

```powershell
# システム復旧（パイロットフェーズで再開）
Connect-PnPOnline -Url "https://yourtenant.sharepoint.com/sites/audit-management" -Interactive

# 緊急停止フラグクリア
Set-PnPListItem -List "AppSettings" -Identity (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_EmergencyStop</Value></Eq></Where></Query></View>").Id -Values @{ "Value" = "false" }

# フェーズ1（パイロット）で再開
Set-PnPListItem -List "AppSettings" -Identity (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_Phase</Value></Eq></Where></Query></View>").Id -Values @{ "Value" = "1" }

# システム有効化
Set-PnPListItem -List "AppSettings" -Identity (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_IsEnabled</Value></Eq></Where></Query></View>").Id -Values @{ "Value" = "true" }

# ステータス更新
Set-PnPListItem -List "AppSettings" -Identity (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_LastRunStatus</Value></Eq></Where></Query></View>").Id -Values @{ "Value" = "Recovered_Phase1" }
```

## 📊 週次・月次運用

### 毎週金曜日 17:00-17:30: 週次レビュー

```powershell
# 週次KPIレポート生成
$startDate = (Get-Date).AddDays(-7).ToString("yyyy-MM-dd")
$endDate = (Get-Date).ToString("yyyy-MM-dd")

# 週間実績データ収集
$weeklyReport = @{
    period = "$startDate to $endDate"
    successRate = 0  # 実際の値を設定
    avgProcessingTime = 0  # 実際の値を設定
    totalProcessedUsers = 0  # 実際の値を設定
    incidents = @()  # 発生した問題一覧
    recommendations = @()  # 改善提案
}

$weeklyReport | ConvertTo-Json | Out-File "./weekly-report-$(Get-Date -Format 'yyyyMMdd').json"
```

#### フェーズ移行判定

| 現在フェーズ | 移行条件 | 判定期間 |
|-------------|----------|----------|
| Phase 0 → 1 | 成功率≥99%, 処理時間≤2分, 問題なし | 1週間 |
| Phase 1 → 2 | 成功率≥99%, 処理時間≤5分, ユーザーフィードバック良好 | 2週間 |
| Phase 2 → 3 | 成功率≥99%, 処理時間≤8分, システム安定性確認 | 4週間 |

### 毎月末: 月次評価

1. **パフォーマンス評価**
   - [ ] 月間成功率レポート
   - [ ] 処理時間トレンド分析
   - [ ] ユーザー満足度調査
   - [ ] インシデント総括

2. **システム最適化**
   - [ ] SharePointインデックス最適化
   - [ ] Power Automateフロー改善
   - [ ] 監視閾値調整

## 🔧 フェーズ移行手順

### Phase 0 → Phase 1 移行

```powershell
# フェーズ1移行スクリプト
function Move-ToPhase1 {
    Connect-PnPOnline -Url $SiteUrl -Interactive

    # Users_Masterでパイロットユーザー設定確認
    $pilotUsers = Get-PnPListItem -List "Users_Master" -Query "<View><Query><Where><Eq><FieldRef Name='IsPilot'/><Value Type='Boolean'>1</Value></Eq></Where></Query></View>"

    if ($pilotUsers.Count -lt 5) {
        Write-Host "パイロットユーザーが不足しています（現在: $($pilotUsers.Count)人）" -ForegroundColor Red
        return $false
    }

    # フェーズ1設定適用
    Set-PnPListItem -List "AppSettings" -Identity (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_Phase</Value></Eq></Where></Query></View>").Id -Values @{ "Value" = "1" }
    Set-PnPListItem -List "AppSettings" -Identity (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_MaxUsers</Value></Eq></Where></Query></View>").Id -Values @{ "Value" = "10" }
    Set-PnPListItem -List "AppSettings" -Identity (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_TimeoutMinutes</Value></Eq></Where></Query></View>").Id -Values @{ "Value" = "5" }

    Write-Host "Phase 1 移行完了" -ForegroundColor Green
    return $true
}

Move-ToPhase1
```

### Phase 2 → Phase 3 (全面展開) 移行

```powershell
function Move-ToPhase3 {
    # 最終確認
    $confirmation = Read-Host "全面展開を実行しますか？ (yes/no)"
    if ($confirmation -ne "yes") {
        Write-Host "全面展開をキャンセルしました"
        return
    }

    # Phase 3設定適用
    Set-PnPListItem -List "AppSettings" -Identity (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_Phase</Value></Eq></Where></Query></View>").Id -Values @{ "Value" = "3" }
    Set-PnPListItem -List "AppSettings" -Identity (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_MaxUsers</Value></Eq></Where></Query></View>").Id -Values @{ "Value" = "45" }
    Set-PnPListItem -List "AppSettings" -Identity (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_TimeoutMinutes</Value></Eq></Where></Query></View>").Id -Values @{ "Value" = "10" }
    Set-PnPListItem -List "AppSettings" -Identity (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_TeamsWebhookUrl</Value></Eq></Where></Query></View>").Id -Values @{ "Value" = $env:TEAMS_WEBHOOK_PRODUCTION }

    Write-Host "🎉 Phase 3 (全面展開) 移行完了！" -ForegroundColor Green

    # 成功通知
    $message = @{
        '@type' = 'MessageCard'
        '@context' = 'http://schema.org/extensions'
        'themeColor' = '00FF00'
        'summary' = '🎉 全面展開完了'
        'sections' = @(
            @{
                'activityTitle' = '月次記録集計システム - Phase 3 全面展開'
                'activitySubtitle' = 'システムが全ユーザーに展開されました'
                'facts' = @(
                    @{ 'name' = '展開時刻'; 'value' = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss') }
                    @{ 'name' = '対象ユーザー'; 'value' = '全ユーザー（最大45名/バッチ）' }
                    @{ 'name' = '処理時間制限'; 'value' = '10分' }
                )
            }
        )
    }

    Invoke-RestMethod -Uri $env:TEAMS_WEBHOOK_PRODUCTION -Method Post -Body ($message | ConvertTo-Json -Depth 4) -ContentType 'application/json'
}
```

## 📞 エスカレーション一覧

### Level 1: 一般的な問題 (4時間以内)
- **対象**: 設定変更、軽微な不具合
- **担当**: システム管理者
- **連絡先**: admin@company.com

### Level 2: 重要な問題 (2時間以内)
- **対象**: 機能停止、パフォーマンス問題
- **担当**: 開発チーム
- **連絡先**: dev-team@company.com

### Level 3: 緊急事態 (30分以内)
- **対象**: システム全体停止、データ損失リスク
- **担当**: 緊急対応チーム
- **連絡先**: emergency@company.com
- **Teams**: #system-emergency

## 📋 定期メンテナンス

### 月次メンテナンス (毎月第2土曜日 午前中)

```powershell
# 月次メンテナンススクリプト
function Invoke-MonthlyMaintenance {
    Write-Host "月次メンテナンスを開始します..."

    # 1. データベースクリーンアップ
    $oldRecords = Get-PnPListItem -List "MonthlyRecord_Summary" -Query "<View><Query><Where><Lt><FieldRef Name='LastUpdated'/><Value Type='DateTime' IncludeTimeValue='TRUE'>$(Get-Date).AddMonths(-6).ToString('yyyy-MM-ddTHH:mm:ssZ')</Value></Lt></Where></Query></View>"
    Write-Host "6ヶ月以上前のレコード: $($oldRecords.Count)件"

    # 2. インデックス再構築確認
    $lists = @("MonthlyRecord_Summary", "SupportRecord_Daily", "AppSettings")
    foreach ($listName in $lists) {
        $list = Get-PnPList -Identity $listName
        Write-Host "$listName リスト項目数: $($list.ItemCount)"
    }

    # 3. パフォーマンステスト
    $testStart = Get-Date
    $testRecords = Get-PnPListItem -List "MonthlyRecord_Summary" -PageSize 100
    $testDuration = ((Get-Date) - $testStart).TotalSeconds
    Write-Host "パフォーマンステスト: $([math]::Round($testDuration, 2))秒"

    Write-Host "月次メンテナンス完了"
}
```

### 四半期レビュー

- [ ] システムアーキテクチャ見直し
- [ ] 運用手順書更新
- [ ] KPI目標値調整
- [ ] ユーザートレーニング実施
- [ ] 災害復旧テスト

## 🎯 成功指標とゴール

### システムKPI目標

| 指標 | Phase 0 | Phase 1 | Phase 2 | Phase 3 |
|------|---------|---------|---------|---------|
| 成功率 | ≥95% | ≥99% | ≥99% | ≥99% |
| 処理時間 | ≤2分 | ≤5分 | ≤8分 | ≤10分 |
| 対象ユーザー | 5名 | 10名 | 25名 | 45名 |
| 稼働時間 | 週3回 | 毎日 | 毎日 | 毎日 |

### 運用効率目標

- **手動作業削減**: 80%以上
- **エラー対応時間**: 30分以内
- **月次レポート作成**: 5分以内
- **ユーザー満足度**: 4.0/5.0以上

---

## 📝 更新履歴

| 日付 | バージョン | 更新内容 | 担当者 |
|------|------------|----------|--------|
| 2025-11-06 | 1.0 | 初版作成 | システム開発チーム |

---

**重要**: この運用手順書は本番運用開始前に運用チームと必ずレビューを実施し、環境固有の設定や連絡先を更新してください。