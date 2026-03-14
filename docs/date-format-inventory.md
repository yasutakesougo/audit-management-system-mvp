# Date Format Inventory

> Phase 1: 共通API定義と安全導入の土台作り (2026-03-14)

## Summary

| 指標 | 件数 |
|---|---|
| total implementations | 17 |
| high-priority duplicates | 5 |
| safe replacement candidates (Phase 2) | 7 |
| manual review required | 6 |
| inline `toLocaleDateString` calls | 15+ |

---

## Current Implementations

### Named Functions (関数定義)

| # | path | function | input | output | locale依存 | 時刻含む | null/undef対応 | 利用箇所数 | 置換優先度 | 危険度 | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `features/assessment/tokuseiSurveyHelpers.ts` | `formatDateTime` | `string` | `string` (ja-JP datetime) | ✅ Intl ja-JP | ✅ | ✅ (`''`→`'未入力'`, invalid→raw) | 5 | 中 | 安全 | assessment 画面用。Intl使用 |
| 2 | `features/support-plan-guide/utils/helpers.ts` | `formatDateJP` | `Date?` | `string` (YYYY/MM/DD) | ❌ manual | ❌ | ✅ (`undefined`→`''`) | 4 | **高** | 安全 | `formatDateYmd` と同等。support-plan 内で完結 |
| 3 | `features/ibd/plans/support-plan/supportPlanDeadline.ts` | `formatDateJP` | `Date?` | `string` (YYYY/MM/DD) | ❌ manual | ❌ | ✅ (`undefined`→`''`) | 4 | **高** | 安全 | #2 の完全重複コピー |
| 4 | `features/users/UserDetailSections/helpers.tsx` | `formatDateLabel` | `string? \| null` | `string` (YYYY年M月D日) | ❌ manual | ❌ | ✅ (`null`→`'未設定'`) | 10 | **高** | 安全 | `formatDateJapanese` と同等。UI表示のみ |
| 5 | `features/schedules/components/DaySummaryDrawer.tsx` | `formatDateDisplay` | `string` (ISO date) | `string` (YYYY年M月D日) | ❌ manual | ❌ | ❌ | 1 | 中 | 安全 | コンポーネントローカル |
| 6 | `features/schedules/routes/ScheduleViewDialog.tsx` | `formatDateTime` | `string?` | `string` (yyyy-MM-dd HH:mm) | ❌ date-fns-tz | ✅ | ✅ (`undefined`→`'—'`) | 2 | 低 | **注意** | date-fns-tz依存、schedulesTz使用 |
| 7 | `features/schedules/domain/scheduleFormState.ts` | `formatDateTimeLocal` | `Date` | `string` (yyyy-MM-dd'T'HH:mm) | ❌ date-fns | ✅ | ❌ | 2 | 低 | **注意** | HTML input[type=datetime-local]用。date-fns依存 |
| 8 | `features/records/monthly/MonthlySummaryTable.tsx` | `formatDate` | `string` | `string` (ja-JP short) | ✅ Intl ja-JP | ✅ | ❌ | 1 | 中 | 安全 | コンポーネントローカル |
| 9 | `features/ibd/core/reports/AuditEvidenceReportPDF.tsx` | `formatDate` | `string` | `string` (YYYY/MM/DD) | ❌ manual | ❌ | ✅ (`''`→`'-'`) | 8 | 低 | **要人間判断** | PDF帳票内。react-pdf依存 |
| 10 | `features/ibd/core/reports/AuditEvidenceReportPDF.tsx` | `formatDateTime` | `string` | `string` (YYYY/MM/DD HH:mm) | ❌ manual | ✅ | ✅ (`''`→`'-'`) | 4 | 低 | **要人間判断** | PDF帳票内。#9と組み合わせ |
| 11 | `features/handoff/hooks/useHandoffDateNav.ts` | `formatDateLocal` | `Date` | `string` (YYYY-MM-DD) | ❌ manual | ❌ | ❌ | 5 | 中 | 安全 | `formatDateIso` と同等 |
| 12 | `features/handoff/hooks/useHandoffDateNav.ts` | `formatDateLabel` | `string` | `string` (M月D日（曜）) | ❌ manual | ❌ | ✅ (parse失敗→raw) | 2 | 低 | 安全 | 今日/昨日の特殊ラベルあり |
| 13 | `features/dashboard/tabs/hooks/useRoomReservations.ts` | `formatDateDisplay` | `string` | `string` (M/D(曜)) | ❌ manual | ❌ | ❌ | 1 | 中 | 安全 | コンポーネントローカル |
| 14 | `features/daily/infra/InMemoryDailyRecordRepository.ts` | `formatDateLocal` | `Date` | `string` (YYYY-MM-DD) | ❌ manual | ❌ | ❌ | 2 | **高** | 安全 | `formatDateIso` と完全同等 |
| 15 | `features/daily/components/MonitoringCountdown.tsx` | `formatDate` | `Date` | `string` (YYYY/MM/DD) | ❌ manual | ❌ | ❌ | 2 | **高** | 安全 | `formatDateYmd` と完全同等 |
| 16 | `lib/mappers/schedule.ts` | `formatDateTimeInZone` | `Date, timeZone` | `string \| null` (ISO w/ offset) | ❌ Intl en-CA | ✅ | ✅ (returns null) | 2 | — | **要人間判断** | SharePoint TZ変換。置換対象外 |
| 17 | `lib/mappers/schedule.ts` | `formatDateOnlyInZone` | `Date, timeZone` | `string \| null` (YYYY-MM-DD) | ❌ Intl en-CA | ❌ | ✅ (returns null) | 2 | — | **要人間判断** | SharePoint TZ変換。置換対象外 |

### Inline `toLocaleDateString` Calls (インライン呼び出し)

| # | path | pattern | locale/options |
|---|---|---|---|
| 1 | `pages/SupportPlanningSheetPage.tsx` | `new Date(sheet.createdAt).toLocaleDateString('ja-JP')` | ja-JP, default |
| 2 | `features/safety/components/RestraintHistoryList.tsx` | `new Date(iso).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })` | ja-JP, short |
| 3 | `features/safety/components/IncidentHistoryList.tsx` | `new Date(iso).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })` | ja-JP, short |
| 4 | `features/records/monthly/MonthlySummaryTable.tsx` | `new Date(isoString).toLocaleDateString('ja-JP', ...)` | ja-JP, 時刻含む |
| 5 | `features/import/components/ImportHistoryPanel.tsx` | `new Date(isoDate).toLocaleDateString('ja-JP', ...)` | ja-JP, y/m/d |
| 6 | `features/ibd/.../MonitoringRevisionDialog.tsx` | `new Date(date).toLocaleDateString('ja-JP')` | ja-JP, default |
| 7 | `features/dashboard/tabs/RoomManagementTabs.tsx` | `currentMonth.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })` | ja-JP, long month |
| 8 | `features/daily/components/TableDailyRecordUserPicker.tsx` | `new Date(formDate).toLocaleDateString('ja-JP', ...)` | ja-JP, y/m/d |
| 9 | `features/dashboard/BriefingPanel.tsx` | `now.toLocaleDateString('ja-JP', ...)` | ja-JP, long |
| 10 | `features/daily/components/split-stream/RecordPanel.tsx` | `resolvedRecordDate.toLocaleDateString('ja-JP', ...)` | ja-JP, y/m/d |
| 11 | `features/assessment/components/ImportSurveyDialog.tsx` | `new Date(fillDate).toLocaleDateString()` | default locale |
| 12 | `features/analysis/components/BehaviorHeatmap.tsx` | `date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })` | ja-JP, m/d |
| 13 | `features/analysis/hooks/useAnalysisDashboardViewModel.ts` | `d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })` | ja-JP, m/d |

### Existing Shared Utility

| path | function | purpose | notes |
|---|---|---|---|
| `utils/datetime.ts` | `formatRangeLocal` | 日時範囲のフォーマット（開始〜終了） | Phase 1 の共通APIとは共存。範囲表示専用 |
| `utils/getNow.ts` | `toLocalDateISO` | ローカルTZでの今日の日付 YYYY-MM-DD | 小さなユーティリティ。共通API `formatDateIso` は上位互換 |

---

## Proposed Shared API

新設ファイル: `src/lib/dateFormat.ts`

| function | purpose | input | output example |
|---|---|---|---|
| `formatDateYmd` | 日付のみ (YYYY/MM/DD) | `DateInput` | `"2025/01/15"` |
| `formatDateJapanese` | 日本語日付 (YYYY年M月D日) | `DateInput` | `"2025年1月15日"` |
| `formatDateTimeYmdHm` | 日時 (YYYY/MM/DD HH:mm) | `DateInput` | `"2025/01/15 09:30"` |
| `formatDateTimeIntl` | Intl.DateTimeFormat(ja-JP) | `DateInput, options?` | locale依存 |
| `safeFormatDate` | カスタムフォーマッター + null安全 | `DateInput, formatter, fallback` | any |
| `formatDateIso` | ISO日付 (YYYY-MM-DD, ローカルTZ) | `DateInput` | `"2025-01-15"` |
| `toSafeDate` | DateInput → Date \| null 変換 | `DateInput` | `Date \| null` |

共通設計方針:
- `DateInput = Date | string | number | null | undefined`
- invalid → 例外なし、フォールバック文字列を返す
- locale依存がある場合は関数名/JSDocで明示
- timezone は JST (Asia/Tokyo) 前提。TZ引数は設けない
- `_` prefixなし、用途が名前でわかる命名

---

## Safe Candidates for Phase 2

以下は影響が限定的で安全に置換可能な実装:

### 優先度: 高

| # | 現在の実装 | 置換先 | 理由 |
|---|---|---|---|
| 1 | `support-plan-guide/utils/helpers.ts` → `formatDateJP` | `formatDateYmd` | 出力形式が同一 (YYYY/MM/DD)。support-plan内で完結 |
| 2 | `ibd/plans/support-plan/supportPlanDeadline.ts` → `formatDateJP` | `formatDateYmd` | #1の完全コピー。同時に置換可能 |
| 3 | `daily/components/MonitoringCountdown.tsx` → `formatDate` | `formatDateYmd` | 完全同一ロジック。UI表示のみ |
| 4 | `daily/infra/InMemoryDailyRecordRepository.ts` → `formatDateLocal` | `formatDateIso` | 完全同一ロジック (YYYY-MM-DD)。InMemory repo |
| 5 | `users/UserDetailSections/helpers.tsx` → `formatDateLabel` | `formatDateJapanese` + `fallback='未設定'` | 出力パターンが同等 |

### 優先度: 中

| # | 現在の実装 | 置換先 | 理由 |
|---|---|---|---|
| 6 | `schedules/components/DaySummaryDrawer.tsx` → `formatDateDisplay` | `formatDateJapanese` | 出力パターンが同等 |
| 7 | `dashboard/tabs/hooks/useRoomReservations.ts` → `formatDateDisplay` | `safeFormatDate` + custom | 曜日つき表示 |

---

## Manual Review Required

以下は Phase 2 では**置換しない**。レビュー対象として記録のみ。

### 禁止領域 (domain / sharepoint / report)

| # | path | function | 理由 |
|---|---|---|---|
| 1 | `lib/mappers/schedule.ts` | `formatDateTimeInZone`, `formatDateOnlyInZone` | SharePoint TZ変換のコアロジック。offset計算あり。置換不可 |
| 2 | `features/ibd/core/reports/AuditEvidenceReportPDF.tsx` | `formatDate`, `formatDateTime` | PDF帳票出力。react-pdf内で使用。表示仕様変更リスク |
| 3 | `features/schedules/routes/ScheduleViewDialog.tsx` | `formatDateTime` | date-fns-tz依存。schedulesTz参照 |
| 4 | `features/schedules/domain/scheduleFormState.ts` | `formatDateTimeLocal` | date-fns `format` 依存。HTML datetime-local input用 |
| 5 | `features/assessment/tokuseiSurveyHelpers.ts` | `formatDateTime` | 独自のfallback仕様 (`'未入力'`, invalid→raw value) |
| 6 | `features/handoff/hooks/useHandoffDateNav.ts` | `formatDateLocal`, `formatDateLabel` | 「今日」「昨日」の特殊ラベル + 曜日表示 |

### インライン `toLocaleDateString` 呼び出し

インライン呼び出し（13件以上）は Phase 3 以降で `formatDateTimeIntl` への置換を検討。
各コンポーネントの表示仕様を確認した上での慎重な移行が必要。

---

## Suggested Migration Plan

### Phase 1: API + tests + inventory ← **今回 (完了)**
- [x] `src/lib/dateFormat.ts` — 共通API定義 (7関数)
- [x] `tests/unit/dateFormat.spec.ts` — 仕様固定テスト (58テスト)
- [x] `docs/date-format-inventory.md` — 棚卸しドキュメント
- [x] typecheck pass / lint clean / test pass / build success

### Phase 2: low-risk replacement ← **完了 (2026-03-14)**
- [x] `formatDateJP` (2箇所) → `formatDateYmd` に置換
- [x] `MonitoringCountdown.formatDate` → `formatDateYmd` に置換
- [x] `InMemoryDailyRecordRepository.formatDateLocal` → `formatDateIso` に置換
- [x] `UserDetailSections/helpers.formatDateLabel` → `formatDateJapanese` に置換
- [x] `DaySummaryDrawer.formatDateDisplay` → `formatDateJapanese` に置換
- [ ] `useRoomReservations.formatDateDisplay` → Phase 3 に繰り越し（曜日表示のカスタムフォーマット、差分メリット小）
- 合計: 6実装を置換完了 / 1件繰り越し
- 影響範囲: utils / view helpers / presentational-only
- テスト: `tests/unit/dateFormat-phase2-integration.spec.ts` 追加 (24テスト)
- レポート: `docs/date-format-phase2-report.md`

### Phase 3: medium-risk consolidation ← **完了 (2026-03-14)**
- [x] `useHandoffDateNav.formatDateLocal` → `formatDateIso` に置換
- [x] `useRoomReservations.formatDateDisplay` → `safeFormatDate` に置換（Phase 2 から繰り越し）
- [x] `SupportPlanningSheetPage` インライン `toLocaleDateString` 2件 → `formatDateTimeIntl` に置換
- [x] `RecordPanel` インライン `toLocaleDateString` 1件 → `formatDateYmd` に置換
- [ ] `MonthlySummaryTable.formatDate` → 見送り（`month: 'short'` + 時刻の独自表現、テスト固定困難）
- [ ] `tokuseiSurveyHelpers.formatDateTime` → 見送り（`'未入力'` + invalid→raw value の独自仕様）
- [ ] `IncidentHistoryList` / `RestraintHistoryList` / `ImportHistoryPanel` の `relativeTime` 系 → 見送り（関数内 fallback のため部分置換困難）
- [ ] 残インライン `toLocaleDateString` 10件以上 → Phase 4 で段階対応
- 合計: 4実装を置換完了 / 4+件繰り越し / インライン3件削減
- テスト: `tests/unit/dateFormat-phase3-integration.spec.ts` 追加 (26テスト)
- レポート: `docs/date-format-phase3-report.md`

### Phase 4: wrapper整理・ガイドライン固定 ← **完了 (2026-03-14)**
- [x] wrapper 棚卸し (8件分類完了)
- [x] 不要 wrapper 3件削除 (`formatDate`, `formatDateDisplay`, `formatDateLocal`)
- [x] 残 wrapper 5件に注記整備 (`@deprecated` / `@remarks`)
- [x] `docs/date-format-guidelines.md` 追加
- [x] `docs/date-format-inventory.md` 更新
- [x] `docs/date-format-phase4-report.md` 追加
- テスト: 137テスト全パス（コード変更に対するリグレッションなし）

### 高リスク未着手（変更禁止領域 — 別Issue推奨）
- [ ] `lib/mappers/schedule.ts` のTZ変換関数 — 評価のみ（置換不要の可能性大）
- [ ] `AuditEvidenceReportPDF.tsx` の帳票内フォーマット — PDF出力テスト必須
- [ ] `ScheduleViewDialog.formatDateTime` — date-fns-tz 依存の整理
- [ ] `scheduleFormState.formatDateTimeLocal` — date-fns 依存の整理
- 要件: ドメインエキスパートレビュー、E2E テスト、帳票出力比較

### 別Issue候補（#911の範囲外）
- `relativeTime` 共通化 (IncidentHistoryList, RestraintHistoryList, ImportHistoryPanel)
- `MonthlySummaryTable.formatDate` — `month: 'short'` 互換確認後
- `tokuseiSurveyHelpers.formatDateTime` — assessment ドメイン見直し時
- 残インライン `toLocaleDateString` 10+件 — 段階対応
- Phase 2/3 の `@deprecated` wrapper 呼び出し元の直接置換

---

## Appendix: Type Mapping Cheat Sheet

```
既存パターン                          → 共通API
─────────────────────────────────────────────────────────
d.getFullYear()/MM/DD                 → formatDateYmd(d)
YYYY年M月D日                         → formatDateJapanese(d)
YYYY/MM/DD HH:mm                     → formatDateTimeYmdHm(d)
YYYY-MM-DD (local)                   → formatDateIso(d)
new Date(x).toLocaleDateString(...)  → formatDateTimeIntl(x, opts)
カスタム + null safety               → safeFormatDate(x, fn, fallback)
```
