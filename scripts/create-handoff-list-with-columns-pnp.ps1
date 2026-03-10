param(
    [string]$SiteUrl = "https://isogokatudouhome.sharepoint.com/sites/welfare",
    [string]$ListTitle = "Handoff"
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
        [string]$Type,           # Text | Note | Choice | DateTime | Boolean | Number
        [bool]$Required = $false,
        [string[]]$Choices = @(),
        [string]$DefaultValue = $null,
        [string]$Format = $null  # DateOnly (DateTime 用)
    )

    $existing = Get-PnPField -List $ListTitle -Identity $InternalName -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "  ✓ $InternalName — 既存 ($($existing.TypeAsString))" -ForegroundColor DarkGreen
        return
    }

    Write-Host -NoNewline "  📝 $InternalName ($Type)... "

    switch ($Type) {
        'Text' {
            Add-PnPField -List $ListTitle `
                -DisplayName $DisplayName `
                -InternalName $InternalName `
                -Type Text `
                -Required:$Required | Out-Null
        }
        'Note' {
            $reqStr = if ($Required) { 'TRUE' } else { 'FALSE' }
            $xml = "<Field Type='Note' DisplayName='$DisplayName' " +
                   "StaticName='$InternalName' Name='$InternalName' " +
                   "Required='$reqStr' RichText='TRUE' NumLines='6' />"
            Add-PnPFieldFromXml -List $ListTitle -FieldXml $xml | Out-Null
        }
        'Choice' {
            Add-PnPField -List $ListTitle `
                -DisplayName $DisplayName `
                -InternalName $InternalName `
                -Type Choice `
                -Required:$Required `
                -Choices $Choices | Out-Null
        }
        'DateTime' {
            Add-PnPField -List $ListTitle `
                -DisplayName $DisplayName `
                -InternalName $InternalName `
                -Type DateTime `
                -Required:$Required | Out-Null

            if ($Format -eq 'DateOnly') {
                Set-PnPField -List $ListTitle -Identity $InternalName `
                    -Values @{ DisplayFormat = [Microsoft.SharePoint.Client.DateTimeFieldFormatType]::DateOnly } | Out-Null
            }
        }
        'Boolean' {
            Add-PnPField -List $ListTitle `
                -DisplayName $DisplayName `
                -InternalName $InternalName `
                -Type Boolean | Out-Null

            if ($null -ne $DefaultValue) {
                Set-PnPField -List $ListTitle -Identity $InternalName `
                    -Values @{ DefaultValue = $DefaultValue } | Out-Null
            }
        }
        'Number' {
            Add-PnPField -List $ListTitle `
                -DisplayName $DisplayName `
                -InternalName $InternalName `
                -Type Number `
                -Required:$Required | Out-Null
        }
    }

    Write-Host "✓" -ForegroundColor Green
}

# ── メイン処理 ───────────────────────────────────────────
try {
    Write-Step "PnP.PowerShell モジュール確認"
    if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
        Write-Host "PnP.PowerShell が見つからないためインストールします..." -ForegroundColor Yellow
        Install-Module PnP.PowerShell -Scope CurrentUser -Force
    }
    Import-Module PnP.PowerShell -ErrorAction Stop

    Write-Step "SharePoint に Device Login で接続"
    Write-Host "ブラウザまたは認証コード入力が求められたら完了してください。" -ForegroundColor Yellow
    Connect-PnPOnline -Url $SiteUrl -DeviceLogin

    # ── Step 1: リスト作成 ─────────────────────────────
    Write-Step "Step 1: リスト作成 — $ListTitle"
    $existingList = Get-PnPList | Where-Object { $_.Title -eq $ListTitle }
    if ($null -ne $existingList) {
        Write-Host "  ✓ リスト既存 (Id: $($existingList.Id)) — 列追加を続行" -ForegroundColor Green
    }
    else {
        New-PnPList -Title $ListTitle -Template GenericList -OnQuickLaunch | Out-Null
        Write-Host "  ✓ リスト作成完了" -ForegroundColor Green
    }

    # ── Step 2: 必須列 ────────────────────────────────
    Write-Step "Step 2: 必須列の追加 (11列)"

    # 1. Title — 既存列の表示名変更
    Write-Host -NoNewline "  📝 Title (表示名→件名)... "
    try {
        Set-PnPField -List $ListTitle -Identity "Title" -Values @{ Title = "件名" } | Out-Null
        Write-Host "✓" -ForegroundColor Green
    }
    catch { Write-Host "⚠ スキップ" -ForegroundColor Yellow }

    # 2. Message
    Add-FieldSafe -InternalName "Message"         -DisplayName "内容"               -Type "Note"   -Required $true

    # 3. UserCode
    Add-FieldSafe -InternalName "UserCode"        -DisplayName "利用者コード"        -Type "Text"   -Required $true

    # 4. UserDisplayName
    Add-FieldSafe -InternalName "UserDisplayName" -DisplayName "利用者名"            -Type "Text"   -Required $true

    # 5. Category
    Add-FieldSafe -InternalName "Category" -DisplayName "区分" -Type "Choice" -Required $true `
        -Choices @("体調", "行動面", "家族連絡", "支援の工夫", "良かったこと", "事故・ヒヤリ", "その他")

    # 6. Severity
    Add-FieldSafe -InternalName "Severity" -DisplayName "重要度" -Type "Choice" -Required $true `
        -Choices @("通常", "要注意", "重要")

    # 7. Status
    Add-FieldSafe -InternalName "Status" -DisplayName "状態" -Type "Choice" -Required $true `
        -Choices @("未対応", "対応中", "対応済", "確認済", "明日へ持越", "完了")

    # 8. TimeBand
    Add-FieldSafe -InternalName "TimeBand" -DisplayName "時間帯" -Type "Choice" -Required $true `
        -Choices @("朝", "午前", "午後", "夕方")

    # 9. CreatedAt
    Add-FieldSafe -InternalName "CreatedAt"      -DisplayName "作成日時（アプリ）" -Type "DateTime" -Required $true

    # 10. CreatedByName
    Add-FieldSafe -InternalName "CreatedByName"  -DisplayName "作成者名"           -Type "Text"    -Required $true

    # 11. IsDraft
    Add-FieldSafe -InternalName "IsDraft"        -DisplayName "下書き"             -Type "Boolean" -DefaultValue "0"

    # ── Step 3: 任意列 ────────────────────────────────
    Write-Step "Step 3: 任意列の追加 (7列)"

    # 12. MeetingSessionKey
    Add-FieldSafe -InternalName "MeetingSessionKey" -DisplayName "MeetingSessionKey" -Type "Text"

    # 13. SourceType
    Add-FieldSafe -InternalName "SourceType"        -DisplayName "SourceType"        -Type "Text"

    # 14. SourceId
    Add-FieldSafe -InternalName "SourceId"          -DisplayName "SourceId"          -Type "Number"

    # 15. SourceUrl
    Add-FieldSafe -InternalName "SourceUrl"         -DisplayName "SourceUrl"         -Type "Text"

    # 16. SourceKey
    Add-FieldSafe -InternalName "SourceKey"         -DisplayName "SourceKey"         -Type "Text"

    # 17. SourceLabel
    Add-FieldSafe -InternalName "SourceLabel"       -DisplayName "SourceLabel"       -Type "Text"

    # 18. CarryOverDate
    Add-FieldSafe -InternalName "CarryOverDate"     -DisplayName "CarryOverDate"     -Type "DateTime" -Format "DateOnly"

    # ── Step 4: 確認レポート ──────────────────────────
    Write-Step "Step 4: 列の確認レポート"

    $targetCols = @(
        'Title', 'Message', 'UserCode', 'UserDisplayName',
        'Category', 'Severity', 'Status', 'TimeBand',
        'CreatedAt', 'CreatedByName', 'IsDraft',
        'MeetingSessionKey', 'SourceType', 'SourceId',
        'SourceUrl', 'SourceKey', 'SourceLabel', 'CarryOverDate'
    )

    $fields = Get-PnPField -List $ListTitle | Where-Object { $_.InternalName -in $targetCols }

    Write-Host ""
    Write-Host ("  {0,-22} {1,-14} {2,-5} {3}" -f "InternalName", "Type", "Req", "DisplayName") -ForegroundColor DarkGray
    Write-Host ("  {0,-22} {1,-14} {2,-5} {3}" -f ("─" * 20), ("─" * 12), ("─" * 3), ("─" * 16)) -ForegroundColor DarkGray

    $missing = @()
    foreach ($c in $targetCols) {
        $f = $fields | Where-Object { $_.InternalName -eq $c }
        if ($f) {
            $reqMark = if ($f.Required) { "✓" } else { "-" }
            Write-Host ("  {0,-22} {1,-14} {2,-5} {3}" -f $f.InternalName, $f.TypeAsString, $reqMark, $f.Title)
        }
        else {
            $missing += $c
            Write-Host ("  {0,-22} {1}" -f $c, "⚠ NOT FOUND") -ForegroundColor Red
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

    # ── 完了 ──────────────────────────────────────────
    Write-Step "完了"
    Write-Host "処理が正常終了しました。" -ForegroundColor Green
    Write-Host ""
    Write-Host "次のステップ:" -ForegroundColor Cyan
    Write-Host "  1. /admin/debug/smoke-test で存在確認"
    Write-Host "  2. /handoff-timeline で Read / Create / Update を再確認"
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
