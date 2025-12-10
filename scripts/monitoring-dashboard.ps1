# 月次記録集計システム監視ダッシュボード

# リアルタイムKPI監視とアラート機能
# Phase 1パイロット監視対応

param(
    [string]$SharePointSiteUrl = "",
    [string]$OutputFormat = "Console", # Console, JSON, HTML
    [int]$RefreshIntervalSeconds = 300, # 5分間隔
    [switch]$ContinuousMonitoring = $false,
    [switch]$GenerateReport = $true
)

function Get-SystemHealthStatus {
    param([string]$SiteUrl)

    $healthStatus = @{
        Timestamp     = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
        SystemStatus  = "Unknown"
        Phase         = "Unknown"
        IsEnabled     = $false
        EmergencyStop = $false
        LastRunStatus = "Unknown"
        Connected     = $false
    }

    if ($SiteUrl) {
        try {
            Connect-PnPOnline -Url $SiteUrl -Interactive -ErrorAction SilentlyContinue
            $healthStatus.Connected = $true

            # AppSettings から現在の状態を取得
            $settings = @{}
            $appSettings = Get-PnPListItem -List "AppSettings" -ErrorAction SilentlyContinue

            if ($appSettings) {
                foreach ($setting in $appSettings) {
                    $key = $setting.FieldValues["Key"]
                    $value = $setting.FieldValues["Value"]
                    if ($key -and $value) {
                        $settings[$key] = $value
                    }
                }

                $healthStatus.Phase = $settings["MonthlyAggregation_Phase"] ?? "0"
                $healthStatus.IsEnabled = ($settings["MonthlyAggregation_IsEnabled"] -eq "true")
                $healthStatus.EmergencyStop = ($settings["MonthlyAggregation_EmergencyStop"] -eq "true")
                $healthStatus.LastRunStatus = $settings["MonthlyAggregation_LastRunStatus"] ?? "Unknown"

                if ($healthStatus.EmergencyStop) {
                    $healthStatus.SystemStatus = "Emergency_Stopped"
                }
                elseif ($healthStatus.IsEnabled) {
                    $healthStatus.SystemStatus = "Active"
                }
                else {
                    $healthStatus.SystemStatus = "Inactive"
                }
            }
        }
        catch {
            $healthStatus.Connected = $false
            $healthStatus.SystemStatus = "Connection_Error"
        }
    }
    else {
        # ローカル状態確認（ファイルベース）
        if (Test-Path "./phase1-preparation-results.json") {
            $phase1Results = Get-Content "./phase1-preparation-results.json" | ConvertFrom-Json
            if ($phase1Results.Phase1Ready) {
                $healthStatus.SystemStatus = "Phase1_Ready"
                $healthStatus.Phase = "1"
                $healthStatus.IsEnabled = $true
            }
        }
        elseif (Test-Path "./phase1-execution-results.json") {
            $phase1Results = Get-Content "./phase1-execution-results.json" | ConvertFrom-Json
            if ($phase1Results.Phase1Success) {
                $healthStatus.SystemStatus = if ($phase1Results.ReadyForPhase2) { "Phase2_Ready" } else { "Phase1_Success" }
                $healthStatus.Phase = "1"
                $healthStatus.IsEnabled = $true
            }
        }
        elseif (Test-Path "./phase2-execution-results.json") {
            $phase2Results = Get-Content "./phase2-execution-results.json" | ConvertFrom-Json
            if ($phase2Results.Phase2Success) {
                $healthStatus.SystemStatus = if ($phase2Results.ReadyForPhase3) { "Phase3_Ready" } else { "Phase2_Success" }
                $healthStatus.Phase = "2"
                $healthStatus.IsEnabled = $true
            }
            else {
                $healthStatus.SystemStatus = "Phase2_Partial"
                $healthStatus.Phase = "2"
                $healthStatus.IsEnabled = $true
            }
        }
        elseif (Test-Path "./phase0-test-results.json") {
            $phase0Results = Get-Content "./phase0-test-results.json" | ConvertFrom-Json
            if ($phase0Results.LocalTest -and $phase0Results.Simulation) {
                $healthStatus.SystemStatus = "Phase0_Success"
                $healthStatus.Phase = "0"
                $healthStatus.IsEnabled = $true
            }
        }
    }

    return $healthStatus
}

function Get-KPIMetrics {
    param([string]$SiteUrl, [string]$YearMonth = "2024-11")

    $kpiMetrics = @{
        Timestamp              = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
        YearMonth              = $YearMonth
        TotalUsers             = 0
        ProcessedUsers         = 0
        SuccessfulUsers        = 0
        SuccessRate            = 0
        AverageCompletionRate  = 0
        TotalRecords           = 0
        ProcessingTime         = 0
        Incidents              = 0
        SpecialNotes           = 0
        DataSource             = "Unknown"
        # Phase 2 拡張メトリクス
        LoadTestResult         = "Not_Run"
        AverageSharePointDelay = 0
        BatchProcessingCount   = 0
        ScaleTestUsers         = 0
    }

    if ($SiteUrl) {
        try {
            # SharePoint から実データ取得
            $monthlyRecords = Get-PnPListItem -List "MonthlyRecord_Summary" -Query "<View><Query><Where><Contains><FieldRef Name='YearMonth'/><Value Type='Text'>$YearMonth</Value></Contains></Where></Query></View>" -ErrorAction SilentlyContinue

            if ($monthlyRecords) {
                $kpiMetrics.DataSource = "SharePoint"
                $kpiMetrics.TotalUsers = $monthlyRecords.Count
                $kpiMetrics.ProcessedUsers = $monthlyRecords.Count

                $successfulUsers = ($monthlyRecords | Where-Object { $_.FieldValues.CompletionRate -ge 0.99 }).Count
                $kpiMetrics.SuccessfulUsers = $successfulUsers
                $kpiMetrics.SuccessRate = if ($kpiMetrics.ProcessedUsers -gt 0) {
                    [math]::Round(($successfulUsers / $kpiMetrics.ProcessedUsers) * 100, 2)
                }
                else { 0 }

                $completionRates = $monthlyRecords | ForEach-Object { $_.FieldValues.CompletionRate }
                $kpiMetrics.AverageCompletionRate = if ($completionRates) {
                    [math]::Round(($completionRates | Measure-Object -Average).Average, 2)
                }
                else { 0 }

                $kpiMetrics.TotalRecords = ($monthlyRecords | ForEach-Object { $_.FieldValues.KPI_CompletedRows } | Measure-Object -Sum).Sum
                $kpiMetrics.Incidents = ($monthlyRecords | ForEach-Object { $_.FieldValues.KPI_Incidents } | Measure-Object -Sum).Sum
                $kpiMetrics.SpecialNotes = ($monthlyRecords | ForEach-Object { $_.FieldValues.KPI_SpecialNotes } | Measure-Object -Sum).Sum
            }
        }
        catch {
            $kpiMetrics.DataSource = "SharePoint_Error"
        }
    }
    else {
        # ローカル実行結果データ使用（優先順位: Phase 2 → Phase 1 → 予測）
        if (Test-Path "./phase2-execution-results.json") {
            $phase2Results = Get-Content "./phase2-execution-results.json" | ConvertFrom-Json
            $kpiMetrics.DataSource = "Phase2_Execution"
            $kpiMetrics.TotalUsers = $phase2Results.TotalUsers
            $kpiMetrics.ProcessedUsers = $phase2Results.TotalUsers
            $kpiMetrics.SuccessfulUsers = $phase2Results.SuccessfulUsers
            $kpiMetrics.SuccessRate = $phase2Results.OverallSuccessRate
            $kpiMetrics.AverageCompletionRate = $phase2Results.AverageCompletionRate
            $kpiMetrics.TotalRecords = ($phase2Results.ProcessingResults | ForEach-Object { $_.TotalRecords } | Measure-Object -Sum).Sum
            $kpiMetrics.ProcessingTime = $phase2Results.TotalProcessingTime
            $kpiMetrics.LoadTestResult = if ($phase2Results.LoadTestPassed) { "Passed" } else { "Failed" }
            $kpiMetrics.AverageSharePointDelay = $phase2Results.AverageSharePointDelay
            $kpiMetrics.BatchProcessingCount = $phase2Results.ScaleTestSummary.BatchCount
            $kpiMetrics.ScaleTestUsers = $phase2Results.TotalUsers
        }
        elseif (Test-Path "./phase1-execution-results.json") {
            $phase1Results = Get-Content "./phase1-execution-results.json" | ConvertFrom-Json
            $kpiMetrics.DataSource = "Phase1_Execution"
            $kpiMetrics.TotalUsers = $phase1Results.TotalUsers
            $kpiMetrics.ProcessedUsers = $phase1Results.TotalUsers
            $kpiMetrics.SuccessfulUsers = $phase1Results.SuccessfulUsers
            $kpiMetrics.SuccessRate = $phase1Results.OverallSuccessRate
            $kpiMetrics.AverageCompletionRate = $phase1Results.AverageCompletionRate
            $kpiMetrics.TotalRecords = ($phase1Results.ProcessingResults | ForEach-Object { $_.TotalRecords } | Measure-Object -Sum).Sum
            $kpiMetrics.ProcessingTime = $phase1Results.TotalProcessingTime
        }
        elseif (Test-Path "./phase1-preparation-results.json") {
            $phase1Results = Get-Content "./phase1-preparation-results.json" | ConvertFrom-Json
            $kpiMetrics.DataSource = "Phase1_Prediction"
            $kpiMetrics.TotalUsers = 10
            $kpiMetrics.ProcessedUsers = 10
            $kpiMetrics.SuccessfulUsers = 10
            $kpiMetrics.SuccessRate = $phase1Results.ExpectedSuccessRate
            $kpiMetrics.AverageCompletionRate = 100
            $kpiMetrics.TotalRecords = $phase1Results.TotalTestRecords
            $kpiMetrics.ProcessingTime = $phase1Results.ExpectedProcessingTime
        }
    }

    return $kpiMetrics
}

function Get-AlertStatus {
    param($HealthStatus, $KPIMetrics)

    $alerts = @()
    $overallSeverity = "Normal"

    # システム状態アラート
    switch ($HealthStatus.SystemStatus) {
        "Emergency_Stopped" {
            $alerts += @{ Level = "Critical"; Message = "システム緊急停止中"; Component = "System" }
            $overallSeverity = "Critical"
        }
        "Inactive" {
            $alerts += @{ Level = "Warning"; Message = "システム無効化状態"; Component = "System" }
            if ($overallSeverity -ne "Critical") { $overallSeverity = "Warning" }
        }
        "Connection_Error" {
            $alerts += @{ Level = "Error"; Message = "SharePoint接続エラー"; Component = "Connection" }
            if ($overallSeverity -notin @("Critical", "Error")) { $overallSeverity = "Error" }
        }
    }

    # KPIアラート
    if ($KPIMetrics.SuccessRate -lt 95) {
        $alerts += @{ Level = "Critical"; Message = "成功率が95%を下回りました ($($KPIMetrics.SuccessRate)%)"; Component = "KPI" }
        $overallSeverity = "Critical"
    }
    elseif ($KPIMetrics.SuccessRate -lt 99) {
        $alerts += @{ Level = "Warning"; Message = "成功率が99%を下回りました ($($KPIMetrics.SuccessRate)%)"; Component = "KPI" }
        if ($overallSeverity -notin @("Critical", "Error")) { $overallSeverity = "Warning" }
    }

    if ($KPIMetrics.ProcessingTime -gt 10) {
        $alerts += @{ Level = "Warning"; Message = "処理時間が10分を超過しました ($($KPIMetrics.ProcessingTime)分)"; Component = "Performance" }
        if ($overallSeverity -notin @("Critical", "Error")) { $overallSeverity = "Warning" }
    }

    return @{
        Alerts     = $alerts
        Severity   = $overallSeverity
        AlertCount = $alerts.Count
        Timestamp  = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    }
}

function Format-DashboardOutput {
    param($HealthStatus, $KPIMetrics, $AlertStatus, $Format)

    switch ($Format) {
        "Console" {
            Write-Host "`n" + "="*60 -ForegroundColor Cyan
            Write-Host " 月次記録集計システム監視ダッシュボード" -ForegroundColor Cyan
            Write-Host "="*60 -ForegroundColor Cyan
            Write-Host "更新時刻: $($HealthStatus.Timestamp)" -ForegroundColor Gray

            # システム状態
            Write-Host "`n🖥️  システム状態" -ForegroundColor Yellow
            $statusColor = switch ($HealthStatus.SystemStatus) {
                "Active" { "Green" }
                "Phase1_Ready" { "Green" }
                "Phase0_Success" { "Green" }
                "Inactive" { "Yellow" }
                "Emergency_Stopped" { "Red" }
                default { "Gray" }
            }
            Write-Host "   状態: $($HealthStatus.SystemStatus)" -ForegroundColor $statusColor
            Write-Host "   フェーズ: Phase $($HealthStatus.Phase)" -ForegroundColor White
            Write-Host "   有効: $(if($HealthStatus.IsEnabled){'✅ Yes'}else{'❌ No'})" -ForegroundColor $(if ($HealthStatus.IsEnabled) { 'Green' }else { 'Red' })
            Write-Host "   緊急停止: $(if($HealthStatus.EmergencyStop){'🚨 Yes'}else{'✅ No'})" -ForegroundColor $(if ($HealthStatus.EmergencyStop) { 'Red' }else { 'Green' })

            # KPI メトリクス
            Write-Host "`n📊 KPI メトリクス ($($KPIMetrics.YearMonth))" -ForegroundColor Yellow
            Write-Host "   データソース: $($KPIMetrics.DataSource)" -ForegroundColor Gray
            Write-Host "   対象ユーザー: $($KPIMetrics.TotalUsers)名" -ForegroundColor White
            Write-Host "   処理済み: $($KPIMetrics.ProcessedUsers)名" -ForegroundColor White

            $successRateColor = if ($KPIMetrics.SuccessRate -ge 99) { "Green" } elseif ($KPIMetrics.SuccessRate -ge 95) { "Yellow" } else { "Red" }
            Write-Host "   成功率: $($KPIMetrics.SuccessRate)%" -ForegroundColor $successRateColor
            Write-Host "   平均完了率: $($KPIMetrics.AverageCompletionRate)%" -ForegroundColor White
            Write-Host "   総レコード数: $($KPIMetrics.TotalRecords)件" -ForegroundColor White

            if ($KPIMetrics.ProcessingTime -gt 0) {
                $timeColor = if ($KPIMetrics.ProcessingTime -le 5) { "Green" } elseif ($KPIMetrics.ProcessingTime -le 10) { "Yellow" } else { "Red" }
                Write-Host "   処理時間: $($KPIMetrics.ProcessingTime)分" -ForegroundColor $timeColor
            }

            # アラート状態
            Write-Host "`n🚨 アラート状態" -ForegroundColor Yellow
            $severityColor = switch ($AlertStatus.Severity) {
                "Critical" { "Red" }
                "Error" { "Red" }
                "Warning" { "Yellow" }
                "Normal" { "Green" }
            }
            Write-Host "   重要度: $($AlertStatus.Severity)" -ForegroundColor $severityColor
            Write-Host "   アラート数: $($AlertStatus.AlertCount)件" -ForegroundColor White

            if ($AlertStatus.Alerts.Count -gt 0) {
                foreach ($alert in $AlertStatus.Alerts) {
                    $alertColor = switch ($alert.Level) {
                        "Critical" { "Red" }
                        "Error" { "Red" }
                        "Warning" { "Yellow" }
                        default { "White" }
                    }
                    Write-Host "   ⚠️ [$($alert.Level)] $($alert.Message)" -ForegroundColor $alertColor
                }
            }
            else {
                Write-Host "   ✅ アラートはありません" -ForegroundColor Green
            }

            Write-Host "`n" + "="*60 -ForegroundColor Cyan
        }

        "JSON" {
            $dashboardData = @{
                Health      = $HealthStatus
                KPIs        = $KPIMetrics
                Alerts      = $AlertStatus
                GeneratedAt = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
            }
            return $dashboardData | ConvertTo-Json -Depth 3
        }

        "HTML" {
            $htmlTemplate = @"
<!DOCTYPE html>
<html>
<head>
    <title>月次記録集計システム監視ダッシュボード</title>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="300">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .dashboard { max-width: 1200px; margin: 0 auto; }
        .header { background: #0078d4; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .section { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric { display: inline-block; margin: 10px 20px 10px 0; }
        .metric-value { font-size: 2em; font-weight: bold; }
        .metric-label { font-size: 0.9em; color: #666; }
        .status-active { color: #107c10; }
        .status-warning { color: #ff8c00; }
        .status-critical { color: #d13438; }
        .alert { padding: 10px; margin: 5px 0; border-radius: 4px; }
        .alert-critical { background: #fdf2f2; border-left: 4px solid #d13438; }
        .alert-warning { background: #fffdf2; border-left: 4px solid #ff8c00; }
        .timestamp { font-size: 0.9em; color: #666; }
    </style>
</head>
<body>
    <div class="dashboard">
        <div class="header">
            <h1>🖥️ 月次記録集計システム監視ダッシュボード</h1>
            <p class="timestamp">最終更新: $($HealthStatus.Timestamp)</p>
        </div>

        <div class="section">
            <h2>システム状態</h2>
            <div class="metric">
                <div class="metric-value status-$(if($HealthStatus.SystemStatus -eq 'Active'){'active'}elseif($HealthStatus.SystemStatus -like '*Error*'){'critical'}else{'warning'})">
                    $($HealthStatus.SystemStatus)
                </div>
                <div class="metric-label">システム状態</div>
            </div>
            <div class="metric">
                <div class="metric-value">Phase $($HealthStatus.Phase)</div>
                <div class="metric-label">現在フェーズ</div>
            </div>
        </div>

        <div class="section">
            <h2>📊 KPI メトリクス ($($KPIMetrics.YearMonth))</h2>
            <div class="metric">
                <div class="metric-value status-$(if($KPIMetrics.SuccessRate -ge 99){'active'}elseif($KPIMetrics.SuccessRate -ge 95){'warning'}else{'critical'})">
                    $($KPIMetrics.SuccessRate)%
                </div>
                <div class="metric-label">成功率</div>
            </div>
            <div class="metric">
                <div class="metric-value">$($KPIMetrics.ProcessedUsers)</div>
                <div class="metric-label">処理済みユーザー</div>
            </div>
            <div class="metric">
                <div class="metric-value">$($KPIMetrics.AverageCompletionRate)%</div>
                <div class="metric-label">平均完了率</div>
            </div>
            <div class="metric">
                <div class="metric-value">$($KPIMetrics.TotalRecords)</div>
                <div class="metric-label">総レコード数</div>
            </div>
        </div>

        <div class="section">
            <h2>🚨 アラート ($($AlertStatus.AlertCount)件)</h2>
"@

            if ($AlertStatus.Alerts.Count -gt 0) {
                foreach ($alert in $AlertStatus.Alerts) {
                    $alertClass = if ($alert.Level -eq "Critical") { "alert-critical" } else { "alert-warning" }
                    $htmlTemplate += "<div class='alert $alertClass'><strong>[$($alert.Level)]</strong> $($alert.Message)</div>`n"
                }
            }
            else {
                $htmlTemplate += "<p class='status-active'>✅ 現在アラートはありません</p>`n"
            }

            $htmlTemplate += @"
        </div>
    </div>
</body>
</html>
"@
            return $htmlTemplate
        }
    }
}

# メイン実行
function Start-MonitoringDashboard {
    Write-Host "月次記録集計システム監視ダッシュボード開始" -ForegroundColor Cyan

    do {
        # データ収集
        $healthStatus = Get-SystemHealthStatus -SiteUrl $SharePointSiteUrl
        $kpiMetrics = Get-KPIMetrics -SiteUrl $SharePointSiteUrl
        $alertStatus = Get-AlertStatus -HealthStatus $healthStatus -KPIMetrics $kpiMetrics

        # 出力
        switch ($OutputFormat) {
            "Console" {
                Clear-Host
                Format-DashboardOutput -HealthStatus $healthStatus -KPIMetrics $kpiMetrics -AlertStatus $alertStatus -Format "Console"
            }
            "JSON" {
                $jsonOutput = Format-DashboardOutput -HealthStatus $healthStatus -KPIMetrics $kpiMetrics -AlertStatus $alertStatus -Format "JSON"
                $jsonOutput | Out-File "./monitoring-dashboard.json" -Force
                Write-Host "JSON出力: ./monitoring-dashboard.json に保存" -ForegroundColor Blue
            }
            "HTML" {
                $htmlOutput = Format-DashboardOutput -HealthStatus $healthStatus -KPIMetrics $kpiMetrics -AlertStatus $alertStatus -Format "HTML"
                $htmlOutput | Out-File "./monitoring-dashboard.html" -Force
                Write-Host "HTML出力: ./monitoring-dashboard.html に保存" -ForegroundColor Blue
            }
        }

        # レポート生成
        if ($GenerateReport) {
            $reportData = @{
                Health      = $healthStatus
                KPIs        = $kpiMetrics
                Alerts      = $alertStatus
                GeneratedAt = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
            }
            $reportData | ConvertTo-Json -Depth 3 | Out-File "./monitoring-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').json" -Force
        }

        if ($ContinuousMonitoring) {
            Write-Host "`n⏰ $RefreshIntervalSeconds 秒後に更新します... (Ctrl+C で停止)" -ForegroundColor Gray
            Start-Sleep -Seconds $RefreshIntervalSeconds
        }

    } while ($ContinuousMonitoring)
}

# 実行
Start-MonitoringDashboard