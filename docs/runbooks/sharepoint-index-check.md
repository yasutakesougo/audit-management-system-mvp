# SharePoint インデックス列 確認・追加手順

> **目的**: 5,000件ビューしきい値超過を防止するため、高増加リストのフィルター列にインデックスを設定する
> **作成日**: 2026-03-16
> **由来**: SharePoint 構成監査 P1-1

---

## 1. 対象リスト

| リスト名 | 年間想定件数 | 必須インデックス列 | 優先度 |
|---|---|---|---|
| DailyActivityRecords | ~60,000 | `UserCode`, `RecordDate` | 🔴 最優先 |
| schedule_events (Schedules) | ~30,000 | `EventDate`, `EndDate`, `cr014_dayKey` | 🔴 最優先 |
| DriftEventsLog_v2 | ~100,000 | `Detected_At`, `listName`, `resolved` | 🔴 最優先 |
| SupportRecord_Daily | ~7,500 | `cr013_personId`, `cr013_date` | 🟡 |
| AttendanceDaily | ~7,500 | `UserCode`, `RecordDate`, `Key` | 🟡 |
| ServiceProvisionRecords | ~7,500 | `EntryKey`, `UserCode`, `RecordDate` | 🟡 |
| Transport_Log | ~15,000 | `UserCode`, `RecordDate`, `Title` | 🟡 |
| SupportProcedureRecord_Daily | 可変 | `UserCode`, `RecordDate` | 🟡 |

---

## 2. 確認手順（PnP PowerShell）

### 前提

```powershell
# PnP PowerShell モジュールのインストール（未インストールの場合）
Install-Module PnP.PowerShell -Scope CurrentUser

# サイトに接続
Connect-PnPOnline -Url "https://<tenant>.sharepoint.com/sites/<site>" -Interactive
```

### 全対象リストのインデックス列を一括確認

```powershell
$targetLists = @(
  @{ Name = 'DailyActivityRecords'; RequiredIndexes = @('UserCode', 'RecordDate') },
  @{ Name = 'schedule_events';      RequiredIndexes = @('EventDate', 'EndDate', 'cr014_dayKey') },
  @{ Name = 'DriftEventsLog_v2';    RequiredIndexes = @('Detected_At', 'listName', 'resolved') },
  @{ Name = 'SupportRecord_Daily';  RequiredIndexes = @('cr013_personId', 'cr013_date') },
  @{ Name = 'AttendanceDaily';      RequiredIndexes = @('UserCode', 'RecordDate', 'Key') },
  @{ Name = 'ServiceProvisionRecords'; RequiredIndexes = @('EntryKey', 'UserCode', 'RecordDate') },
  @{ Name = 'Transport_Log';        RequiredIndexes = @('UserCode', 'RecordDate', 'Title') },
  @{ Name = 'SupportProcedureRecord_Daily'; RequiredIndexes = @('UserCode', 'RecordDate') }
)

foreach ($list in $targetLists) {
  Write-Host "`n=== $($list.Name) ===" -ForegroundColor Cyan

  try {
    $fields = Get-PnPField -List $list.Name -ErrorAction Stop
    $indexedFields = $fields | Where-Object { $_.Indexed -eq $true }

    if ($indexedFields) {
      Write-Host "  ✅ Indexed columns:" -ForegroundColor Green
      $indexedFields | ForEach-Object {
        Write-Host "    - $($_.InternalName) ($($_.Title))"
      }
    } else {
      Write-Host "  ⚠️ No indexed columns found" -ForegroundColor Yellow
    }

    # 不足チェック
    foreach ($required in $list.RequiredIndexes) {
      $field = $fields | Where-Object { $_.InternalName -eq $required }
      if (-not $field) {
        Write-Host "  ❌ Column '$required' not found in list" -ForegroundColor Red
      } elseif (-not $field.Indexed) {
        Write-Host "  ⚠️ Column '$required' exists but NOT indexed" -ForegroundColor Yellow
      }
    }
  } catch {
    Write-Host "  ❌ List not found or access denied: $_" -ForegroundColor Red
  }
}
```

---

## 3. インデックス追加手順

### 個別追加

```powershell
# 例: DailyActivityRecords にインデックスを追加
Set-PnPField -List "DailyActivityRecords" -Identity "UserCode" -Values @{Indexed=$true}
Set-PnPField -List "DailyActivityRecords" -Identity "RecordDate" -Values @{Indexed=$true}
```

### 全対象リストに一括追加

```powershell
foreach ($list in $targetLists) {
  Write-Host "`n=== $($list.Name) ===" -ForegroundColor Cyan

  foreach ($fieldName in $list.RequiredIndexes) {
    try {
      $field = Get-PnPField -List $list.Name -Identity $fieldName -ErrorAction Stop

      if (-not $field.Indexed) {
        Set-PnPField -List $list.Name -Identity $fieldName -Values @{Indexed=$true}
        Write-Host "  ✅ Indexed: $fieldName" -ForegroundColor Green
      } else {
        Write-Host "  ✅ Already indexed: $fieldName" -ForegroundColor DarkGreen
      }
    } catch {
      Write-Host "  ⚠️ Skipped: $fieldName — $_" -ForegroundColor Yellow
    }
  }
}
```

---

## 4. Users_Master.UserID ユニーク制約（P1-4）

### 確認

```powershell
$field = Get-PnPField -List "Users_Master" -Identity "UserID"
Write-Host "UserID.EnforceUniqueValues = $($field.EnforceUniqueValues)"
Write-Host "UserID.Indexed = $($field.Indexed)"
```

### 追加（重複データがないことを確認後）

```powershell
# ⚠️ 既存データに重複がある場合はエラーになります
# 先に重複確認を行ってください

# 重複確認
$items = Get-PnPListItem -List "Users_Master" -Fields "UserID"
$duplicates = $items | Group-Object { $_["UserID"] } | Where-Object { $_.Count -gt 1 }
if ($duplicates) {
  Write-Host "❌ Duplicate UserIDs found:" -ForegroundColor Red
  $duplicates | ForEach-Object { Write-Host "  - $($_.Name): $($_.Count) items" }
  Write-Host "Resolve duplicates before adding unique constraint" -ForegroundColor Yellow
} else {
  Write-Host "✅ No duplicates found. Adding unique constraint..." -ForegroundColor Green
  Set-PnPField -List "Users_Master" -Identity "UserID" -Values @{
    EnforceUniqueValues = $true
    Indexed = $true
  }
  Write-Host "✅ Unique constraint added" -ForegroundColor Green
}
```

---

## 5. 確認後のチェックリスト

- [ ] DailyActivityRecords: `UserCode` indexed
- [ ] DailyActivityRecords: `RecordDate` indexed
- [ ] schedule_events: `EventDate` indexed
- [ ] schedule_events: `EndDate` indexed
- [ ] schedule_events: `cr014_dayKey` indexed
- [ ] DriftEventsLog_v2: `Detected_At` indexed
- [ ] DriftEventsLog_v2: `listName` indexed
- [ ] SupportRecord_Daily: `cr013_personId` indexed
- [ ] SupportRecord_Daily: `cr013_date` indexed
- [ ] AttendanceDaily: `UserCode` indexed
- [ ] AttendanceDaily: `RecordDate` indexed
- [ ] AttendanceDaily: `Key` indexed
- [ ] ServiceProvisionRecords: `EntryKey` indexed
- [ ] ServiceProvisionRecords: `UserCode` indexed
- [ ] ServiceProvisionRecords: `RecordDate` indexed
- [ ] Transport_Log: `UserCode` indexed
- [ ] Transport_Log: `RecordDate` indexed
- [ ] SupportProcedureRecord_Daily: `UserCode` indexed
- [ ] SupportProcedureRecord_Daily: `RecordDate` indexed
- [ ] Users_Master: `UserID` EnforceUniqueValues + Indexed

---

## 6. 注意事項

- インデックスは **列あたり最大20個** まで（SharePoint の制限）
- ユニーク制約追加時、既存データに重複がある場合は **エラーになる**
- インデックス追加後も既存の Filter Query は正常動作する（パフォーマンスが向上するのみ）
- 5,000件を超えたリストで **非インデックス列をフィルターすると 400/500 エラー** が発生する
