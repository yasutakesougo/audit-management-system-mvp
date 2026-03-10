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

    Write-Step "既存リスト確認"
    $existingList = Get-PnPList | Where-Object { $_.Title -eq $ListTitle }

    if ($null -ne $existingList) {
        Write-Host "既にリスト '$ListTitle' は存在します。" -ForegroundColor Green
        Write-Host "Id: $($existingList.Id)"
    }
    else {
        Write-Step "リスト作成"
        New-PnPList -Title $ListTitle -Template GenericList -OnQuickLaunch | Out-Null
        Write-Host "リスト '$ListTitle' を作成しました。" -ForegroundColor Green

        $createdList = Get-PnPList | Where-Object { $_.Title -eq $ListTitle }
        if ($null -ne $createdList) {
            Write-Host "Id: $($createdList.Id)"
        }
    }

    Write-Step "表示用: 非表示でないリスト一覧"
    Get-PnPList |
        Where-Object { -not $_.Hidden } |
        Sort-Object Title |
        Select-Object Title, Id |
        Format-Table -AutoSize

    Write-Step "完了"
    Write-Host "処理が正常終了しました。" -ForegroundColor Green
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
    try {
        Disconnect-PnPOnline | Out-Null
    }
    catch {
    }
}
