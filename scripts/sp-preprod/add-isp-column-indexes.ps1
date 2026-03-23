<#
.SYNOPSIS
    SharePoint リスト列インデックス追加スクリプト
.DESCRIPTION
    ISP 関連リスト (SupportPlanningSheet_Master, IspRecommendationDecisions) の
    UserId / GoalId 列にインデックスを設定し、5000 アイテム超のリストで
    $filter クエリがスロットリングされるのを防ぎます。
    
    参照: Nightly Report 2026-03-23 P1, Issue #1225
.PARAMETER SiteUrl
    対象 SharePoint サイトの URL
.EXAMPLE
    .\add-isp-column-indexes.ps1 -SiteUrl "https://contoso.sharepoint.com/sites/Audit"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$SiteUrl
)

$ErrorActionPreference = "Stop"

# ─── 接続 ─────────────────────────────────────────────────
Write-Host "🔗 Connecting to SharePoint: $SiteUrl" -ForegroundColor Cyan
Connect-PnPOnline -Url $SiteUrl -Interactive

# ─── 対象定義 ──────────────────────────────────────────────
$targets = @(
    @{ List = "SupportPlanningSheet_Master"; Fields = @("UserId", "GoalId") },
    @{ List = "IspRecommendationDecisions";  Fields = @("UserId", "GoalId") }
)

# ─── インデックス追加 ─────────────────────────────────────
foreach ($target in $targets) {
    $listTitle = $target.List
    $fields    = $target.Fields

    Write-Host ""
    Write-Host "📋 Processing list: $listTitle" -ForegroundColor Yellow

    # リスト存在確認
    try {
        $list = Get-PnPList -Identity $listTitle -ErrorAction Stop
        Write-Host "  ✅ List found (ItemCount: $($list.ItemCount))"
    }
    catch {
        Write-Host "  ⚠️  List not found: $listTitle — skipping" -ForegroundColor DarkYellow
        continue
    }

    foreach ($fieldName in $fields) {
        Write-Host "  🔧 Adding index on column: $fieldName" -NoNewline

        try {
            # 既存インデックスチェック
            $field = Get-PnPField -List $listTitle -Identity $fieldName -ErrorAction Stop
            
            if ($field.Indexed) {
                Write-Host " → already indexed ✅" -ForegroundColor Green
            }
            else {
                Set-PnPField -List $listTitle -Identity $fieldName -Values @{ Indexed = $true } -ErrorAction Stop
                Write-Host " → indexed ✅" -ForegroundColor Green
            }
        }
        catch {
            Write-Host " → FAILED ❌" -ForegroundColor Red
            Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# ─── 検証 ─────────────────────────────────────────────────
Write-Host ""
Write-Host "🔍 Verification:" -ForegroundColor Cyan

foreach ($target in $targets) {
    $listTitle = $target.List
    try {
        $list = Get-PnPList -Identity $listTitle -ErrorAction SilentlyContinue
        if (-not $list) { continue }

        foreach ($fieldName in $target.Fields) {
            $field = Get-PnPField -List $listTitle -Identity $fieldName -ErrorAction SilentlyContinue
            $status = if ($field -and $field.Indexed) { "✅ Indexed" } else { "❌ Not Indexed" }
            Write-Host "  $listTitle.$fieldName → $status"
        }
    }
    catch {
        Write-Host "  $listTitle → verification skipped" -ForegroundColor DarkYellow
    }
}

Write-Host ""
Write-Host "🎉 Done! Index setup complete." -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "  1. Verify in SharePoint site settings → Site columns" 
Write-Host "  2. Close Issue #1225"
Write-Host ""
