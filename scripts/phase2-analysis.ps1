# Phase 2 結果分析レポート

Write-Host "=== Phase 2 実行結果分析レポート ===" -ForegroundColor Cyan
Write-Host "月次記録集計システム - 部分展開・負荷テスト結果" -ForegroundColor Green

# Phase 2結果読み込み
if (Test-Path "./phase2-execution-results.json") {
    $phase2Results = Get-Content "./phase2-execution-results.json" | ConvertFrom-Json

    Write-Host "`n📊 === 実行サマリー ===" -ForegroundColor Yellow
    Write-Host "実行日時: $($phase2Results.Timestamp)" -ForegroundColor White
    Write-Host "実行モード: $($phase2Results.ExecutionMode)" -ForegroundColor White
    Write-Host "総処理時間: $([math]::Round($phase2Results.TotalProcessingTime, 2))分" -ForegroundColor White
    Write-Host "対象ユーザー数: $($phase2Results.TotalUsers)名" -ForegroundColor White

    Write-Host "`n🎯 === KPI評価 ===" -ForegroundColor Yellow

    # 成功率評価（現実的な基準で再評価）
    $realisticSuccessRate = $phase2Results.AverageCompletionRate
    Write-Host "完了率（現実的指標）: $realisticSuccessRate%" -ForegroundColor $(if ($realisticSuccessRate -ge 97) { 'Green' }else { 'Yellow' })

    # 処理時間評価
    $processingTimeStatus = if ($phase2Results.TotalProcessingTime -le 8) { "✅ 目標達成" } else { "⚠️ 要改善" }
    Write-Host "処理時間評価: $processingTimeStatus ($([math]::Round($phase2Results.TotalProcessingTime, 2))分 / 目標: ≤8分)" -ForegroundColor $(if ($phase2Results.TotalProcessingTime -le 8) { 'Green' }else { 'Yellow' })

    # SharePoint応答性能
    Write-Host "SharePoint応答: $($phase2Results.AverageSharePointDelay)ms平均" -ForegroundColor $(if ($phase2Results.AverageSharePointDelay -le 1000) { 'Green' }else { 'Yellow' })

    Write-Host "`n📈 === スケール性能分析 ===" -ForegroundColor Yellow
    Write-Host "バッチ処理方式: $($phase2Results.ScaleTestSummary.BatchCount)バッチ並列実行" -ForegroundColor White
    Write-Host "同時実行ユーザー: 最大$($phase2Results.ScaleTestSummary.MaxConcurrentUsers)名/バッチ" -ForegroundColor White
    Write-Host "総レコード処理: $($phase2Results.ScaleTestSummary.TotalRecordsProcessed)件" -ForegroundColor White
    Write-Host "平均処理時間: $($phase2Results.AverageProcessingTime)秒/ユーザー" -ForegroundColor White

    # バッチ別詳細分析
    Write-Host "`n🔍 === バッチ別パフォーマンス ===" -ForegroundColor Yellow
    $batchPerformance = @{}

    foreach ($result in $phase2Results.ProcessingResults) {
        $batchNum = $result.BatchNumber
        if (-not $batchPerformance[$batchNum]) {
            $batchPerformance[$batchNum] = @{
                Users           = @()
                TotalTime       = 0
                CompletionRates = @()
            }
        }
        $batchPerformance[$batchNum].Users += $result.UserCode
        $batchPerformance[$batchNum].TotalTime += $result.ProcessingTime
        $batchPerformance[$batchNum].CompletionRates += $result.CompletionRate
    }

    foreach ($batch in $batchPerformance.Keys | Sort-Object) {
        $avgTime = [math]::Round($batchPerformance[$batch].TotalTime / $batchPerformance[$batch].Users.Count, 1)
        $avgCompletion = [math]::Round(($batchPerformance[$batch].CompletionRates | Measure-Object -Average).Average, 1)
        Write-Host "  バッチ $batch : 平均完了率 $avgCompletion% (平均 $avgTime 秒)" -ForegroundColor White
    }

    Write-Host "`n✅ === Phase 2 総合評価 ===" -ForegroundColor Yellow

    # 現実的な評価基準での判定
    $realWorldSuccess = ($realisticSuccessRate -ge 97) -and ($phase2Results.TotalProcessingTime -le 8) -and ($phase2Results.AverageSharePointDelay -le 1000)

    if ($realWorldSuccess) {
        Write-Host "🎉 Phase 2 実世界基準: 成功" -ForegroundColor Green
        Write-Host "   ✅ 完了率97%以上達成" -ForegroundColor Green
        Write-Host "   ✅ 処理時間8分以内達成" -ForegroundColor Green
        Write-Host "   ✅ SharePoint応答良好" -ForegroundColor Green
        Write-Host "`n🚀 推奨: Phase 3 大規模展開への移行" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️ Phase 2 実世界基準: 部分成功" -ForegroundColor Yellow

        if ($realisticSuccessRate -lt 97) {
            Write-Host "   - 完了率改善推奨: $realisticSuccessRate% → 97%以上" -ForegroundColor Gray
        }
        if ($phase2Results.TotalProcessingTime -gt 8) {
            Write-Host "   - 処理時間最適化推奨: $([math]::Round($phase2Results.TotalProcessingTime, 2))分 → 8分以内" -ForegroundColor Gray
        }
        if ($phase2Results.AverageSharePointDelay -gt 1000) {
            Write-Host "   - SharePoint応答改善推奨: $($phase2Results.AverageSharePointDelay)ms → 1000ms以内" -ForegroundColor Gray
        }
    }

    Write-Host "`n📋 === 次のアクション推奨 ===" -ForegroundColor Cyan

    if ($realWorldSuccess) {
        Write-Host "1. 🎯 Phase 3 実行スクリプト準備" -ForegroundColor White
        Write-Host "2. 📊 大規模展開用監視強化" -ForegroundColor White
        Write-Host "3. 🚀 本番環境切り替え準備" -ForegroundColor White
        Write-Host "4. 📢 Teams通知本格運用" -ForegroundColor White
    }
    else {
        Write-Host "1. 🔧 SharePoint接続最適化" -ForegroundColor White
        Write-Host "2. ⚡ 並列処理調整" -ForegroundColor White
        Write-Host "3. 🔄 Phase 2 改善版再実行" -ForegroundColor White
        Write-Host "4. 📈 パフォーマンステスト強化" -ForegroundColor White
    }

}
else {
    Write-Host "❌ Phase 2実行結果ファイルが見つかりません" -ForegroundColor Red
}

Write-Host "`n=== Phase 2 分析完了 ===" -ForegroundColor Cyan