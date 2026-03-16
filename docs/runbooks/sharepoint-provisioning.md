# SharePoint リスト プロビジョニング手順

> **目的**: 監査で特定された不足リストの新規作成と、既存リストのインデックス・制約設定
> **作成日**: 2026-03-16
> **前提**: PnP PowerShell モジュール + サイト管理者権限

---

## 0. 接続

```powershell
# PnP モジュール（未インストールの場合）
Install-Module PnP.PowerShell -Scope CurrentUser -Force

# サイト接続
$siteUrl = "https://<tenant>.sharepoint.com/sites/<site>"
Connect-PnPOnline -Url $siteUrl -Interactive

Write-Host "✅ Connected to $siteUrl" -ForegroundColor Green
```

---

## 1. Holiday_Master（祝日・休業日マスタ）

```powershell
Write-Host "`n=== Holiday_Master ===" -ForegroundColor Cyan

if (-not (Get-PnPList -Identity "Holiday_Master" -ErrorAction SilentlyContinue)) {
    New-PnPList -Title "Holiday_Master" -Description "祝日・休業日マスタ（年度管理）" -Template GenericList

    # Title → 祝日名（表示名変更のみ）
    Set-PnPField -List "Holiday_Master" -Identity "Title" -Values @{Title="祝日名"}

    # 列追加
    Add-PnPField -List "Holiday_Master" -DisplayName "日付" -InternalName "Date" `
        -Type DateTime -Required `
        -AddToDefaultView
    Add-PnPField -List "Holiday_Master" -DisplayName "ラベル" -InternalName "Label" `
        -Type Text -Required `
        -AddToDefaultView
    Add-PnPField -List "Holiday_Master" -DisplayName "種別" -InternalName "Type" `
        -Type Choice -Choices "national","company","special" `
        -AddToDefaultView
    Add-PnPField -List "Holiday_Master" -DisplayName "年度" -InternalName "FiscalYear" `
        -Type Text `
        -AddToDefaultView
    Add-PnPField -List "Holiday_Master" -DisplayName "有効" -InternalName "IsActive" `
        -Type Boolean `
        -AddToDefaultView

    # Date 列にインデックス
    Set-PnPField -List "Holiday_Master" -Identity "Date" -Values @{Indexed=$true}

    Write-Host "  ✅ Holiday_Master 作成完了" -ForegroundColor Green
} else {
    Write-Host "  ⏭️ Holiday_Master は既に存在します" -ForegroundColor Yellow
}
```

### 初期データ投入（2025-2026年度 国民の祝日）

```powershell
$holidays = @(
    # 2025年
    @{ Title="元日"; Date="2025-01-01"; Label="元日"; Type="national"; FiscalYear="2024"; IsActive=$true },
    @{ Title="成人の日"; Date="2025-01-13"; Label="成人の日"; Type="national"; FiscalYear="2024"; IsActive=$true },
    @{ Title="建国記念の日"; Date="2025-02-11"; Label="建国記念の日"; Type="national"; FiscalYear="2024"; IsActive=$true },
    @{ Title="天皇誕生日"; Date="2025-02-23"; Label="天皇誕生日"; Type="national"; FiscalYear="2024"; IsActive=$true },
    @{ Title="振替休日"; Date="2025-02-24"; Label="振替休日"; Type="national"; FiscalYear="2024"; IsActive=$true },
    @{ Title="春分の日"; Date="2025-03-20"; Label="春分の日"; Type="national"; FiscalYear="2024"; IsActive=$true },
    @{ Title="昭和の日"; Date="2025-04-29"; Label="昭和の日"; Type="national"; FiscalYear="2025"; IsActive=$true },
    @{ Title="憲法記念日"; Date="2025-05-03"; Label="憲法記念日"; Type="national"; FiscalYear="2025"; IsActive=$true },
    @{ Title="みどりの日"; Date="2025-05-04"; Label="みどりの日"; Type="national"; FiscalYear="2025"; IsActive=$true },
    @{ Title="こどもの日"; Date="2025-05-05"; Label="こどもの日"; Type="national"; FiscalYear="2025"; IsActive=$true },
    @{ Title="振替休日"; Date="2025-05-06"; Label="振替休日"; Type="national"; FiscalYear="2025"; IsActive=$true },
    @{ Title="海の日"; Date="2025-07-21"; Label="海の日"; Type="national"; FiscalYear="2025"; IsActive=$true },
    @{ Title="山の日"; Date="2025-08-11"; Label="山の日"; Type="national"; FiscalYear="2025"; IsActive=$true },
    @{ Title="敬老の日"; Date="2025-09-15"; Label="敬老の日"; Type="national"; FiscalYear="2025"; IsActive=$true },
    @{ Title="秋分の日"; Date="2025-09-23"; Label="秋分の日"; Type="national"; FiscalYear="2025"; IsActive=$true },
    @{ Title="スポーツの日"; Date="2025-10-13"; Label="スポーツの日"; Type="national"; FiscalYear="2025"; IsActive=$true },
    @{ Title="文化の日"; Date="2025-11-03"; Label="文化の日"; Type="national"; FiscalYear="2025"; IsActive=$true },
    @{ Title="勤労感謝の日"; Date="2025-11-23"; Label="勤労感謝の日"; Type="national"; FiscalYear="2025"; IsActive=$true },
    @{ Title="振替休日"; Date="2025-11-24"; Label="振替休日"; Type="national"; FiscalYear="2025"; IsActive=$true },
    # 2026年
    @{ Title="元日"; Date="2026-01-01"; Label="元日"; Type="national"; FiscalYear="2025"; IsActive=$true },
    @{ Title="成人の日"; Date="2026-01-12"; Label="成人の日"; Type="national"; FiscalYear="2025"; IsActive=$true },
    @{ Title="建国記念の日"; Date="2026-02-11"; Label="建国記念の日"; Type="national"; FiscalYear="2025"; IsActive=$true },
    @{ Title="天皇誕生日"; Date="2026-02-23"; Label="天皇誕生日"; Type="national"; FiscalYear="2025"; IsActive=$true },
    @{ Title="春分の日"; Date="2026-03-20"; Label="春分の日"; Type="national"; FiscalYear="2025"; IsActive=$true },
    @{ Title="昭和の日"; Date="2026-04-29"; Label="昭和の日"; Type="national"; FiscalYear="2026"; IsActive=$true },
    @{ Title="憲法記念日"; Date="2026-05-03"; Label="憲法記念日"; Type="national"; FiscalYear="2026"; IsActive=$true },
    @{ Title="みどりの日"; Date="2026-05-04"; Label="みどりの日"; Type="national"; FiscalYear="2026"; IsActive=$true },
    @{ Title="こどもの日"; Date="2026-05-05"; Label="こどもの日"; Type="national"; FiscalYear="2026"; IsActive=$true },
    @{ Title="振替休日"; Date="2026-05-06"; Label="振替休日"; Type="national"; FiscalYear="2026"; IsActive=$true },
    @{ Title="海の日"; Date="2026-07-20"; Label="海の日"; Type="national"; FiscalYear="2026"; IsActive=$true },
    @{ Title="山の日"; Date="2026-08-11"; Label="山の日"; Type="national"; FiscalYear="2026"; IsActive=$true },
    @{ Title="敬老の日"; Date="2026-09-21"; Label="敬老の日"; Type="national"; FiscalYear="2026"; IsActive=$true },
    @{ Title="秋分の日"; Date="2026-09-23"; Label="秋分の日"; Type="national"; FiscalYear="2026"; IsActive=$true },
    @{ Title="スポーツの日"; Date="2026-10-12"; Label="スポーツの日"; Type="national"; FiscalYear="2026"; IsActive=$true },
    @{ Title="文化の日"; Date="2026-11-03"; Label="文化の日"; Type="national"; FiscalYear="2026"; IsActive=$true },
    @{ Title="勤労感謝の日"; Date="2026-11-23"; Label="勤労感謝の日"; Type="national"; FiscalYear="2026"; IsActive=$true }
)

$count = 0
foreach ($h in $holidays) {
    Add-PnPListItem -List "Holiday_Master" -Values $h | Out-Null
    $count++
}
Write-Host "  ✅ $count 件の祝日データを投入しました" -ForegroundColor Green
```

---

## 2. PdfOutput_Log（帳票出力監査ログ）

```powershell
Write-Host "`n=== PdfOutput_Log ===" -ForegroundColor Cyan

if (-not (Get-PnPList -Identity "PdfOutput_Log" -ErrorAction SilentlyContinue)) {
    New-PnPList -Title "PdfOutput_Log" -Description "帳票出力の監査証跡ログ" -Template GenericList

    # Title は複合キー: {OutputType}_{UserCode}_{TargetPeriod}
    Set-PnPField -List "PdfOutput_Log" -Identity "Title" -Values @{Title="出力キー"}

    # 列追加
    Add-PnPField -List "PdfOutput_Log" -DisplayName "出力種別" -InternalName "OutputType" `
        -Type Choice -Choices "monthly-report","service-provision","isp","billing","attendance" `
        -Required -AddToDefaultView
    Add-PnPField -List "PdfOutput_Log" -DisplayName "利用者コード" -InternalName "UserCode" `
        -Type Text -AddToDefaultView
    Add-PnPField -List "PdfOutput_Log" -DisplayName "出力日" -InternalName "OutputDate" `
        -Type DateTime -Required -AddToDefaultView
    Add-PnPField -List "PdfOutput_Log" -DisplayName "対象期間" -InternalName "TargetPeriod" `
        -Type Text -AddToDefaultView
    Add-PnPField -List "PdfOutput_Log" -DisplayName "ファイル名" -InternalName "FileName" `
        -Type Text -AddToDefaultView
    Add-PnPField -List "PdfOutput_Log" -DisplayName "ファイルURL" -InternalName "FileUrl" `
        -Type Text
    Add-PnPField -List "PdfOutput_Log" -DisplayName "出力者" -InternalName "OutputBy" `
        -Type Text -Required -AddToDefaultView
    Add-PnPField -List "PdfOutput_Log" -DisplayName "ステータス" -InternalName "Status" `
        -Type Choice -Choices "success","failed","pending" `
        -Required -AddToDefaultView
    Add-PnPField -List "PdfOutput_Log" -DisplayName "エラーメッセージ" -InternalName "ErrorMessage" `
        -Type Note
    Add-PnPField -List "PdfOutput_Log" -DisplayName "出力元" -InternalName "Source" `
        -Type Choice -Choices "power-automate","manual","scheduled" `
        -AddToDefaultView

    # インデックス
    Set-PnPField -List "PdfOutput_Log" -Identity "OutputType" -Values @{Indexed=$true}
    Set-PnPField -List "PdfOutput_Log" -Identity "UserCode" -Values @{Indexed=$true}
    Set-PnPField -List "PdfOutput_Log" -Identity "OutputDate" -Values @{Indexed=$true}

    Write-Host "  ✅ PdfOutput_Log 作成完了" -ForegroundColor Green
} else {
    Write-Host "  ⏭️ PdfOutput_Log は既に存在します" -ForegroundColor Yellow
}
```

---

## 3. 既存リストへのインデックス追加

```powershell
Write-Host "`n=== インデックス追加 ===" -ForegroundColor Cyan

$indexTargets = @(
    @{ List = "DailyActivityRecords"; Fields = @("UserCode", "RecordDate") },
    @{ List = "SupportRecord_Daily"; Fields = @("cr013_personId", "cr013_date") },
    @{ List = "AttendanceDaily"; Fields = @("UserCode", "RecordDate", "Key") },
    @{ List = "ServiceProvisionRecords"; Fields = @("EntryKey", "UserCode", "RecordDate") },
    @{ List = "Transport_Log"; Fields = @("UserCode", "RecordDate", "Title") },
    @{ List = "SupportProcedureRecord_Daily"; Fields = @("UserCode", "RecordDate") },
    @{ List = "Schedules"; Fields = @("Date", "MonthKey", "ServiceType") }
)

$totalAdded = 0
$totalSkipped = 0
$totalFailed = 0

foreach ($target in $indexTargets) {
    Write-Host "`n  --- $($target.List) ---" -ForegroundColor White

    foreach ($fieldName in $target.Fields) {
        try {
            $field = Get-PnPField -List $target.List -Identity $fieldName -ErrorAction Stop

            if (-not $field.Indexed) {
                Set-PnPField -List $target.List -Identity $fieldName -Values @{Indexed=$true}
                Write-Host "    ✅ Indexed: $fieldName" -ForegroundColor Green
                $totalAdded++
            } else {
                Write-Host "    ✅ Already indexed: $fieldName" -ForegroundColor DarkGreen
                $totalSkipped++
            }
        } catch {
            Write-Host "    ⚠️ Failed: $fieldName — $_" -ForegroundColor Yellow
            $totalFailed++
        }
    }
}

Write-Host "`n  📊 Summary: Added=$totalAdded Skipped=$totalSkipped Failed=$totalFailed" -ForegroundColor Cyan
```

---

## 4. Users_Master.UserID ユニーク制約

```powershell
Write-Host "`n=== Users_Master.UserID ユニーク制約 ===" -ForegroundColor Cyan

# Step 1: 重複チェック
$items = Get-PnPListItem -List "Users_Master" -Fields "UserID" -PageSize 500
$grouped = $items | Group-Object { $_["UserID"] } | Where-Object { $_.Count -gt 1 }

if ($grouped) {
    Write-Host "  ❌ 重複 UserID が見つかりました:" -ForegroundColor Red
    foreach ($dup in $grouped) {
        Write-Host "    - UserID='$($dup.Name)': $($dup.Count) 件" -ForegroundColor Red
        foreach ($item in $dup.Group) {
            Write-Host "      ID=$($item.Id) FullName=$($item['FullName'])" -ForegroundColor DarkRed
        }
    }
    Write-Host "  ⚠️ 重複を解消してからユニーク制約を追加してください" -ForegroundColor Yellow
} else {
    Write-Host "  ✅ 重複なし — ユニーク制約を追加します" -ForegroundColor Green

    Set-PnPField -List "Users_Master" -Identity "UserID" -Values @{
        EnforceUniqueValues = $true
        Indexed = $true
    }
    Write-Host "  ✅ UserID にユニーク制約を追加しました" -ForegroundColor Green
}
```

---

## 5. BillingOrders GUID 確認

```powershell
Write-Host "`n=== BillingOrders GUID 確認 ===" -ForegroundColor Cyan

# サイト2 (別サイト) への接続が必要な場合
# Connect-PnPOnline -Url "https://<tenant>.sharepoint.com/sites/2" -Interactive

try {
    $billingList = Get-PnPList | Where-Object { $_.Title -like "*Billing*" -or $_.Title -like "*Order*" }
    if ($billingList) {
        foreach ($list in $billingList) {
            Write-Host "  📋 $($list.Title): $($list.Id)" -ForegroundColor Green
        }
        Write-Host ""
        Write-Host "  上記の GUID を .env.production の VITE_SP_LIST_BILLING_ORDERS に設定してください" -ForegroundColor Yellow
    } else {
        Write-Host "  ⚠️ Billing 関連リストが見つかりません。リスト名を確認してください。" -ForegroundColor Yellow
        Write-Host "  全リスト一覧:" -ForegroundColor White
        Get-PnPList | Format-Table Title, Id -AutoSize
    }
} catch {
    Write-Host "  ❌ エラー: $_" -ForegroundColor Red
}
```

---

## 6. 検証スクリプト

全ての設定が正しく完了したことを確認するスクリプト:

```powershell
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " SharePoint 監査是正 — 検証" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$checks = @()

# リスト存在チェック
$requiredLists = @(
    "Users_Master", "Staff_Master", "Org_Master", "Holiday_Master",
    "SupportRecord_Daily", "DailyActivityRecords", "ServiceProvisionRecords",
    "ActivityDiary", "Daily_Attendance", "AttendanceUsers", "AttendanceDaily",
    "Staff_Attendance", "Transport_Log", "Schedules",
    "MeetingSessions", "MeetingSteps", "MeetingMinutes",
    "Handoff", "SupportTemplates", "PlanGoals", "SupportPlans",
    "Iceberg_PDCA", "Iceberg_Analysis",
    "ISP_Master", "SupportPlanningSheet_Master", "SupportProcedureRecord_Daily",
    "Compliance_CheckRules", "Diagnostics_Reports",
    "FormsResponses_Tokusei", "NurseObservations", "OfficialForms",
    "PdfOutput_Log"
)

$existCount = 0
$missingCount = 0
foreach ($listName in $requiredLists) {
    $list = Get-PnPList -Identity $listName -ErrorAction SilentlyContinue
    if ($list) {
        $existCount++
    } else {
        Write-Host "  ❌ Missing: $listName" -ForegroundColor Red
        $missingCount++
    }
}
Write-Host "  リスト存在チェック: $existCount / $($requiredLists.Count) 存在" -ForegroundColor $(if ($missingCount -eq 0) { "Green" } else { "Yellow" })

# UserID ユニーク制約チェック
try {
    $userIdField = Get-PnPField -List "Users_Master" -Identity "UserID" -ErrorAction Stop
    if ($userIdField.EnforceUniqueValues) {
        Write-Host "  ✅ Users_Master.UserID: ユニーク制約あり" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️ Users_Master.UserID: ユニーク制約なし" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ❌ Users_Master.UserID: 確認失敗" -ForegroundColor Red
}

# インデックスチェック（主要なもの）
$indexChecks = @(
    @{ List = "DailyActivityRecords"; Field = "UserCode" },
    @{ List = "DailyActivityRecords"; Field = "RecordDate" },
    @{ List = "ServiceProvisionRecords"; Field = "EntryKey" }
)

foreach ($check in $indexChecks) {
    try {
        $field = Get-PnPField -List $check.List -Identity $check.Field -ErrorAction Stop
        if ($field.Indexed) {
            Write-Host "  ✅ $($check.List).$($check.Field): Indexed" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️ $($check.List).$($check.Field): NOT Indexed" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  ❌ $($check.List).$($check.Field): 確認失敗" -ForegroundColor Red
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " 検証完了" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
```
