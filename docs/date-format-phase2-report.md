# Date Format Phase 2 Report

> Phase 2: 低リスク領域の安全置換 (2026-03-14)

## Summary

| 指標 | 結果 |
|---|---|
| replaced targets | 6 |
| skipped targets | 1 |
| manual review required | 0 |
| regressions found | no |
| typecheck | ✅ pass |
| lint | ✅ clean |
| test | ✅ 89 tests pass (dateFormat: 58, phase2-integration: 24, MonitoringCountdown: 7) |
| build | ✅ success (45.48s) |

---

## Replaced Targets

| # | path | old formatter | new formatter | output changed? | notes |
|---|---|---|---|---|---|
| 1 | `features/support-plan-guide/utils/helpers.ts` | `formatDateJP` (ローカル実装) | `formatDateYmd` via alias | no | `Date?` → `YYYY/MM/DD / ''` 完全一致。alias `formatDateJP` を残し呼び出し元変更なし |
| 2 | `features/ibd/plans/support-plan/supportPlanDeadline.ts` | `formatDateJP` (ローカル実装) | `formatDateYmd` via alias | no | #1 の完全コピーだった。同パターンで置換 |
| 3 | `features/daily/components/MonitoringCountdown.tsx` | `formatDate` (ローカル const) | `formatDateYmd` via wrapper | no | `Date` → `YYYY/MM/DD` 完全一致。tooltip 表示専用 |
| 4 | `features/users/UserDetailSections/helpers.tsx` | `formatDateLabel` (手動parse) | `formatDateJapanese` + fallback wrapper | no | `string?` → `YYYY年M月D日` 完全一致。parse失敗時は元値を返す既存動作を保持 |
| 5 | `features/schedules/components/DaySummaryDrawer.tsx` | `formatDateDisplay` (手動parse) | `formatDateJapanese` via wrapper | no | `ISO string` → `YYYY年M月D日` 完全一致。不要になった `parseDateIso` を削除 |
| 6 | `features/daily/infra/InMemoryDailyRecordRepository.ts` | `formatDateLocal` (手動実装) | `formatDateIso` via wrapper | no | `Date` → `YYYY-MM-DD` 完全一致。InMemory リポジトリのシード生成用 |

---

## Skipped Targets

| # | path | reason |
|---|---|---|
| 1 | `features/dashboard/tabs/hooks/useRoomReservations.ts` | `formatDateDisplay` は `M/D(曜)` 形式（曜日つき）。`safeFormatDate` で置換可能だが hook 内ローカル関数で影響が限定的。カスタムフォーマッター記述が必要で差分の可読性メリットが小さい。Phase 3 に繰り越し |

---

## Test Coverage Added/Updated

| file | what was verified |
|---|---|
| `tests/unit/dateFormat-phase2-integration.spec.ts` (新規 / 24テスト) | 全置換対象について旧実装と新実装の出力一致を検証。valid date, single-digit month/day, year-end, null, undefined, invalid string, ISO datetime string のパターンをカバー |
| `tests/unit/dateFormat.spec.ts` (既存 / 58テスト) | 変更なし。共通 API の仕様固定テストとして引き続き有効 |
| `src/features/daily/__tests__/MonitoringCountdown.spec.ts` (既存 / 7テスト) | 変更なし。`computeMonitoringCycle` のロジックテストがパスすることを確認 |

---

## Risks Observed

### locale
- 影響なし。置換対象はすべて手動フォーマット（`Intl` 非使用）。共通 API も手動フォーマット。

### timezone
- 影響なし。すべてローカルタイムゾーンの `getFullYear/getMonth/getDate` を使用する関数の置換。TZ 変換ロジックは一切触っていない。

### null fallback
- `formatDateJP` (2箇所): `undefined` → `''` — 共通 API の `formatDateYmd(null)` → `''` と一致
- `formatDateLabel` (UserDetailSections): `null|undefined|''` → `'未設定'` — wrapper で保持
- `formatDateLabel` parse失敗時: 元の値を返す — `formatDateJapanese` が `''` を返すことを利用して `|| value` フォールバックで保持
- `formatDate` (MonitoringCountdown): null 入力なし（常に `Date` オブジェクト渡し）
- `formatDateLocal` (InMemory): null 入力なし（常に `Date` オブジェクト渡し）

### semantic wrapper behavior
- 既存の wrapper 関数名 (`formatDateJP`, `formatDate`, `formatDateDisplay`, `formatDateLocal`) はすべて残して内部委譲のみ変更。呼び出し元のコード変更ゼロ。
- `@deprecated` アノテーションを追加し、将来的な直接呼び出しへの移行を促進。

---

## Recommended Phase 3 Candidates

### 高優先
1. `useRoomReservations.formatDateDisplay` → `safeFormatDate` (Phase 2 繰り越し)
2. `useHandoffDateNav.formatDateLocal` → `formatDateIso` (完全同一ロジック)

### 中優先
3. `MonthlySummaryTable.formatDate` → `formatDateTimeIntl`
4. インライン `toLocaleDateString` 呼び出し (13件) → `formatDateTimeIntl` への段階移行

### 慎重
5. `tokuseiSurveyHelpers.formatDateTime` → 独自 fallback 仕様 (`'未入力'`, invalid → raw value) の互換性確認が必要

---

## 変更ファイル一覧

### ソースファイル (6件)
- `src/features/support-plan-guide/utils/helpers.ts`
- `src/features/ibd/plans/support-plan/supportPlanDeadline.ts`
- `src/features/daily/components/MonitoringCountdown.tsx`
- `src/features/users/UserDetailSections/helpers.tsx`
- `src/features/schedules/components/DaySummaryDrawer.tsx`
- `src/features/daily/infra/InMemoryDailyRecordRepository.ts`

### テストファイル (1件)
- `tests/unit/dateFormat-phase2-integration.spec.ts` (新規)

### ドキュメント (2件)
- `docs/date-format-inventory.md` (更新)
- `docs/date-format-phase2-report.md` (本ファイル、新規)
