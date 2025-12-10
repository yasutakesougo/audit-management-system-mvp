# プロダクション展開準備ガイド

## 概要

このドキュメントは、Power Automate月次記録集計システムの本番環境への展開に必要な設定、監視ダッシュボード、運用手順を包括的に説明します。

## 📋 展開前チェックリスト

### 1. 前提条件確認
- [ ] SharePoint環境の準備完了
- [ ] Azure Functions デプロイ済み
- [ ] Teams Webhook URL 取得済み
- [ ] 必要な権限設定完了
- [ ] E2Eテスト実行完了

### 2. SharePoint リスト設定
- [ ] MonthlyRecord_Summary リスト作成
- [ ] SupportRecord_Daily リスト作成
- [ ] AppSettings リスト作成
- [ ] Users_Master リスト作成

## 🔧 AppSettings 本番設定

### Phase 0 (開発フェーズ) 初期設定

```powershell
# Phase 0: 開発者のみ
$phase0Settings = @(
    @{ Key = "MonthlyAggregation_IsEnabled"; Value = "true" },
    @{ Key = "MonthlyAggregation_Phase"; Value = "0" },
    @{ Key = "MonthlyAggregation_MaxUsers"; Value = "5" },
    @{ Key = "MonthlyAggregation_TimeoutMinutes"; Value = "2" },
    @{ Key = "MonthlyAggregation_RetryCount"; Value = "2" },
    @{ Key = "MonthlyAggregation_TeamsWebhookUrl"; Value = "$env:TEAMS_WEBHOOK_PHASE0" },
    @{ Key = "MonthlyAggregation_AzureFunctionsUrl"; Value = "$env:AZURE_FUNCTIONS_URL" },
    @{ Key = "MonthlyAggregation_LastRunStatus"; Value = "Ready" },
    @{ Key = "MonthlyAggregation_EmergencyStop"; Value = "false" },
    @{ Key = "MonthlyAggregation_SuccessThreshold"; Value = "0.99" },
    @{ Key = "MonthlyAggregation_ProcessingTimeThreshold"; Value = "120" }
)

foreach ($setting in $phase0Settings) {
    # SharePoint AppSettings リストに追加
    Add-PnPListItem -List "AppSettings" -Values @{
        "Key" = $setting.Key
        "Value" = $setting.Value
        "Description" = "Phase 0 - Dev configuration"
        "IsActive" = $true
    }
}
```

### Phase 1 (パイロット) 設定移行

```powershell
# Phase 1: パイロットユーザー追加
$phase1Updates = @{
    "MonthlyAggregation_Phase" = "1"
    "MonthlyAggregation_MaxUsers" = "10"
    "MonthlyAggregation_TimeoutMinutes" = "5"
    "MonthlyAggregation_TeamsWebhookUrl" = $env:TEAMS_WEBHOOK_PILOT
}

foreach ($key in $phase1Updates.Keys) {
    Set-PnPListItem -List "AppSettings" -Identity (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>$key</Value></Eq></Where></Query></View>").Id -Values @{ "Value" = $phase1Updates[$key] }
}
```

### Phase 2 (部分展開) 設定移行

```powershell
# Phase 2: 部分展開
$phase2Updates = @{
    "MonthlyAggregation_Phase" = "2"
    "MonthlyAggregation_MaxUsers" = "25"
    "MonthlyAggregation_TimeoutMinutes" = "8"
    "MonthlyAggregation_RetryCount" = "3"
}

foreach ($key in $phase2Updates.Keys) {
    Set-PnPListItem -List "AppSettings" -Identity (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>$key</Value></Eq></Where></Query></View>").Id -Values @{ "Value" = $phase2Updates[$key] }
}
```

### Phase 3 (全面展開) 最終設定

```powershell
# Phase 3: 全面展開
$phase3Updates = @{
    "MonthlyAggregation_Phase" = "3"
    "MonthlyAggregation_MaxUsers" = "45"
    "MonthlyAggregation_TimeoutMinutes" = "10"
    "MonthlyAggregation_TeamsWebhookUrl" = $env:TEAMS_WEBHOOK_PRODUCTION
}

foreach ($key in $phase3Updates.Keys) {
    Set-PnPListItem -List "AppSettings" -Identity (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>$key</Value></Eq></Where></Query></View>").Id -Values @{ "Value" = $phase3Updates[$key] }
}
```

## 📊 監視ダッシュボード構築

### KPI監視PowerBIダッシュボード

```json
{
  "dashboardConfig": {
    "name": "月次記録集計システム監視",
    "refreshRate": "5分",
    "kpis": [
      {
        "name": "成功率",
        "target": "99%",
        "source": "MonthlyRecord_Summary",
        "query": "成功レコード数 / 総レコード数"
      },
      {
        "name": "処理時間",
        "target": "10分以内",
        "source": "Power Automate 実行履歴",
        "alertThreshold": "8分"
      },
      {
        "name": "対象ユーザー数",
        "source": "Users_Master",
        "query": "フェーズ別アクティブユーザー数"
      }
    ]
  }
}
```

### SharePoint監視用PowerShellスクリプト

```powershell
# monitoring-dashboard.ps1
param(
    [string]$SiteUrl,
    [string]$OutputPath = "./monitoring-report.json"
)

function Get-SystemStatus {
    $status = @{
        timestamp = (Get-Date).ToString("o")
        phase = (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_Phase</Value></Eq></Where></Query></View>").FieldValues.Value
        isEnabled = (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_IsEnabled</Value></Eq></Where></Query></View>").FieldValues.Value
        emergencyStop = (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_EmergencyStop</Value></Eq></Where></Query></View>").FieldValues.Value
        lastRunStatus = (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_LastRunStatus</Value></Eq></Where></Query></View>").FieldValues.Value
    }

    return $status
}

function Get-KPIMetrics {
    $today = (Get-Date).ToString("yyyy-MM-dd")
    $thisMonth = (Get-Date).ToString("yyyy-MM")

    # 今月の処理済みレコード数
    $monthlyRecords = Get-PnPListItem -List "MonthlyRecord_Summary" -Query "<View><Query><Where><Contains><FieldRef Name='YearMonth'/><Value Type='Text'>$thisMonth</Value></Contains></Where></Query></View>"

    # 成功率計算
    $totalRecords = $monthlyRecords.Count
    $successfulRecords = ($monthlyRecords | Where-Object { $_.FieldValues.CompletionRate -ge 0.99 }).Count
    $successRate = if ($totalRecords -gt 0) { [math]::Round(($successfulRecords / $totalRecords) * 100, 2) } else { 0 }

    return @{
        totalRecords = $totalRecords
        successfulRecords = $successfulRecords
        successRate = $successRate
        averageCompletionRate = [math]::Round(($monthlyRecords.FieldValues.CompletionRate | Measure-Object -Average).Average * 100, 2)
    }
}

function Get-UserDistribution {
    $users = Get-PnPListItem -List "Users_Master"

    return @{
        total = $users.Count
        pilot = ($users | Where-Object { $_.FieldValues.IsPilot -eq $true }).Count
        partialDeploy = ($users | Where-Object { $_.FieldValues.IsPartialDeploy -eq $true }).Count
        active = ($users | Where-Object { $_.FieldValues.IsActive -eq $true }).Count
    }
}

# メイン監視処理
Connect-PnPOnline -Url $SiteUrl -Interactive

$report = @{
    systemStatus = Get-SystemStatus
    kpiMetrics = Get-KPIMetrics
    userDistribution = Get-UserDistribution
    generatedAt = (Get-Date).ToString("o")
}

$report | ConvertTo-Json -Depth 3 | Out-File $OutputPath
Write-Host "監視レポートを生成しました: $OutputPath"
```

## 🚨 緊急時対応手順

### 緊急停止手順

```powershell
# emergency-stop.ps1
function Stop-MonthlyAggregation {
    param([string]$Reason)

    # 緊急停止フラグを設定
    Set-PnPListItem -List "AppSettings" -Identity (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_EmergencyStop</Value></Eq></Where></Query></View>").Id -Values @{ "Value" = "true" }

    # システム無効化
    Set-PnPListItem -List "AppSettings" -Identity (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_IsEnabled</Value></Eq></Where></Query></View>").Id -Values @{ "Value" = "false" }

    # ステータス更新
    Set-PnPListItem -List "AppSettings" -Identity (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_LastRunStatus</Value></Eq></Where></Query></View>").Id -Values @{ "Value" = "Emergency_Stopped: $Reason" }

    Write-Host "緊急停止が完了しました。理由: $Reason"

    # Teams通知
    $webhookUrl = (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_TeamsWebhookUrl</Value></Eq></Where></Query></View>").FieldValues.Value

    $teamsMessage = @{
        "@type" = "MessageCard"
        "@context" = "http://schema.org/extensions"
        "themeColor" = "FF0000"
        "summary" = "🚨 緊急停止通知"
        "sections" = @(
            @{
                "activityTitle" = "月次記録集計システム - 緊急停止"
                "activitySubtitle" = "システムが緊急停止されました"
                "facts" = @(
                    @{ "name" = "停止時刻"; "value" = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss") }
                    @{ "name" = "理由"; "value" = $Reason }
                    @{ "name" = "対応"; "value" = "システムチームに連絡してください" }
                )
            }
        )
    }

    Invoke-RestMethod -Uri $webhookUrl -Method Post -Body ($teamsMessage | ConvertTo-Json -Depth 4) -ContentType "application/json"
}

# 使用例
Stop-MonthlyAggregation -Reason "高エラー率検出: 成功率85%以下"
```

### システム復旧手順

```powershell
# system-recovery.ps1
function Start-SystemRecovery {
    param(
        [ValidateSet("0", "1", "2", "3")]
        [string]$Phase = "0",
        [string]$RestartReason
    )

    # 緊急停止フラグをクリア
    Set-PnPListItem -List "AppSettings" -Identity (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_EmergencyStop</Value></Eq></Where></Query></View>").Id -Values @{ "Value" = "false" }

    # フェーズを指定レベルに設定
    Set-PnPListItem -List "AppSettings" -Identity (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_Phase</Value></Eq></Where></Query></View>").Id -Values @{ "Value" = $Phase }

    # システム有効化
    Set-PnPListItem -List "AppSettings" -Identity (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_IsEnabled</Value></Eq></Where></Query></View>").Id -Values @{ "Value" = "true" }

    # ステータス更新
    Set-PnPListItem -List "AppSettings" -Identity (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_LastRunStatus</Value></Eq></Where></Query></View>").Id -Values @{ "Value" = "Recovered_Phase$Phase: $RestartReason" }

    Write-Host "システム復旧が完了しました。フェーズ: $Phase"
}

# 使用例
Start-SystemRecovery -Phase "1" -RestartReason "問題修正後、パイロットフェーズで再開"
```

## 📈 パフォーマンス最適化

### Power Automate フロー最適化設定

```json
{
  "optimizationSettings": {
    "concurrency": {
      "enabled": true,
      "runs": 3,
      "description": "並列実行数を制限してSharePoint負荷を軽減"
    },
    "timeout": {
      "phase0": "PT2M",
      "phase1": "PT5M",
      "phase2": "PT8M",
      "phase3": "PT10M"
    },
    "retryPolicy": {
      "type": "exponential",
      "count": 3,
      "interval": "PT30S"
    },
    "chunking": {
      "enabled": true,
      "size": 5,
      "description": "ユーザーごとに分割処理"
    }
  }
}
```

### SharePoint リスト最適化

```powershell
# optimize-sharepoint-lists.ps1
function Optimize-SharePointLists {
    # MonthlyRecord_Summary のインデックス作成
    $monthlyList = Get-PnPList -Identity "MonthlyRecord_Summary"

    # Key フィールドインデックス (既存)
    Add-PnPField -List $monthlyList -DisplayName "Key" -InternalName "Key" -Type Text -AddToDefaultView -Required
    Set-PnPField -List $monthlyList -Identity "Key" -Values @{ Indexed = $true; EnforceUniqueValues = $true }

    # YearMonth フィールドインデックス
    Set-PnPField -List $monthlyList -Identity "YearMonth" -Values @{ Indexed = $true }

    # UserCode フィールドインデックス
    Set-PnPField -List $monthlyList -Identity "UserCode" -Values @{ Indexed = $true }

    # SupportRecord_Daily のインデックス最適化
    $dailyList = Get-PnPList -Identity "SupportRecord_Daily"
    Set-PnPField -List $dailyList -Identity "UserId" -Values @{ Indexed = $true }
    Set-PnPField -List $dailyList -Identity "Completed" -Values @{ Indexed = $true }

    Write-Host "SharePointリスト最適化が完了しました"
}

Optimize-SharePointLists
```

## 🔄 日次・週次・月次運用タスク

### 日次監視タスク

```powershell
# daily-monitoring.ps1
$dailyTasks = @(
    "システム状態確認",
    "KPI監視（成功率・処理時間）",
    "エラーログ確認",
    "リソース使用量チェック"
)

function Invoke-DailyMonitoring {
    $report = @{
        date = (Get-Date).ToString("yyyy-MM-dd")
        tasks = @()
    }

    foreach ($task in $dailyTasks) {
        $taskResult = @{
            name = $task
            status = "実行中"
            timestamp = (Get-Date).ToString("HH:mm:ss")
        }

        switch ($task) {
            "システム状態確認" {
                $status = Get-SystemStatus
                $taskResult.status = if ($status.isEnabled -eq "true" -and $status.emergencyStop -eq "false") { "正常" } else { "要確認" }
                $taskResult.details = $status
            }
            "KPI監視（成功率・処理時間）" {
                $kpis = Get-KPIMetrics
                $taskResult.status = if ($kpis.successRate -ge 99) { "正常" } else { "要確認" }
                $taskResult.details = $kpis
            }
        }

        $report.tasks += $taskResult
    }

    return $report
}
```

### 週次レビュー

```markdown
## 🗓️ 週次運用レビュー

### チェックポイント
- [ ] 週間成功率トレンド分析
- [ ] ユーザーフィードバック確認
- [ ] システムパフォーマンス評価
- [ ] フェーズ移行計画見直し
- [ ] 緊急事態対応ログ確認

### パフォーマンス評価基準
| メトリック | 目標値 | 現在値 | ステータス |
|-----------|--------|--------|-----------|
| 成功率 | ≥99% | - | - |
| 平均処理時間 | ≤10分 | - | - |
| ユーザー満足度 | ≥4.0/5.0 | - | - |
```

### 月次システム評価

```powershell
# monthly-evaluation.ps1
function Invoke-MonthlyEvaluation {
    $month = (Get-Date).ToString("yyyy-MM")

    $evaluation = @{
        period = $month
        systemMetrics = Get-KPIMetrics
        userFeedback = Get-UserFeedback
        incidentSummary = Get-IncidentSummary
        recommendations = @()
    }

    # フェーズ移行の推奨判定
    if ($evaluation.systemMetrics.successRate -ge 99 -and $evaluation.incidentSummary.criticalCount -eq 0) {
        $currentPhase = (Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_Phase</Value></Eq></Where></Query></View>").FieldValues.Value

        if ($currentPhase -lt 3) {
            $evaluation.recommendations += "次フェーズへの移行を推奨します"
        }
    }

    return $evaluation
}
```

## 📚 トラブルシューティングガイド

### よくある問題と対処法

| 問題 | 症状 | 対処法 |
|------|------|--------|
| SharePoint接続エラー | Power Automate が SharePoint にアクセスできない | 接続の再認証、権限確認 |
| Azure Functions タイムアウト | 稼働日計算が応答しない | Functions の再起動、ログ確認 |
| Teams 通知失敗 | 通知が届かない | Webhook URL の確認、チャネル権限確認 |
| 高エラー率 | 成功率が90%以下 | 緊急停止→原因調査→段階的復旧 |
| 処理時間超過 | 制限時間内に完了しない | ユーザー数制限、処理方法見直し |

### エラーコード対応表

```json
{
  "errorCodes": {
    "PA001": {
      "description": "SharePoint リスト アクセス エラー",
      "action": "権限確認、リスト存在確認"
    },
    "PA002": {
      "description": "Azure Functions 呼び出し失敗",
      "action": "Functions ステータス確認、URL検証"
    },
    "PA003": {
      "description": "Teams 通知送信失敗",
      "action": "Webhook URL 確認、チャネル権限確認"
    },
    "PA004": {
      "description": "データ整合性エラー",
      "action": "データ検証、手動修正"
    }
  }
}
```

## 🎯 運用成功指標

### システムKPI

| 指標 | 目標値 | 測定方法 | 報告頻度 |
|------|--------|----------|----------|
| システム稼働率 | 99.9% | 監視ツール | 日次 |
| 処理成功率 | 99% | SharePoint ログ | 日次 |
| 平均処理時間 | ≤10分 | Power Automate 履歴 | 日次 |
| ユーザー満足度 | 4.0/5.0 | 月次アンケート | 月次 |

### 運用効率KPI

| 指標 | 目標値 | 現状 | 改善アクション |
|------|--------|------|---------------|
| 手動作業時間削減 | 80% | - | 自動化範囲拡大 |
| エラー対応時間 | ≤30分 | - | 監視精度向上 |
| 月次レポート生成時間 | ≤5分 | - | ダッシュボード活用 |

## 📞 連絡先・エスカレーション

### 問題レベル別連絡先

| レベル | 対象問題 | 連絡先 | 対応時間 |
|--------|----------|--------|----------|
| Level 1 | 軽微な設定変更、質問 | システム管理者 | 4時間以内 |
| Level 2 | 機能不具合、パフォーマンス問題 | 開発チーム | 2時間以内 |
| Level 3 | システム全体停止 | 緊急対応チーム | 30分以内 |

### エスカレーション判定基準

- **Level 1**: 成功率95%以上、処理時間15分以内
- **Level 2**: 成功率90-95%、処理時間15-30分
- **Level 3**: 成功率90%未満、処理時間30分超過、システム停止

---

## 📝 変更履歴

| 日付 | バージョン | 変更内容 | 担当者 |
|------|------------|----------|--------|
| 2025-11-06 | 1.0 | 初版作成 | システム開発チーム |

---

*このドキュメントは本番運用開始前に必ずレビューし、環境固有の設定を反映してください。*