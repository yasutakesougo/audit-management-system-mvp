param(
    [string]$SiteUrl = "https://isogokatudouhome.sharepoint.com/sites/welfare",
    [switch]$Execute
)

# 対象リストとゾンビ列のパターン（内部名ベース）
$TargetLists = @("SupportRecord_Daily", "Approval_Logs", "UserBenefit_Profile_Ext")
$ZombiePatterns = @(
    "Record_x0020_Date", "Reporter_x0020_Name", "Reporter_x0020_Role", 
    "User_x0020_Count", "Latest_x0020_Version", "Approval_x0020_Status",
    "_x627f__x8a8d__x65e5__x6642_", "_x627f__x8a8d__x8005__x30b3__x30",
    "_x627f__x8a8d__x30e1__x30e2_", "_x627f__x8a8d__x30a2__x30af__x30",
    "Recipient_x0020_Cert_x0020_Numbe"
)

# 認証接続
try {
    Connect-PnPOnline -Url $SiteUrl -Interactive
} catch {
    Write-Host "❌ Connect-PnPOnline が見つかりません。PnP.PowerShell モジュールがインストールされているか確認してください。" -ForegroundColor Red
    return
}

$Candidates = @()

foreach ($ListName in $TargetLists) {
    Write-Host "`n--- リスト [$ListName] をスキャン中 ---" -ForegroundColor Cyan
    try {
        $Fields = Get-PnPField -List $ListName | Where-Object { 
            -not $_.Hidden -and -not $_.ReadOnlyField -and -not $_.Sealed 
        } | Select-Object InternalName, Title, Id

        foreach ($Field in $Fields) {
            $InternalName = $Field.InternalName
            foreach ($Pattern in $ZombiePatterns) {
                $Escaped = [regex]::Escape($Pattern)
                if ($InternalName -match "^${Escaped}\d+$") {
                    $Candidates += [pscustomobject]@{
                        ListName     = $ListName
                        InternalName = $InternalName
                        Title        = $Field.Title
                        FieldId      = $Field.Id
                    }
                    break
                }
            }
        }
    } catch {
        Write-Host "❌ リスト [$ListName] の取得に失敗しました。" -ForegroundColor Red
    }
}

if (-not $Candidates) {
    Write-Host "`n✅ 削除候補は見つかりませんでした。すでにクリーンであるか、SSOTに合致しています。" -ForegroundColor Green
    return
}

# 候補一覧を CSV 保存
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$CsvPath = ".\zombie-fields-scan_$Timestamp.csv"
$Candidates | Sort-Object ListName, InternalName | Export-Csv -NoTypeInformation -Encoding UTF8 -Path $CsvPath
Write-Host "`n📁 削除候補一覧を CSV に保存しました: $CsvPath" -ForegroundColor Yellow
$Candidates | Sort-Object ListName, InternalName | Format-Table -AutoSize

if (-not $Execute) {
    Write-Host "`n⚠️ Dry Run モードです。削除を実行するには [-Execute] を付けて再実行してください。" -ForegroundColor Cyan
    return
}

# 実行フェーズ
Write-Host "`n🚀 削除実行フェーズを開始します..." -ForegroundColor Yellow
foreach ($C in $Candidates | Sort-Object ListName, InternalName) {
    Write-Host "`n⚠️ 削除対象: [$($C.ListName)] $($C.InternalName) (表示名: $($C.Title))" -ForegroundColor Yellow
    $Confirm = Read-Host "削除しますか？ (y/n)"
    if ($Confirm -eq "y") {
        try {
            Remove-PnPField -List $C.ListName -Identity $C.InternalName -Force
            Write-Host "✅ 削除完了" -ForegroundColor Green
        } catch {
            Write-Host "❌ エラー: $($_.Exception.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host "⏩ スキップ" -ForegroundColor Gray
    }
}

Write-Host "`n--- 全作業完了 ---" -ForegroundColor Cyan
