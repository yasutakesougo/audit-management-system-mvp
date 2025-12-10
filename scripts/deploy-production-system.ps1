# deploy-production-system.ps1
# 月次記録集計システム プロダクション展開自動化スクリプト

param(
    [Parameter(Mandatory = $true)]
    [string]$SiteUrl,

    [Parameter(Mandatory = $true)]
    [string]$TeamsWebhookPhase0,

    [Parameter(Mandatory = $true)]
    [string]$TeamsWebhookPilot,

    [Parameter(Mandatory = $true)]
    [string]$TeamsWebhookProduction,

    [Parameter(Mandatory = $true)]
    [string]$AzureFunctionsUrl,

    [ValidateSet("0", "1", "2", "3")]
    [string]$InitialPhase = "0",

    [switch]$CreateLists,
    [switch]$SetupAppSettings,
    [switch]$ConfigureMonitoring,
    [switch]$DeployAll
)

# ログ機能
function Write-DeploymentLog {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $logMessage = "[$timestamp] [$Level] $Message"
    Write-Host $logMessage
    Add-Content -Path "./deployment-$(Get-Date -Format 'yyyyMMdd').log" -Value $logMessage
}

# SharePoint接続
function Connect-ToSharePoint {
    try {
        Write-DeploymentLog "SharePoint への接続を開始..." "INFO"
        Connect-PnPOnline -Url $SiteUrl -Interactive
        Write-DeploymentLog "SharePoint 接続成功" "SUCCESS"
        return $true
    }
    catch {
        Write-DeploymentLog "SharePoint 接続失敗: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# SharePointリスト作成
function New-SharePointLists {
    Write-DeploymentLog "SharePoint リスト作成を開始..." "INFO"

    try {
        # MonthlyRecord_Summary リスト
        if (-not (Get-PnPList -Identity "MonthlyRecord_Summary" -ErrorAction SilentlyContinue)) {
            Write-DeploymentLog "MonthlyRecord_Summary リストを作成中..."

            $monthlyList = New-PnPList -Title "MonthlyRecord_Summary" -Template GenericList

            # フィールド追加
            Add-PnPField -List $monthlyList -DisplayName "UserCode" -InternalName "UserCode" -Type Text -AddToDefaultView -Required
            Add-PnPField -List $monthlyList -DisplayName "YearMonth" -InternalName "YearMonth" -Type Text -AddToDefaultView -Required
            Add-PnPField -List $monthlyList -DisplayName "DisplayName" -InternalName "DisplayName" -Type Text -AddToDefaultView
            Add-PnPField -List $monthlyList -DisplayName "LastUpdated" -InternalName "LastUpdated" -Type DateTime -AddToDefaultView
            Add-PnPField -List $monthlyList -DisplayName "KPI_TotalDays" -InternalName "KPI_TotalDays" -Type Number -AddToDefaultView
            Add-PnPField -List $monthlyList -DisplayName "KPI_PlannedRows" -InternalName "KPI_PlannedRows" -Type Number -AddToDefaultView
            Add-PnPField -List $monthlyList -DisplayName "KPI_CompletedRows" -InternalName "KPI_CompletedRows" -Type Number -AddToDefaultView
            Add-PnPField -List $monthlyList -DisplayName "KPI_InProgressRows" -InternalName "KPI_InProgressRows" -Type Number -AddToDefaultView
            Add-PnPField -List $monthlyList -DisplayName "KPI_EmptyRows" -InternalName "KPI_EmptyRows" -Type Number -AddToDefaultView
            Add-PnPField -List $monthlyList -DisplayName "KPI_SpecialNotes" -InternalName "KPI_SpecialNotes" -Type Number -AddToDefaultView
            Add-PnPField -List $monthlyList -DisplayName "KPI_Incidents" -InternalName "KPI_Incidents" -Type Number -AddToDefaultView
            Add-PnPField -List $monthlyList -DisplayName "CompletionRate" -InternalName "CompletionRate" -Type Number -AddToDefaultView
            Add-PnPField -List $monthlyList -DisplayName "FirstEntryDate" -InternalName "FirstEntryDate" -Type DateTime
            Add-PnPField -List $monthlyList -DisplayName "LastEntryDate" -InternalName "LastEntryDate" -Type DateTime
            Add-PnPField -List $monthlyList -DisplayName "Key" -InternalName "Key" -Type Text -AddToDefaultView -Required

            # Keyフィールドをユニークインデックスに設定
            Set-PnPField -List $monthlyList -Identity "Key" -Values @{ Indexed = $true; EnforceUniqueValues = $true }
            Set-PnPField -List $monthlyList -Identity "UserCode" -Values @{ Indexed = $true }
            Set-PnPField -List $monthlyList -Identity "YearMonth" -Values @{ Indexed = $true }

            Write-DeploymentLog "MonthlyRecord_Summary リスト作成完了" "SUCCESS"
        }

        # AppSettings リスト
        if (-not (Get-PnPList -Identity "AppSettings" -ErrorAction SilentlyContinue)) {
            Write-DeploymentLog "AppSettings リストを作成中..."

            $settingsList = New-PnPList -Title "AppSettings" -Template GenericList

            Add-PnPField -List $settingsList -DisplayName "Key" -InternalName "Key" -Type Text -AddToDefaultView -Required
            Add-PnPField -List $settingsList -DisplayName "Value" -InternalName "Value" -Type Note -AddToDefaultView
            Add-PnPField -List $settingsList -DisplayName "Description" -InternalName "Description" -Type Note -AddToDefaultView
            Add-PnPField -List $settingsList -DisplayName "IsActive" -InternalName "IsActive" -Type Boolean -AddToDefaultView

            # Keyフィールドをユニークインデックスに設定
            Set-PnPField -List $settingsList -Identity "Key" -Values @{ Indexed = $true; EnforceUniqueValues = $true }

            Write-DeploymentLog "AppSettings リスト作成完了" "SUCCESS"
        }

        # Users_Master リスト（存在しない場合）
        if (-not (Get-PnPList -Identity "Users_Master" -ErrorAction SilentlyContinue)) {
            Write-DeploymentLog "Users_Master リストを作成中..."

            $usersList = New-PnPList -Title "Users_Master" -Template GenericList

            Add-PnPField -List $usersList -DisplayName "UserCode" -InternalName "UserCode" -Type Text -AddToDefaultView -Required
            Add-PnPField -List $usersList -DisplayName "UserName" -InternalName "UserName" -Type Text -AddToDefaultView -Required
            Add-PnPField -List $usersList -DisplayName "IsActive" -InternalName "IsActive" -Type Boolean -AddToDefaultView
            Add-PnPField -List $usersList -DisplayName "IsPilot" -InternalName "IsPilot" -Type Boolean -AddToDefaultView
            Add-PnPField -List $usersList -DisplayName "IsPartialDeploy" -InternalName "IsPartialDeploy" -Type Boolean -AddToDefaultView

            Set-PnPField -List $usersList -Identity "UserCode" -Values @{ Indexed = $true; EnforceUniqueValues = $true }

            Write-DeploymentLog "Users_Master リスト作成完了" "SUCCESS"
        }

        Write-DeploymentLog "全SharePointリスト作成完了" "SUCCESS"
        return $true
    }
    catch {
        Write-DeploymentLog "SharePointリスト作成失敗: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# AppSettings 初期設定
function Set-AppSettings {
    param([string]$Phase = "0")

    Write-DeploymentLog "AppSettings Phase $Phase の設定を開始..." "INFO"

    try {
        # フェーズ別設定
        $phaseConfigs = @{
            "0" = @{
                MaxUsers        = "5"
                TimeoutMinutes  = "2"
                TeamsWebhookUrl = $TeamsWebhookPhase0
                Description     = "Phase 0 - Development"
            }
            "1" = @{
                MaxUsers        = "10"
                TimeoutMinutes  = "5"
                TeamsWebhookUrl = $TeamsWebhookPilot
                Description     = "Phase 1 - Pilot"
            }
            "2" = @{
                MaxUsers        = "25"
                TimeoutMinutes  = "8"
                TeamsWebhookUrl = $TeamsWebhookPilot
                Description     = "Phase 2 - Partial Deployment"
            }
            "3" = @{
                MaxUsers        = "45"
                TimeoutMinutes  = "10"
                TeamsWebhookUrl = $TeamsWebhookProduction
                Description     = "Phase 3 - Full Deployment"
            }
        }

        $config = $phaseConfigs[$Phase]

        # 基本設定
        $settings = @(
            @{ Key = "MonthlyAggregation_IsEnabled"; Value = "true"; Description = "システム有効化フラグ" },
            @{ Key = "MonthlyAggregation_Phase"; Value = $Phase; Description = "現在のデプロイフェーズ" },
            @{ Key = "MonthlyAggregation_MaxUsers"; Value = $config.MaxUsers; Description = "最大処理ユーザー数" },
            @{ Key = "MonthlyAggregation_TimeoutMinutes"; Value = $config.TimeoutMinutes; Description = "タイムアウト時間（分）" },
            @{ Key = "MonthlyAggregation_RetryCount"; Value = "3"; Description = "リトライ回数" },
            @{ Key = "MonthlyAggregation_TeamsWebhookUrl"; Value = $config.TeamsWebhookUrl; Description = "Teams通知URL" },
            @{ Key = "MonthlyAggregation_AzureFunctionsUrl"; Value = $AzureFunctionsUrl; Description = "Azure Functions URL" },
            @{ Key = "MonthlyAggregation_LastRunStatus"; Value = "Ready"; Description = "最終実行ステータス" },
            @{ Key = "MonthlyAggregation_EmergencyStop"; Value = "false"; Description = "緊急停止フラグ" },
            @{ Key = "MonthlyAggregation_SuccessThreshold"; Value = "0.99"; Description = "成功率閾値" },
            @{ Key = "MonthlyAggregation_ProcessingTimeThreshold"; Value = "600"; Description = "処理時間閾値（秒）" }
        )

        foreach ($setting in $settings) {
            # 既存設定確認
            $existingItem = Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>$($setting.Key)</Value></Eq></Where></Query></View>" -ErrorAction SilentlyContinue

            if ($existingItem) {
                # 更新
                Set-PnPListItem -List "AppSettings" -Identity $existingItem.Id -Values @{
                    "Value"       = $setting.Value
                    "Description" = $setting.Description
                    "IsActive"    = $true
                }
                Write-DeploymentLog "設定更新: $($setting.Key) = $($setting.Value)"
            }
            else {
                # 新規作成
                Add-PnPListItem -List "AppSettings" -Values @{
                    "Key"         = $setting.Key
                    "Value"       = $setting.Value
                    "Description" = $setting.Description
                    "IsActive"    = $true
                }
                Write-DeploymentLog "設定作成: $($setting.Key) = $($setting.Value)"
            }
        }

        Write-DeploymentLog "AppSettings Phase $Phase 設定完了" "SUCCESS"
        return $true
    }
    catch {
        Write-DeploymentLog "AppSettings 設定失敗: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# 監視設定
function Set-MonitoringConfiguration {
    Write-DeploymentLog "監視設定を開始..." "INFO"

    try {
        # 監視用PowerShellスクリプト作成
        $monitoringScript = @"
# monitoring-tasks.ps1 - 自動生成
param([string]`$SiteUrl = '$SiteUrl')

Connect-PnPOnline -Url `$SiteUrl -Interactive

function Get-SystemHealth {
    `$settings = @{}
    Get-PnPListItem -List 'AppSettings' | ForEach-Object {
        `$settings[`$_.FieldValues['Key']] = `$_.FieldValues['Value']
    }

    return @{
        isEnabled = `$settings['MonthlyAggregation_IsEnabled']
        phase = `$settings['MonthlyAggregation_Phase']
        emergencyStop = `$settings['MonthlyAggregation_EmergencyStop']
        lastStatus = `$settings['MonthlyAggregation_LastRunStatus']
        timestamp = (Get-Date).ToString('o')
    }
}

function Get-KPIReport {
    `$thisMonth = (Get-Date).ToString('yyyy-MM')
    `$records = Get-PnPListItem -List 'MonthlyRecord_Summary' -Query "<View><Query><Where><Contains><FieldRef Name='YearMonth'/><Value Type='Text'>`$thisMonth</Value></Contains></Where></Query></View>"

    `$total = `$records.Count
    `$successful = (`$records | Where-Object { `$_.FieldValues.CompletionRate -ge 0.99 }).Count
    `$successRate = if (`$total -gt 0) { [math]::Round((`$successful / `$total) * 100, 2) } else { 0 }

    return @{
        totalRecords = `$total
        successfulRecords = `$successful
        successRate = `$successRate
        reportDate = (Get-Date).ToString('yyyy-MM-dd')
    }
}

# 実行例
`$health = Get-SystemHealth
`$kpis = Get-KPIReport

Write-Host "システム状態: " -NoNewline
Write-Host (`$health.isEnabled -eq 'true' ? '稼働中' : '停止中') -ForegroundColor (`$health.isEnabled -eq 'true' ? 'Green' : 'Red')
Write-Host "フェーズ: `$(`$health.phase)"
Write-Host "成功率: `$(`$kpis.successRate)%"
"@

        $monitoringScript | Out-File -FilePath "./monitoring-tasks.ps1" -Force
        Write-DeploymentLog "監視スクリプト作成完了: ./monitoring-tasks.ps1" "SUCCESS"

        # 緊急停止スクリプト作成
        $emergencyScript = @"
# emergency-stop.ps1 - 自動生成
param(
    [string]`$SiteUrl = '$SiteUrl',
    [Parameter(Mandatory=`$true)]
    [string]`$Reason
)

Connect-PnPOnline -Url `$SiteUrl -Interactive

# 緊急停止実行
Set-PnPListItem -List 'AppSettings' -Identity (Get-PnPListItem -List 'AppSettings' -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_EmergencyStop</Value></Eq></Where></Query></View>").Id -Values @{ 'Value' = 'true' }
Set-PnPListItem -List 'AppSettings' -Identity (Get-PnPListItem -List 'AppSettings' -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_IsEnabled</Value></Eq></Where></Query></View>").Id -Values @{ 'Value' = 'false' }
Set-PnPListItem -List 'AppSettings' -Identity (Get-PnPListItem -List 'AppSettings' -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_LastRunStatus</Value></Eq></Where></Query></View>").Id -Values @{ 'Value' = "Emergency_Stopped: `$Reason" }

Write-Host "緊急停止が完了しました。理由: `$Reason" -ForegroundColor Red

# Teams通知
`$webhookUrl = (Get-PnPListItem -List 'AppSettings' -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>MonthlyAggregation_TeamsWebhookUrl</Value></Eq></Where></Query></View>").FieldValues.Value

`$message = @{
    '@type' = 'MessageCard'
    '@context' = 'http://schema.org/extensions'
    'themeColor' = 'FF0000'
    'summary' = '🚨 緊急停止通知'
    'sections' = @(
        @{
            'activityTitle' = '月次記録集計システム - 緊急停止'
            'activitySubtitle' = 'システムが緊急停止されました'
            'facts' = @(
                @{ 'name' = '停止時刻'; 'value' = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss') }
                @{ 'name' = '理由'; 'value' = `$Reason }
            )
        }
    )
}

Invoke-RestMethod -Uri `$webhookUrl -Method Post -Body (`$message | ConvertTo-Json -Depth 4) -ContentType 'application/json'
"@

        $emergencyScript | Out-File -FilePath "./emergency-stop.ps1" -Force
        Write-DeploymentLog "緊急停止スクリプト作成完了: ./emergency-stop.ps1" "SUCCESS"

        Write-DeploymentLog "監視設定完了" "SUCCESS"
        return $true
    }
    catch {
        Write-DeploymentLog "監視設定失敗: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# デプロイ検証
function Test-Deployment {
    Write-DeploymentLog "デプロイ検証を開始..." "INFO"

    try {
        $issues = @()

        # SharePointリスト存在確認
        $requiredLists = @("MonthlyRecord_Summary", "AppSettings", "Users_Master")
        foreach ($listName in $requiredLists) {
            if (-not (Get-PnPList -Identity $listName -ErrorAction SilentlyContinue)) {
                $issues += "必須リスト未作成: $listName"
            }
        }

        # AppSettings 設定確認
        $requiredSettings = @("MonthlyAggregation_IsEnabled", "MonthlyAggregation_Phase", "MonthlyAggregation_TeamsWebhookUrl")
        foreach ($settingKey in $requiredSettings) {
            $setting = Get-PnPListItem -List "AppSettings" -Query "<View><Query><Where><Eq><FieldRef Name='Key'/><Value Type='Text'>$settingKey</Value></Eq></Where></Query></View>" -ErrorAction SilentlyContinue
            if (-not $setting) {
                $issues += "必須設定未定義: $settingKey"
            }
        }

        # Azure Functions 接続テスト
        try {
            $testResponse = Invoke-RestMethod -Uri "$AzureFunctionsUrl/api/calculate-working-days?year=2025&month=1" -Method Get -TimeoutSec 10
            if (-not $testResponse.workingDays) {
                $issues += "Azure Functions レスポンス異常"
            }
        }
        catch {
            $issues += "Azure Functions 接続失敗: $($_.Exception.Message)"
        }

        if ($issues.Count -eq 0) {
            Write-DeploymentLog "デプロイ検証: 全てのチェックに合格" "SUCCESS"
            return $true
        }
        else {
            Write-DeploymentLog "デプロイ検証: 以下の問題を検出" "WARNING"
            foreach ($issue in $issues) {
                Write-DeploymentLog "  - $issue" "WARNING"
            }
            return $false
        }
    }
    catch {
        Write-DeploymentLog "デプロイ検証失敗: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# Teams通知送信
function Send-DeploymentNotification {
    param([string]$Status, [string]$Phase)

    $color = switch ($Status) {
        "SUCCESS" { "00FF00" }
        "WARNING" { "FFA500" }
        "ERROR" { "FF0000" }
        default { "0078D4" }
    }

    $webhookUrl = switch ($Phase) {
        "0" { $TeamsWebhookPhase0 }
        "1" { $TeamsWebhookPilot }
        default { $TeamsWebhookProduction }
    }

    $message = @{
        '@type'      = 'MessageCard'
        '@context'   = 'http://schema.org/extensions'
        'themeColor' = $color
        'summary'    = "デプロイ完了通知 - Phase $Phase"
        'sections'   = @(
            @{
                'activityTitle'    = "月次記録集計システム - Phase $Phase デプロイ"
                'activitySubtitle' = "デプロイステータス: $Status"
                'facts'            = @(
                    @{ 'name' = 'デプロイ時刻'; 'value' = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss') }
                    @{ 'name' = 'フェーズ'; 'value' = "Phase $Phase" }
                    @{ 'name' = 'ステータス'; 'value' = $Status }
                )
            }
        )
    }

    try {
        Invoke-RestMethod -Uri $webhookUrl -Method Post -Body ($message | ConvertTo-Json -Depth 4) -ContentType 'application/json'
        Write-DeploymentLog "Teams通知送信完了" "SUCCESS"
    }
    catch {
        Write-DeploymentLog "Teams通知送信失敗: $($_.Exception.Message)" "ERROR"
    }
}

# メイン実行
function Invoke-ProductionDeployment {
    Write-DeploymentLog "=== 月次記録集計システム プロダクション展開開始 ===" "INFO"
    Write-DeploymentLog "対象サイト: $SiteUrl" "INFO"
    Write-DeploymentLog "初期フェーズ: Phase $InitialPhase" "INFO"

    $overallSuccess = $true

    # SharePoint接続
    if (-not (Connect-ToSharePoint)) {
        return $false
    }

    # SharePointリスト作成
    if ($CreateLists -or $DeployAll) {
        if (-not (New-SharePointLists)) {
            $overallSuccess = $false
        }
    }

    # AppSettings設定
    if ($SetupAppSettings -or $DeployAll) {
        if (-not (Set-AppSettings -Phase $InitialPhase)) {
            $overallSuccess = $false
        }
    }

    # 監視設定
    if ($ConfigureMonitoring -or $DeployAll) {
        if (-not (Set-MonitoringConfiguration)) {
            $overallSuccess = $false
        }
    }

    # デプロイ検証
    $validationResult = Test-Deployment
    if (-not $validationResult) {
        Write-DeploymentLog "デプロイ検証で問題が検出されましたが、処理を続行します" "WARNING"
    }

    # 結果通知
    $finalStatus = if ($overallSuccess -and $validationResult) { "SUCCESS" } elseif ($overallSuccess) { "WARNING" } else { "ERROR" }
    Send-DeploymentNotification -Status $finalStatus -Phase $InitialPhase

    Write-DeploymentLog "=== デプロイ完了 ===" "INFO"
    Write-DeploymentLog "最終ステータス: $finalStatus" "INFO"

    if ($overallSuccess) {
        Write-DeploymentLog "次のステップ:" "INFO"
        Write-DeploymentLog "1. Power Automate フローのインポートと設定" "INFO"
        Write-DeploymentLog "2. 初回実行テストの実施" "INFO"
        Write-DeploymentLog "3. 監視ダッシュボードの確認" "INFO"
        Write-DeploymentLog "4. 運用チームへの引き継ぎ" "INFO"
    }

    return $overallSuccess
}

# スクリプト実行
Invoke-ProductionDeployment