# ============================================================================
# provision-monitoring-meetings-pnp.ps1
#
# MonitoringMeetings リストを SharePoint Online に作成する PnP PowerShell スクリプト。
# 冪等: 既存リスト/列があればスキップ。初回・再実行どちらでも安全。
#
# 使い方:
#   .\provision-monitoring-meetings-pnp.ps1
#   .\provision-monitoring-meetings-pnp.ps1 -SiteUrl "https://tenant.sharepoint.com/sites/dev"
#
# 前提:
#   - PnP.PowerShell モジュールがインストール済み
#   - SharePoint サイトへの管理者権限
#
# 設計書: docs/monitoring-meetings-sp-schema.md
# Field Map: src/sharepoint/fields/monitoringMeetingFields.ts
# ============================================================================

param(
    [string]$SiteUrl = "https://isogokatudouhome.sharepoint.com/sites/welfare",
    [string]$ListTitle = "MonitoringMeetings",
    [string]$ClientId = "ef918e68-3755-4ce9-9dac-af0495f89450"
)

$ErrorActionPreference = "Stop"

function Write-Step($message) {
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor DarkGray
    Write-Host $message -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor DarkGray
}

# ── Idempotent な列追加ヘルパー ──────────────────────────
function Add-FieldSafe {
    param(
        [string]$InternalName,
        [string]$DisplayName,
        [string]$Type,           # Text | Note
        [bool]$Required = $false,
        [int]$MaxLength = 255    # Text 型のみ
    )

    $existing = Get-PnPField -List $ListTitle -Identity $InternalName -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "  ✓ $InternalName — 既存 ($($existing.TypeAsString))" -ForegroundColor DarkGreen
        return
    }

    Write-Host -NoNewline "  📝 $InternalName ($Type)... "

    switch ($Type) {
        'Text' {
            $reqStr = if ($Required) { 'TRUE' } else { 'FALSE' }
            $xml = "<Field Type='Text' DisplayName='$DisplayName' " +
                   "StaticName='$InternalName' Name='$InternalName' " +
                   "Required='$reqStr' MaxLength='$MaxLength' />"
            Add-PnPFieldFromXml -List $ListTitle -FieldXml $xml | Out-Null
        }
        'Note' {
            $reqStr = if ($Required) { 'TRUE' } else { 'FALSE' }
            $xml = "<Field Type='Note' DisplayName='$DisplayName' " +
                   "StaticName='$InternalName' Name='$InternalName' " +
                   "Required='$reqStr' RichText='FALSE' NumLines='6' " +
                   "AppendOnly='FALSE' />"
            Add-PnPFieldFromXml -List $ListTitle -FieldXml $xml | Out-Null
        }
    }

    Write-Host "✓" -ForegroundColor Green
}

# ── Idempotent なインデックス追加ヘルパー ─────────────────
function Add-IndexSafe {
    param(
        [string]$FieldInternalName
    )

    Write-Host -NoNewline "  🔍 $FieldInternalName... "

    try {
        $field = Get-PnPField -List $ListTitle -Identity $FieldInternalName -ErrorAction Stop
        if ($field.Indexed) {
            Write-Host "✓ (既存)" -ForegroundColor DarkGreen
            return
        }
        Set-PnPField -List $ListTitle -Identity $FieldInternalName -Values @{ Indexed = $true } | Out-Null
        Write-Host "✓" -ForegroundColor Green
    }
    catch {
        Write-Host "⚠ スキップ ($($_.Exception.Message))" -ForegroundColor Yellow
    }
}

# ── メイン処理 ───────────────────────────────────────────
try {
    Write-Step "PnP.PowerShell モジュール確認"
    if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
        Write-Host "PnP.PowerShell が見つからないためインストールします..." -ForegroundColor Yellow
        Install-Module PnP.PowerShell -Scope CurrentUser -Force
    }
    Import-Module PnP.PowerShell -ErrorAction Stop

    Write-Step "SharePoint に Interactive で接続"
    Write-Host "ブラウザで認証画面が開いたらログインしてください。" -ForegroundColor Yellow
    Connect-PnPOnline -Url $SiteUrl -Interactive -ClientId $ClientId

    # ═══════════════════════════════════════════════════════
    # Step 1: リスト作成
    # ═══════════════════════════════════════════════════════
    Write-Step "Step 1: リスト作成 — $ListTitle"
    $existingList = Get-PnPList | Where-Object { $_.Title -eq $ListTitle }
    if ($null -ne $existingList) {
        Write-Host "  ✓ リスト既存 (Id: $($existingList.Id)) — 列追加を続行" -ForegroundColor Green
    }
    else {
        New-PnPList -Title $ListTitle -Template GenericList -OnQuickLaunch | Out-Null
        Write-Host "  ✓ リスト作成完了" -ForegroundColor Green
    }

    # ═══════════════════════════════════════════════════════
    # Step 2: 主キー・参照列 (3列)
    # ═══════════════════════════════════════════════════════
    Write-Step "Step 2: 主キー・参照列 (3列 + Title 更新)"

    # Title — 表示名変更
    Write-Host -NoNewline "  📝 Title (表示名→レコード概要)... "
    try {
        Set-PnPField -List $ListTitle -Identity "Title" -Values @{ Title = "レコード概要" } | Out-Null
        Write-Host "✓" -ForegroundColor Green
    }
    catch { Write-Host "⚠ スキップ" -ForegroundColor Yellow }

    Add-FieldSafe -InternalName "cr014_recordId"         -DisplayName "レコードID"        -Type "Text" -Required $true
    Add-FieldSafe -InternalName "cr014_userId"            -DisplayName "利用者ID"          -Type "Text" -Required $true
    Add-FieldSafe -InternalName "cr014_ispId"             -DisplayName "ISP ID"            -Type "Text" -Required $true
    Add-FieldSafe -InternalName "cr014_planningSheetId"   -DisplayName "計画シートID"      -Type "Text" -Required $false

    # ═══════════════════════════════════════════════════════
    # Step 3: 会議情報列 (3列)
    # ═══════════════════════════════════════════════════════
    Write-Step "Step 3: 会議情報列 (3列)"

    Add-FieldSafe -InternalName "cr014_meetingType"       -DisplayName "会議種別"          -Type "Text" -Required $true  -MaxLength 50
    Add-FieldSafe -InternalName "cr014_meetingDate"       -DisplayName "開催日"            -Type "Text" -Required $true  -MaxLength 10
    Add-FieldSafe -InternalName "cr014_venue"             -DisplayName "開催場所"          -Type "Text" -Required $true

    # ═══════════════════════════════════════════════════════
    # Step 4: 参加者 JSON 列 (1列)
    # ═══════════════════════════════════════════════════════
    Write-Step "Step 4: 参加者 JSON 列 (1列)"

    Add-FieldSafe -InternalName "cr014_attendeesJson"     -DisplayName "参加者JSON"        -Type "Note" -Required $true

    # ═══════════════════════════════════════════════════════
    # Step 5: 評価内容列 (4列)
    # ═══════════════════════════════════════════════════════
    Write-Step "Step 5: 評価内容列 (4列)"

    Add-FieldSafe -InternalName "cr014_goalEvaluationsJson" -DisplayName "目標評価JSON"    -Type "Note" -Required $true
    Add-FieldSafe -InternalName "cr014_overallAssessment"   -DisplayName "総合所見"        -Type "Note" -Required $true
    Add-FieldSafe -InternalName "cr014_userFeedback"        -DisplayName "利用者の意向"    -Type "Note" -Required $true
    Add-FieldSafe -InternalName "cr014_familyFeedback"      -DisplayName "家族の意向"      -Type "Note" -Required $false

    # ═══════════════════════════════════════════════════════
    # Step 6: 決定事項列 (4列)
    # ═══════════════════════════════════════════════════════
    Write-Step "Step 6: 決定事項列 (4列)"

    Add-FieldSafe -InternalName "cr014_planChangeDecision"  -DisplayName "計画変更判定"    -Type "Text" -Required $true  -MaxLength 50
    Add-FieldSafe -InternalName "cr014_changeReason"        -DisplayName "変更理由"        -Type "Note" -Required $false
    Add-FieldSafe -InternalName "cr014_decisionsJson"       -DisplayName "決定事項JSON"    -Type "Note" -Required $false
    Add-FieldSafe -InternalName "cr014_nextMonitoringDate"  -DisplayName "次回モニタリング日" -Type "Text" -Required $true -MaxLength 10

    # ═══════════════════════════════════════════════════════
    # Step 7: メタ情報列 (2列)
    # ═══════════════════════════════════════════════════════
    Write-Step "Step 7: メタ情報列 (2列)"

    Add-FieldSafe -InternalName "cr014_recordedBy"         -DisplayName "記録者"           -Type "Text" -Required $true
    Add-FieldSafe -InternalName "cr014_recordedAt"         -DisplayName "記録日時"         -Type "Text" -Required $true  -MaxLength 40

    # ═══════════════════════════════════════════════════════
    # Step 8: インデックス作成 (4本)
    # ═══════════════════════════════════════════════════════
    Write-Step "Step 8: インデックス作成 (4本)"

    Add-IndexSafe -FieldInternalName "cr014_recordId"
    Add-IndexSafe -FieldInternalName "cr014_userId"
    Add-IndexSafe -FieldInternalName "cr014_ispId"
    Add-IndexSafe -FieldInternalName "cr014_meetingDate"

    # ═══════════════════════════════════════════════════════
    # Step 9: 確認レポート
    # ═══════════════════════════════════════════════════════
    Write-Step "Step 9: 列の確認レポート"

    $targetCols = @(
        'Title',
        'cr014_recordId', 'cr014_userId', 'cr014_ispId', 'cr014_planningSheetId',
        'cr014_meetingType', 'cr014_meetingDate', 'cr014_venue',
        'cr014_attendeesJson',
        'cr014_goalEvaluationsJson', 'cr014_overallAssessment', 'cr014_userFeedback', 'cr014_familyFeedback',
        'cr014_planChangeDecision', 'cr014_changeReason', 'cr014_decisionsJson', 'cr014_nextMonitoringDate',
        'cr014_recordedBy', 'cr014_recordedAt'
    )

    $fields = Get-PnPField -List $ListTitle | Where-Object { $_.InternalName -in $targetCols }

    Write-Host ""
    Write-Host ("  {0,-30} {1,-10} {2,-5} {3,-5} {4}" -f "InternalName", "Type", "Req", "Idx", "DisplayName") -ForegroundColor DarkGray
    Write-Host ("  {0,-30} {1,-10} {2,-5} {3,-5} {4}" -f ("─" * 28), ("─" * 8), ("─" * 3), ("─" * 3), ("─" * 16)) -ForegroundColor DarkGray

    $missing = @()
    foreach ($c in $targetCols) {
        $f = $fields | Where-Object { $_.InternalName -eq $c }
        if ($f) {
            $reqMark = if ($f.Required) { "✓" } else { "-" }
            $idxMark = if ($f.Indexed) { "✓" } else { "-" }
            Write-Host ("  {0,-30} {1,-10} {2,-5} {3,-5} {4}" -f $f.InternalName, $f.TypeAsString, $reqMark, $idxMark, $f.Title)
        }
        else {
            $missing += $c
            Write-Host ("  {0,-30} {1}" -f $c, "⚠ NOT FOUND") -ForegroundColor Red
        }
    }

    if ($missing.Count -gt 0) {
        Write-Host ""
        Write-Host "  ⚠ 未作成列: $($missing -join ', ')" -ForegroundColor Red
    }
    else {
        Write-Host ""
        Write-Host "  ✅ 全 $($targetCols.Count) 列が確認できました" -ForegroundColor Green
    }

    # ═══════════════════════════════════════════════════════
    # 完了
    # ═══════════════════════════════════════════════════════
    Write-Step "完了"
    Write-Host "MonitoringMeetings リストの作成が正常終了しました。" -ForegroundColor Green
    Write-Host ""
    Write-Host "次のステップ:" -ForegroundColor Cyan
    Write-Host "  1. SP 管理画面でリスト・列・インデックスを目視確認"
    Write-Host "  2. アプリで createMonitoringMeetingRepository('sharepoint', { spClient }) を使って動作確認"
    Write-Host "  3. 検証項目:"
    Write-Host "     - create → listByUser で保存データが返るか"
    Write-Host "     - meetingDate がゼロパディング保存されるか"
    Write-Host "     - JSON列が壊れず往復できるか"
    Write-Host "     - save() が create / update を正しく分岐するか"
    Write-Host "     - delete() が冪等に動作するか"
    Write-Host ""
}
catch {
    Write-Host ""
    Write-Host "エラーが発生しました。" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red

    if ($_.Exception.Message -match "AADSTS|authentication|login|consent|client") {
        Write-Host ""
        Write-Host "認証まわりの問題の可能性があります。" -ForegroundColor Yellow
        Write-Host "- Device Login の認証を最後まで完了したか"
        Write-Host "- テナント側で PnP PowerShell 利用が制限されていないか"
        Write-Host "- 必要なら専用 App Registration + ClientId 指定に切り替える"
    }

    exit 1
}
finally {
    try { Disconnect-PnPOnline | Out-Null } catch {}
}
