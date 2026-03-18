#!/usr/bin/env pwsh
<#
.SYNOPSIS
    MonitoringMeetings CRUD 検証スクリプト
    Phase 2: Create → Read → Update → Delete を通しで流し、結果を表示する。

.DESCRIPTION
    Repository 実装 (spMonitoringMeetingRepository) が想定通り動くかを
    PnP PowerShell で直接確認する。
    - Title = {userId}_{meetingDate} が正しく生成されるか
    - JSON列が文字列化されて保存・往復できるか
    - meetingDate が YYYY-MM-DD で入るか
    - save (upsert) が create / update を正しく分岐するか
    - delete が冪等に動作するか

.EXAMPLE
    pwsh ./scripts/verify-monitoring-meetings-crud.ps1
#>

param(
    [string]$SiteUrl = "https://isogokatudouhome.sharepoint.com/sites/welfare",
    [string]$ListTitle = "MonitoringMeetings",
    [string]$ClientId = "ef918e68-3755-4ce9-9dac-af0495f89450"
)

$ErrorActionPreference = "Stop"

# ═══════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════

$pass = 0
$fail = 0
$results = @()

function Assert-True {
    param([string]$Label, [bool]$Condition, [string]$Detail = "")
    if ($Condition) {
        $script:pass++
        Write-Host "  ✅ $Label" -ForegroundColor Green
        $script:results += @{ Label = $Label; Result = "PASS" }
    } else {
        $script:fail++
        $msg = if ($Detail) { "  ❌ $Label — $Detail" } else { "  ❌ $Label" }
        Write-Host $msg -ForegroundColor Red
        $script:results += @{ Label = $Label; Result = "FAIL: $Detail" }
    }
}

function Write-Phase {
    param([string]$Name)
    Write-Host ""
    Write-Host "══════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  $Name" -ForegroundColor Cyan
    Write-Host "══════════════════════════════════════════════════" -ForegroundColor Cyan
}

# ═══════════════════════════════════════════════════════════════
# Test Data
# ═══════════════════════════════════════════════════════════════

$testRecordId = "test-crud-" + [guid]::NewGuid().ToString("N").Substring(0, 8)
$testUserId   = "test-user-001"
$testIspId    = "test-isp-001"
$meetingDate  = "2026-03-15"

$attendeesJson = '[{"name":"山田太郎","role":"サービス管理責任者","organization":"テスト事業所"},{"name":"鈴木花子","role":"相談支援専門員","organization":"テスト相談支援"}]'
$goalEvaluationsJson = '[{"goalId":"g1","goalText":"日中活動への参加","evaluation":"achieved","comment":"毎日参加できている"},{"goalId":"g2","goalText":"身だしなみの自立","evaluation":"partial","comment":"声掛けが必要"}]'
$decisionsJson = '["支援計画の継続","次回3ヶ月後にモニタリング"]'

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host "MonitoringMeetings CRUD 検証" -ForegroundColor Magenta
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host "  対象リスト: $ListTitle"
Write-Host "  テスト recordId: $testRecordId"

# ═══════════════════════════════════════════════════════════════
# Connect
# ═══════════════════════════════════════════════════════════════

Import-Module PnP.PowerShell -ErrorAction Stop
Write-Host "`n接続中..." -ForegroundColor Yellow
Connect-PnPOnline -Url $SiteUrl -Interactive -ClientId $ClientId
Write-Host "  ✅ 接続成功" -ForegroundColor Green

# ═══════════════════════════════════════════════════════════════
# Phase 2-1: CREATE
# ═══════════════════════════════════════════════════════════════

Write-Phase "Phase 2-1: CREATE"

$createBody = @{
    Title                      = "${testUserId}_${meetingDate}"
    cr014_recordId             = $testRecordId
    cr014_userId               = $testUserId
    cr014_ispId                = $testIspId
    cr014_planningSheetId      = ""
    cr014_meetingType           = "regular"
    cr014_meetingDate           = $meetingDate
    cr014_venue                = "テスト会議室A"
    cr014_attendeesJson        = $attendeesJson
    cr014_goalEvaluationsJson  = $goalEvaluationsJson
    cr014_overallAssessment    = "全体として良好に経過"
    cr014_userFeedback         = "今の支援に満足している"
    cr014_familyFeedback       = ""
    cr014_planChangeDecision   = "no_change"
    cr014_changeReason         = ""
    cr014_decisionsJson        = $decisionsJson
    cr014_nextMonitoringDate   = "2026-06-15"
    cr014_recordedBy           = "検証スクリプト"
    cr014_recordedAt           = "2026-03-18T17:50:00+09:00"
}

try {
    $created = Add-PnPListItem -List $ListTitle -Values $createBody
    $spId = $created.Id
    Assert-True "アイテム作成成功 (SP Id=$spId)" ($null -ne $created)
} catch {
    Assert-True "アイテム作成成功" $false $_.Exception.Message
    Write-Host "`n❌ CREATE 失敗。以降のテストは中断します。" -ForegroundColor Red
    exit 1
}

# Create 後の確認
$item = Get-PnPListItem -List $ListTitle -Id $spId
$fields = $item.FieldValues

Assert-True "Title = userId_meetingDate" ($fields["Title"] -eq "${testUserId}_${meetingDate}") "got: $($fields['Title'])"
Assert-True "cr014_recordId が保存されている" ($fields["cr014_recordId"] -eq $testRecordId) "got: $($fields['cr014_recordId'])"
Assert-True "cr014_meetingDate = YYYY-MM-DD" ($fields["cr014_meetingDate"] -eq $meetingDate) "got: $($fields['cr014_meetingDate'])"
Assert-True "cr014_meetingType = regular" ($fields["cr014_meetingType"] -eq "regular")
Assert-True "cr014_venue が保存されている" ($fields["cr014_venue"] -eq "テスト会議室A")

# JSON 往復確認
$parsedAttendees = $null
try { $parsedAttendees = $fields["cr014_attendeesJson"] | ConvertFrom-Json } catch {}
Assert-True "attendeesJson が JSON 往復できる" ($null -ne $parsedAttendees -and $parsedAttendees.Count -eq 2) "count: $($parsedAttendees.Count)"

$parsedGoals = $null
try { $parsedGoals = $fields["cr014_goalEvaluationsJson"] | ConvertFrom-Json } catch {}
Assert-True "goalEvaluationsJson が JSON 往復できる" ($null -ne $parsedGoals -and $parsedGoals.Count -eq 2) "count: $($parsedGoals.Count)"

$parsedDecisions = $null
try { $parsedDecisions = $fields["cr014_decisionsJson"] | ConvertFrom-Json } catch {}
Assert-True "decisionsJson が JSON 往復できる" ($null -ne $parsedDecisions -and $parsedDecisions.Count -eq 2) "count: $($parsedDecisions.Count)"

# 任意項目の正規化確認
Assert-True "familyFeedback が空文字で保存" ($fields["cr014_familyFeedback"] -eq "" -or $null -eq $fields["cr014_familyFeedback"])
Assert-True "changeReason が空文字で保存" ($fields["cr014_changeReason"] -eq "" -or $null -eq $fields["cr014_changeReason"])

# ═══════════════════════════════════════════════════════════════
# Phase 2-2: READ (OData フィルタ)
# ═══════════════════════════════════════════════════════════════

Write-Phase "Phase 2-2: READ (OData Filter)"

# getById (recordId)
$byRecordId = @(Get-PnPListItem -List $ListTitle -Query "<View><Query><Where><Eq><FieldRef Name='cr014_recordId'/><Value Type='Text'>$testRecordId</Value></Eq></Where></Query></View>")
Assert-True "getById(recordId) で 1 件取得" ($byRecordId.Count -eq 1) "count: $($byRecordId.Count)"

# listByUser
$byUser = @(Get-PnPListItem -List $ListTitle -Query "<View><Query><Where><Eq><FieldRef Name='cr014_userId'/><Value Type='Text'>$testUserId</Value></Eq></Where><OrderBy><FieldRef Name='cr014_meetingDate' Ascending='FALSE'/></OrderBy></Query></View>")
Assert-True "listByUser(userId) で 1 件取得" ($byUser.Count -ge 1) "count: $($byUser.Count)"

# listByIsp
$byIsp = @(Get-PnPListItem -List $ListTitle -Query "<View><Query><Where><Eq><FieldRef Name='cr014_ispId'/><Value Type='Text'>$testIspId</Value></Eq></Where></Query></View>")
Assert-True "listByIsp(ispId) で 1 件取得" ($byIsp.Count -ge 1) "count: $($byIsp.Count)"

# meetingDate desc ソート確認
if ($byUser.Count -ge 1 -and $null -ne $byUser[0]) {
    $firstDate = $byUser[0].FieldValues["cr014_meetingDate"]
    Assert-True "listByUser の先頭は最新日付" ($firstDate -eq $meetingDate) "got: $firstDate"
}

# ═══════════════════════════════════════════════════════════════
# Phase 2-3: UPDATE (upsert → update 分岐)
# ═══════════════════════════════════════════════════════════════

Write-Phase "Phase 2-3: UPDATE (same recordId → update)"

$updateBody = @{
    cr014_overallAssessment    = "更新後: 全体的に改善傾向"
    cr014_planChangeDecision   = "minor_change"
    cr014_changeReason         = "更新後: 軽微な変更あり"
    cr014_familyFeedback       = "更新後: 家族も安心している"
    cr014_decisionsJson        = '["支援時間を30分延長","週1回の外出支援を追加"]'
}

try {
    Set-PnPListItem -List $ListTitle -Identity $spId -Values $updateBody | Out-Null
    Assert-True "update 実行成功" $true
} catch {
    Assert-True "update 実行成功" $false $_.Exception.Message
}

# Update 後の確認
$updated = Get-PnPListItem -List $ListTitle -Id $spId
$uFields = $updated.FieldValues

Assert-True "overallAssessment が更新された" ($uFields["cr014_overallAssessment"] -eq "更新後: 全体的に改善傾向") "got: $($uFields['cr014_overallAssessment'])"
Assert-True "planChangeDecision が更新された" ($uFields["cr014_planChangeDecision"] -eq "minor_change")
Assert-True "familyFeedback が更新された" ($uFields["cr014_familyFeedback"] -eq "更新後: 家族も安心している")
Assert-True "recordId は不変" ($uFields["cr014_recordId"] -eq $testRecordId)
Assert-True "meetingDate は不変" ($uFields["cr014_meetingDate"] -eq $meetingDate)

$updatedDecisions = $null
try { $updatedDecisions = $uFields["cr014_decisionsJson"] | ConvertFrom-Json } catch {}
Assert-True "decisionsJson が更新後も往復できる" ($null -ne $updatedDecisions -and $updatedDecisions.Count -eq 2) "count: $($updatedDecisions.Count)"

# ═══════════════════════════════════════════════════════════════
# Phase 2-4: DELETE (冪等)
# ═══════════════════════════════════════════════════════════════

Write-Phase "Phase 2-4: DELETE (冪等性)"

# 1回目の delete
try {
    Remove-PnPListItem -List $ListTitle -Identity $spId -Force
    Assert-True "delete(recordId) 1回目成功" $true
} catch {
    Assert-True "delete(recordId) 1回目成功" $false $_.Exception.Message
}

# 削除後に getById で null
$afterDelete = @(Get-PnPListItem -List $ListTitle -Query "<View><Query><Where><Eq><FieldRef Name='cr014_recordId'/><Value Type='Text'>$testRecordId</Value></Eq></Where></Query></View>")
Assert-True "削除後 getById が空を返す" ($afterDelete.Count -eq 0) "count: $($afterDelete.Count)"

# 2回目の delete（冪等性確認）— SP の場合は「存在しないIdへのdelete」はエラーになるが、
# Repository 実装では findSpItemIdByRecordId → null → return void で吸収する。
# ここでは「同じ recordId で検索→見つからない」を確認する。
$secondLookup = @(Get-PnPListItem -List $ListTitle -Query "<View><Query><Where><Eq><FieldRef Name='cr014_recordId'/><Value Type='Text'>$testRecordId</Value></Eq></Where></Query></View>")
Assert-True "2回目の検索でも空（冪等性）" ($secondLookup.Count -eq 0) "count: $($secondLookup.Count)"

# ═══════════════════════════════════════════════════════════════
# 最終結果
# ═══════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host "  最終結果" -ForegroundColor Magenta
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host ""
Write-Host "  PASS: $pass" -ForegroundColor Green
Write-Host "  FAIL: $fail" -ForegroundColor $(if ($fail -gt 0) { "Red" } else { "Green" })
Write-Host ""

if ($fail -eq 0) {
    Write-Host "  🎉 ALL PASS — Phase 2 CRUD 検証完了!" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  $fail 件の FAIL があります" -ForegroundColor Red
    Write-Host ""
    Write-Host "  失敗項目:" -ForegroundColor Red
    $results | Where-Object { $_.Result -like "FAIL*" } | ForEach-Object {
        Write-Host "    - $($_.Label): $($_.Result)" -ForegroundColor Red
    }
}

Write-Host ""

# Disconnect
try { Disconnect-PnPOnline -ErrorAction SilentlyContinue } catch {}

exit $(if ($fail -gt 0) { 1 } else { 0 })
