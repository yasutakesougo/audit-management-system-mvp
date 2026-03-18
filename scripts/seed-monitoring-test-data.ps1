#!/usr/bin/env pwsh
<#
.SYNOPSIS
    ブラウザ実地確認用のテストデータを MonitoringMeetings リストに1件投入する。
    Phase 2 の CRUD 検証で delete 済みのため、再投入用。

.DESCRIPTION
    userId は実際のユーザーマスタに存在する値を使うこと。
    -UserId パラメータで指定可能。デフォルトは U-001。

.EXAMPLE
    pwsh ./scripts/seed-monitoring-test-data.ps1
    pwsh ./scripts/seed-monitoring-test-data.ps1 -UserId "U-002"
#>

param(
    [string]$SiteUrl   = "https://isogokatudouhome.sharepoint.com/sites/welfare",
    [string]$ListTitle = "MonitoringMeetings",
    [string]$ClientId  = "ef918e68-3755-4ce9-9dac-af0495f89450",
    [string]$UserId    = "U-001",
    [string]$IspId     = "ISP-001"
)

$ErrorActionPreference = "Stop"

# ───────────────────────────────────────────
# Connect
# ───────────────────────────────────────────

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host "MonitoringMeetings テストデータ投入" -ForegroundColor Magenta
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host "  対象リスト: $ListTitle"
Write-Host "  userId: $UserId"
Write-Host ""

Write-Host "🔗 SharePoint 接続中..." -ForegroundColor Yellow
Connect-PnPOnline -Url $SiteUrl -Interactive -ClientId $ClientId
Write-Host "  ✅ 接続完了" -ForegroundColor Green

# ───────────────────────────────────────────
# 既存データ確認
# ───────────────────────────────────────────

Write-Host ""
Write-Host "🔍 既存データ確認..." -ForegroundColor Yellow
$existing = Get-PnPListItem -List $ListTitle -Query @"
<View>
    <Query>
        <Where>
            <Eq>
                <FieldRef Name='cr014_userId' />
                <Value Type='Text'>$UserId</Value>
            </Eq>
        </Where>
    </Query>
</View>
"@

if ($existing -and $existing.Count -gt 0) {
    Write-Host "  ⚠️  既に $($existing.Count) 件のデータが存在します" -ForegroundColor Yellow
    foreach ($item in $existing) {
        Write-Host "    - Id=$($item.Id), Title=$($item['Title']), meetingDate=$($item['cr014_meetingDate'])" -ForegroundColor Gray
    }
    $answer = Read-Host "  上書きしますか? (y/n)"
    if ($answer -ne "y") {
        Write-Host "  中断しました。" -ForegroundColor Yellow
        exit 0
    }
    # 既存を削除
    foreach ($item in $existing) {
        Remove-PnPListItem -List $ListTitle -Identity $item.Id -Force
        Write-Host "  🗑️  Id=$($item.Id) 削除" -ForegroundColor Gray
    }
}

# ───────────────────────────────────────────
# テストデータ
# ───────────────────────────────────────────

$recordId   = "monitoring-test-" + (Get-Date -Format "yyyyMMddHHmm")
$meetingDate = "2026-03-15"
$title      = "${UserId}_${meetingDate}"

$attendeesJson = @(
    @{ name = "山田太郎"; role = "サービス管理責任者"; organization = "テスト事業所" }
    @{ name = "鈴木花子"; role = "相談支援専門員"; organization = "テスト相談支援センター" }
    @{ name = "田中次郎"; role = "利用者本人"; organization = "" }
) | ConvertTo-Json -Compress

$goalEvaluationsJson = @(
    @{
        goalText         = "日中活動への参加"
        achievementLevel = "achieved"
        comment          = "毎日プログラムに参加できている。特に創作活動への意欲が高い。"
    }
    @{
        goalText         = "身だしなみの自立"
        achievementLevel = "partial"
        comment          = "声掛けがあれば自分で整えられる。朝の準備は改善傾向。"
    }
    @{
        goalText         = "コミュニケーション力の向上"
        achievementLevel = "partial"
        comment          = "グループ活動で発言が増えた。1対1は良好。"
    }
) | ConvertTo-Json -Compress

$decisionsJson = @(
    "支援計画の継続"
    "次回3ヶ月後にモニタリング実施"
    "日中活動プログラムの拡充を検討"
) | ConvertTo-Json -Compress

# ───────────────────────────────────────────
# 投入
# ───────────────────────────────────────────

Write-Host ""
Write-Host "📝 テストデータ投入中..." -ForegroundColor Yellow

$values = @{
    Title                       = $title
    cr014_recordId              = $recordId
    cr014_userId                = $UserId
    cr014_ispId                 = $IspId
    cr014_planningSheetId       = ""
    cr014_meetingType            = "regular"
    cr014_meetingDate            = $meetingDate
    cr014_venue                 = "会議室A"
    cr014_attendeesJson         = $attendeesJson
    cr014_goalEvaluationsJson   = $goalEvaluationsJson
    cr014_overallAssessment     = "全体として良好に経過している。日中活動への意欲が特に高く、身だしなみの自立も改善傾向にある。"
    cr014_userFeedback          = "作業が楽しい。もっといろいろやりたい。"
    cr014_familyFeedback        = "家でも自分で服を選ぶようになった。ありがたい。"
    cr014_planChangeDecision    = "no_change"
    cr014_changeReason          = ""
    cr014_decisionsJson         = $decisionsJson
    cr014_nextMonitoringDate    = "2026-06-15"
    cr014_recordedBy            = "佐藤太郎"
    cr014_recordedAt            = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
}

$item = Add-PnPListItem -List $ListTitle -Values $values
Write-Host "  ✅ 投入完了" -ForegroundColor Green
Write-Host "    Id:         $($item.Id)" -ForegroundColor Cyan
Write-Host "    Title:      $title" -ForegroundColor Cyan
Write-Host "    recordId:   $recordId" -ForegroundColor Cyan

# ───────────────────────────────────────────
# 読み戻し確認
# ───────────────────────────────────────────

Write-Host ""
Write-Host "🔍 読み戻し確認..." -ForegroundColor Yellow
$readBack = Get-PnPListItem -List $ListTitle -Id $item.Id

$checks = @(
    @{ Label = "Title 一致";       OK = ($readBack['Title'] -eq $title) }
    @{ Label = "userId 一致";      OK = ($readBack['cr014_userId'] -eq $UserId) }
    @{ Label = "meetingDate 一致"; OK = ($readBack['cr014_meetingDate'] -eq $meetingDate) }
    @{ Label = "overallAssessment 非空"; OK = ($readBack['cr014_overallAssessment'].Length -gt 0) }
    @{ Label = "goalEvaluationsJson 非空"; OK = ($readBack['cr014_goalEvaluationsJson'].Length -gt 0) }
)

$allOk = $true
foreach ($c in $checks) {
    if ($c.OK) {
        Write-Host "    ✅ $($c.Label)" -ForegroundColor Green
    } else {
        Write-Host "    ❌ $($c.Label)" -ForegroundColor Red
        $allOk = $false
    }
}

Write-Host ""
if ($allOk) {
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host "✅ テストデータ投入完了・読み戻し成功" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host ""
    Write-Host "次のステップ:" -ForegroundColor Yellow
    Write-Host "  1. ブラウザで http://localhost:5173/support-planning-sheet/new を開く"
    Write-Host "  2. ユーザー選択で $UserId を選択"
    Write-Host "  3. 「モニタリングから反映」ボタンが有効になることを確認"
    Write-Host "  4. ダイアログを開いてテストデータが表示されることを確認"
    Write-Host "  5. 「反映」をクリックしてフォームに値が入ることを確認"
    Write-Host ""
} else {
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
    Write-Host "❌ テストデータ読み戻しに失敗。リストの列定義を確認してください。" -ForegroundColor Red
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
}
