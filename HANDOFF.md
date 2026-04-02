# Handoff: SharePoint Schema Drift Resilience — 2026-04-02

## Status

**Schema Drift Resilience フェーズ 受け入れ完了**

- PR #1360（基盤整備）マージ済み
- PR #1361（診断表現整理・管理者専用化）マージ済み
- 横展開（Daily / ActivityDiary / MonitoringMeeting / DailyActivityRecords / MeetingMinutes / Handoff / ISP_Master / NurseObs / MeetingSessions）完了、74テスト全通過
- ブランチ: `main`

---

## 1. 完了したこと

### 基盤 (PR #1360)

| 実装 | ファイル |
|------|---------|
| Drift 検出ロジック | [src/lib/sp/helpers.ts](src/lib/sp/helpers.ts) — `resolveInternalNamesDetailed` |
| Provisioning ガードレール | `spProvisioningService.ts` — 同名サフィックス列の物理追加を自動スキップ |
| Repository 硬化 | `ServiceProvisionRecords` を Dynamic Schema Resolution 方式へ移行 |
| 診断統合 | [src/features/diagnostics/health/checks.ts](src/features/diagnostics/health/checks.ts) — Drifted 状態を検知・WARN |

### WARN/FAIL 契約の確立 (PR #1361)

| 状態 | 定義 | アプリ継続可否 |
|------|------|--------------|
| **PASS** | 全期待列が物理名と一致 | ✅ 正常 |
| **WARN (drift)** | 列名にサフィックス（例: `FullName0`）が付与されている | ✅ 動作継続可。candidates で吸収済み |
| **WARN (optional missing)** | オプション列が欠落 | ✅ 代替解決ロジック適用 |
| **FAIL (essential missing)** | 必須列が存在しない | ❌ 当該リスト読み書き不能 |
| **FAIL (permission)** | Read/Create/Update 権限なし | ❌ 管理者対応が必要 |

**管理者向け nextActions:**
- FAIL (essential missing) → Provision を再実行して必須列を自己修復
- FAIL (permission) → SharePoint 管理センターで対象リストに権限を付与
- WARN (drift) → ドリフト列（数字サフィックス付き）の削除を検討（アプリ動作は継続可）

### 横展開完了 (45 テスト)

| レーン | リスト | ESSENTIALS | 実装ファイル |
|--------|--------|-----------|-------------|
| Daily | `support_record_daily` | Title / RecordDate / UserRowsJSON | [dailyFields.ts](src/sharepoint/fields/dailyFields.ts) |
| ActivityDiary | `activity_diary` | userId / date / shift / category | [dailyFields.ts](src/sharepoint/fields/dailyFields.ts) |
| MonitoringMeeting | `monitoring_meetings` | recordId / userId / meetingDate | [monitoringMeetingFields.ts](src/sharepoint/fields/monitoringMeetingFields.ts) |
| DailyActivityRecords | `daily_activity_records` | userId / recordDate / timeSlot / observation | [dailyFields.ts](src/sharepoint/fields/dailyFields.ts) |
| MeetingMinutes | `meeting_minutes` | meetingDate / category | [meetingMinutesFields.ts](src/sharepoint/fields/meetingMinutesFields.ts) |
| Handoff | `handoff` | message / userCode / category | [handoffFields.ts](src/sharepoint/fields/handoffFields.ts) |
| ISP_Master | `isp_master` | userCode / planStartDate / status | [ispThreeLayerFields.ts](src/sharepoint/fields/ispThreeLayerFields.ts) |
| NurseObservations | `nurse_observations` | observedAt / userLookupId / temperature | [nurseObservationFields.ts](src/sharepoint/fields/nurseObservationFields.ts) |
| MeetingSessions | `meeting_sessions` | sessionKey / meetingKind / date | [metingSessionFields.ts](src/sharepoint/fields/meetingSessionFields.ts) |

---

## 2. WARN/FAIL 契約の実装箇所

| ファイル | 役割 |
|---------|------|
| [src/features/diagnostics/health/checks.ts](src/features/diagnostics/health/checks.ts) | 判定ロジック。`missingEssential` → FAIL、`drifted` → WARN、`missingOptional` → WARN |
| [src/features/diagnostics/health/types.ts](src/features/diagnostics/health/types.ts) | `SpFieldSpec.candidates?: string[]` — drift 候補名の型 |
| [src/pages/HealthPage.tsx](src/pages/HealthPage.tsx) | `DRIFT_CANDIDATES_BY_KEY` — リストキー → candidates のオーバーライドマップ |
| [src/sharepoint/fields/](src/sharepoint/fields/) | `*_CANDIDATES` / `*_ESSENTIALS` 定数群 |

**診断ページ**: `/admin/status`（管理者専用）

---

## 3. 残件

### 権限起因 FAIL（3件・コード修正対象外）

| リスト | 状況 |
|--------|------|
| `user_benefit_profile` (`RecipientCertNumber`) | 権限があれば healing で通る可能性あり |
| `監査チェックルール` (`compliance_check_rules`) | Read 権限不足 |
| `利用者マスタ` (`users_master`) | Create 権限不足 |

→ SharePoint 管理センターで権限を付与後、診断を再実行して確認。

### drift 耐性未対応リスト（横展開候補）

以下は `DRIFT_CANDIDATES_BY_KEY` に未登録。drift 発生時に FAIL 誤報リスクあり。
**高優先（required + W）** から対応してください。

| キー | displayName | lifecycle | ops | essentialFields |
|------|-------------|-----------|-----|-----------------|
| `user_benefit_profile` | 利用者支給量プロファイル | required | R, W | UserID, RecipientCertNumber |
| `daily_activity_records` | 日次活動記録 | required | R, W | UserCode, RecordDate, TimeSlot, Observation |
| `daily_attendance` | 日次出欠 | required | R, W | UserID, Date, Status |
| `schedule_events` | スケジュール | required | R, W, D | Title, EventDate, EndDate |
| `meeting_minutes` | 議事録 | required | R, W, D | MeetingDate, Category |
| `handoff` | 引き継ぎ | required | R, W, D | Message, UserCode, Category |
| `support_plans` | 個別支援計画 | required | R, W, D | DraftId, UserCode, FormDataJson |
| `isp_master` | 個別支援計画（ISP） | required | R, W | UserCode, PlanStartDate, Status |
| `nurse_observations` | 看護観察 | optional | R, W | observedAt, userLookupId, temperature |
| `meeting_sessions` | 会議セッション | optional | R, W, D | SessionKey, MeetingKind, MeetingDate |

→ 追加方法は [4点チェックリスト](#4-次のレーンを追加する場合) を参照。
→ 詳細優先度は [docs/operations/sp-health-admin-runbook.md](docs/operations/sp-health-admin-runbook.md) を参照。

---

## 4. 次のレーンを追加する場合

```
1. src/sharepoint/fields/<domain>Fields.ts
   - *_CANDIDATES: { [conceptualKey]: string[] } — 代替内部名の配列
   - *_ESSENTIALS: string[] — 欠落=FAIL の最小セット

2. src/pages/HealthPage.tsx の DRIFT_CANDIDATES_BY_KEY[key] に追加

3. drift テスト: src/sharepoint/fields/__tests__/<domain>Fields.drift.spec.ts
   - 正規名ヒット / サフィックスドリフトヒット / essential 欠落 → FAIL / optional 欠落 → WARN

4. PR レビューで ESSENTIALS の FAIL/WARN 境界を合意
```

---

## 5. 参照ファイル

| 目的 | ファイル |
|------|---------|
| Drift 検出ロジック | [src/lib/sp/helpers.ts](src/lib/sp/helpers.ts) |
| 診断チェック実装 | [src/features/diagnostics/health/checks.ts](src/features/diagnostics/health/checks.ts) |
| 診断ページ組み立て | [src/pages/HealthPage.tsx](src/pages/HealthPage.tsx) |
| フィールド定義 SSOT | [src/sharepoint/spListRegistry.ts](src/sharepoint/spListRegistry.ts) |
| 管理者向け Runbook | [docs/operations/sp-health-admin-runbook.md](docs/operations/sp-health-admin-runbook.md) |
| ADR | [docs/adr/ADR_005_SharePoint_Self_Healing_Stabilization.md](docs/adr/ADR_005_SharePoint_Self_Healing_Stabilization.md) |
| Drift テスト | [src/lib/sp/__tests__/drift.spec.ts](src/lib/sp/__tests__/drift.spec.ts) |

---

**All tests green. tsc clean.**

---

## 6. 静的検証完了 (2026-04-02)

実装・診断ロジック・runbook の3層が一致することを静的トレースで確認済み。

| チェック | 静的保証の根拠 |
|---------|--------------|
| `users_master` schema → PASS/WARN | CANDIDATES が4必須フィールドの全候補を網羅。drift 経由でも `missingEssential=[]` |
| `compliance_check_rules` Read FAIL | `isReadOnly=true` でWrite スキップ。`getItemsTop1` 失敗 → nextActions「閲覧権限付与」が確定記述 |
| `user_benefit_profile` drift 吸収 | `USER_BENEFIT_PROFILE_CANDIDATES` 登録で誤 FAIL を排除。残 FAIL は権限/真の列不在のみ |
| `toAdminSummary` FAIL テンプレ | 17テスト全通過。`【管理者対応手順】` に一本化 |

次は **ブラウザで `/admin/status` を開き、上記3点を目視確認して運用へ渡す**。
