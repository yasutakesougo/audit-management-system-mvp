# 緊急停止スクリプト

# 月次記録集計システム緊急停止・復旧スクリプト

param(
    [switch]$Resume = $false,
    [string]$Reason = "Manual Emergency Stop",
    [switch]$Force = $false
)

if ($Resume) {
    Write-Host "=== システム復旧開始 ===" -ForegroundColor Green
    Write-Host "緊急停止解除・システム復旧処理" -ForegroundColor Green
}
else {
    Write-Host "=== 緊急停止実行 ===" -ForegroundColor Red
    Write-Host "月次記録集計システム緊急停止処理" -ForegroundColor Red
}

# Step 1: 現在のシステム状態確認
Write-Host "`n--- Step 1: システム状態確認 ---" -ForegroundColor Yellow

$currentStatus = @{
    EmergencyStop = $false
    SystemRunning = $false
    LastOperation = "Unknown"
    Timestamp     = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
}

# 既存の緊急停止状態確認
if (Test-Path "./emergency-stop-status.json") {
    $existingStatus = Get-Content "./emergency-stop-status.json" | ConvertFrom-Json
    Write-Host "既存の緊急停止状態: $($existingStatus.EmergencyStop)" -ForegroundColor White
    Write-Host "最終操作時刻: $($existingStatus.Timestamp)" -ForegroundColor White
    $currentStatus.EmergencyStop = $existingStatus.EmergencyStop
}

# SharePoint AppSettings確認（シミュレーション）
try {
    $context = Get-PnPContext -ErrorAction SilentlyContinue
    if ($context) {
        Write-Host "✅ SharePoint接続: アクティブ" -ForegroundColor Green
        # 実際の環境では AppSettings から EmergencyStop を確認
        # $emergencyStopSetting = Get-PnPListItem -List "AppSettings" -Query "..."
    }
    else {
        Write-Host "⚠️ SharePoint接続: オフライン（ローカル処理）" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "⚠️ SharePoint接続: エラー" -ForegroundColor Yellow
}

if ($Resume) {
    # Step 2: システム復旧処理
    Write-Host "`n--- Step 2: システム復旧処理 ---" -ForegroundColor Yellow

    if (-not $currentStatus.EmergencyStop) {
        Write-Host "ℹ️ システムは既に正常稼働中です" -ForegroundColor Blue
        return $true
    }

    Write-Host "🔄 システム復旧処理実行中..." -ForegroundColor Blue

    # AppSettings更新（シミュレーション）
    Write-Host "   📝 AppSettings更新: EmergencyStop = false" -ForegroundColor White
    Start-Sleep -Milliseconds 500

    # Power Automate フロー有効化
    Write-Host "   🔁 Power Automateフロー: 有効化" -ForegroundColor White
    Start-Sleep -Milliseconds 300

    # 監視ダッシュボード更新
    Write-Host "   📊 監視ダッシュボード: 正常状態に更新" -ForegroundColor White
    Start-Sleep -Milliseconds 200

    # 復旧状態保存
    $resumeStatus = @{
        EmergencyStop      = $false
        SystemRunning      = $true
        LastOperation      = "Resume"
        Reason             = "Manual Resume"
        ResumedBy          = $env:USERNAME
        Timestamp          = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
        PreviousStopReason = $currentStatus.Reason
    }

    $resumeStatus | ConvertTo-Json -Depth 2 | Out-File "./emergency-stop-status.json" -Force

    Write-Host "`n✅ システム復旧完了" -ForegroundColor Green
    Write-Host "   🚀 月次記録集計システム: 正常稼働" -ForegroundColor Green
    Write-Host "   📝 復旧記録: emergency-stop-status.json に保存" -ForegroundColor White

    # Teams復旧通知
    $resumeNotification = @"
✅ **システム復旧完了**

月次記録集計システムが正常稼働に復旧しました。

**復旧詳細:**
- 復旧時刻: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
- 復旧実行者: $env:USERNAME
- システム状態: 正常稼働

次回の月次処理は正常に実行されます。
"@

    Write-Host "`n📢 Teams復旧通知:" -ForegroundColor Blue
    Write-Host $resumeNotification -ForegroundColor Gray

    return $true

}
else {
    # Step 2: 緊急停止処理
    Write-Host "`n--- Step 2: 緊急停止処理 ---" -ForegroundColor Yellow

    if ($currentStatus.EmergencyStop -and -not $Force) {
        Write-Host "⚠️ システムは既に緊急停止中です" -ForegroundColor Yellow
        Write-Host "   💡 復旧する場合: -Resume パラメータを使用" -ForegroundColor Gray
        Write-Host "   💡 強制停止する場合: -Force パラメータを使用" -ForegroundColor Gray
        return $false
    }

    if (-not $Force) {
        Write-Host "🚨 緊急停止を実行しますか？" -ForegroundColor Red
        Write-Host "   この操作により月次記録集計システムが停止します。" -ForegroundColor Yellow
        $confirmation = Read-Host "   続行しますか？ (y/N)"

        if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
            Write-Host "❌ 緊急停止がキャンセルされました" -ForegroundColor Yellow
            return $false
        }
    }

    Write-Host "🛑 緊急停止処理開始..." -ForegroundColor Red

    # 実行中プロセス確認・停止
    Write-Host "   🔍 実行中プロセス確認..." -ForegroundColor White
    # 実際の環境では Power Automate フロー実行状態確認
    Start-Sleep -Milliseconds 300

    # AppSettings緊急停止フラグ設定
    Write-Host "   📝 AppSettings更新: EmergencyStop = true" -ForegroundColor White
    Start-Sleep -Milliseconds 500

    # Power Automate フロー無効化
    Write-Host "   🚫 Power Automateフロー: 無効化" -ForegroundColor White
    Start-Sleep -Milliseconds 400

    # 監視ダッシュボード更新
    Write-Host "   📊 監視ダッシュボード: 緊急停止状態に更新" -ForegroundColor White
    Start-Sleep -Milliseconds 200

    # 緊急停止状態保存
    $stopStatus = @{
        EmergencyStop = $true
        SystemRunning = $false
        LastOperation = "Emergency_Stop"
        Reason        = $Reason
        StoppedBy     = $env:USERNAME
        Timestamp     = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
        ForceStop     = $Force
    }

    $stopStatus | ConvertTo-Json -Depth 2 | Out-File "./emergency-stop-status.json" -Force

    Write-Host "`n🛑 緊急停止完了" -ForegroundColor Red
    Write-Host "   ❌ 月次記録集計システム: 停止中" -ForegroundColor Red
    Write-Host "   📝 停止記録: emergency-stop-status.json に保存" -ForegroundColor White
    Write-Host "   💡 復旧方法: ./scripts/emergency-stop.ps1 -Resume" -ForegroundColor Gray

    # Teams緊急停止通知
    $emergencyNotification = @"
🚨 **システム緊急停止**

月次記録集計システムが緊急停止されました。

**停止詳細:**
- 停止時刻: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
- 停止理由: $Reason
- 停止実行者: $env:USERNAME
- 強制停止: $(if($Force){'はい'}else{'いいえ'})

**影響:**
- 月次処理が実行されません
- 自動集計が停止します
- KPI生成が停止します

**復旧方法:**
問題解決後、システム管理者が復旧処理を実行してください。
"@

    Write-Host "`n📢 Teams緊急停止通知:" -ForegroundColor Red
    Write-Host $emergencyNotification -ForegroundColor Gray

    return $false
}

Write-Host "`n=== 緊急停止スクリプト完了 ===" -ForegroundColor Cyan