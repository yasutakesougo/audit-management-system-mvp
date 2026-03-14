# Date Format Phase 3 Report

> Phase 3: 中リスク領域の段階統合 (2026-03-14)

## Summary

| 指標 | 結果 |
|---|---|
| replaced targets | 4 |
| inline replacements | 3 (toLocaleDateString) |
| skipped targets | 4+ |
| manual review required | 0 |
| regressions found | no |
| typecheck | ✅ pass |
| lint | ✅ clean |
| test | ✅ 130 tests pass (dateFormat: 58, phase2: 24, phase3: 26, handoffNav: 22) |
| build | ✅ success (45.19s) |

---

## Replaced Targets

| # | path | old formatter | new formatter | wrapper kept? | output changed? | notes |
|---|---|---|---|---|---|---|
| 1 | `features/dashboard/tabs/hooks/useRoomReservations.ts` | `formatDateDisplay` (手動実装 M/D(曜)) | `safeFormatDate` + custom formatter | yes (ラムダ wrapper) | no | `safeFormatDate` の実運用パターン確立。曜日表現はカスタムフォーマッターで表現 |
| 2 | `features/handoff/hooks/useHandoffDateNav.ts` | `formatDateLocal` (手動 YYYY-MM-DD) | `formatDateIso` | yes (デフォルト引数 `d = new Date()` 維持) | no | 12+箇所の内部呼び出しあり。wrapper のデフォルト引数が必要なため維持 |
| 3 | `pages/SupportPlanningSheetPage.tsx` | インライン `toLocaleDateString('ja-JP')` × 2件 | `formatDateTimeIntl` | no (直接置換) | no | フッターのメタ情報表示のみ。presentational |
| 4 | `features/daily/components/split-stream/RecordPanel.tsx` | インライン `toLocaleDateString('ja-JP', {y,m,d})` | `formatDateYmd` | no (直接置換) | no | Chipラベルの日付表示。`YYYY/MM/DD` 出力一致 |

---

## Inline Replacements

| # | path | old inline pattern | replacement | locale/tz notes |
|---|---|---|---|---|
| 1 | `SupportPlanningSheetPage.tsx:372` | `new Date(sheet.createdAt).toLocaleDateString('ja-JP')` | `formatDateTimeIntl(sheet.createdAt, { year:'numeric', month:'2-digit', day:'2-digit' })` | 内部で `Intl.DateTimeFormat('ja-JP', ...)` を使用。locale一致 |
| 2 | `SupportPlanningSheetPage.tsx:378` | `new Date(sheet.updatedAt).toLocaleDateString('ja-JP')` | 同上 | 同上 |
| 3 | `RecordPanel.tsx:142` | `resolvedRecordDate.toLocaleDateString('ja-JP', { year:'numeric', month:'2-digit', day:'2-digit' })` | `formatDateYmd(resolvedRecordDate)` | 手動フォーマットで locale 非依存。`YYYY/MM/DD` 固定 |

---

## Skipped Targets

| # | path | reason |
|---|---|---|
| 1 | `features/records/monthly/MonthlySummaryTable.tsx` | `formatDate` は `month: 'short'` + `hour`/`minute` を含む `toLocaleDateString` であり、`month: 'short'` の出力がブラウザ/環境依存（`3月` vs `Mar`）。テスト固定が困難かつ互換性保証不可 |
| 2 | `features/assessment/tokuseiSurveyHelpers.ts` | `formatDateTime` は `'未入力'` fallback + invalid→raw value の独自仕様。`safeFormatDate` で表現可能だが、`Intl.DateTimeFormat` の `2-digit` オプションとの組み合わせで出力差異リスクあり |
| 3 | `features/safety/components/IncidentHistoryList.tsx` | `relativeTime` 関数の最終 fallback として `toLocaleDateString('ja-JP', { month:'short', day:'numeric' })` を使用。落差7日以上経過時のみ発火するため部分置換で関数を分解する必要がありコスト大 |
| 4 | `features/safety/components/RestraintHistoryList.tsx` | 同上。IncidentHistoryList と同パターンの `relativeTime` 関数 |
| 5 | `features/import/components/ImportHistoryPanel.tsx` | 同上。`formatRelativeTime` は同パターン |
| 6 | `features/daily/components/TableDailyRecordUserPicker.tsx` | `toLocaleDateString('ja-JP', { month:'short', day:'numeric', weekday:'short' })` — 曜日付き short month。`safeFormatDate` で表現可能だが `short` の出力環境依存が懸念 |
| 7 | `features/dashboard/BriefingPanel.tsx` | `toLocaleDateString('ja-JP', { year, month:'long', day:'numeric', weekday:'long' })` — `long` weekday。環境依存大 |
| 8 | `features/dashboard/tabs/RoomManagementTabs.tsx` | `toLocaleDateString('ja-JP', { year, month:'long' })` — 月のみ表示。前後へのインパクト小 |
| 9 | `features/analysis/*` | `toLocaleDateString('ja-JP', { month:'numeric', day:'numeric' })` — グラフ軸ラベル。視覚変化リスク |
| 10 | `features/assessment/components/ImportSurveyDialog.tsx` | `toLocaleDateString()` — デフォルト locale（ブラウザ依存） |

---

## tokuseiSurveyHelpers.formatDateTime — 評価結果

### 現仕様
```typescript
export const formatDateTime = (value: string): string => {
  if (!value) return '未入力';       // empty → 固有ラベル
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value; // invalid → raw value
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(date);
};
```

### 評価
- `safeFormatDate` + `formatDateTimeIntl` で理論上は表現可能
- ただし:
  1. `'未入力'` という固有 fallback は `safeFormatDate` の第3引数で指定可能
  2. invalid → raw value は `||` フォールバックで対応可能
  3. しかし、このファイルは assessment ドメインに近く、Phase 3 後半で触るにはリスクが高い
- **結論**: Phase 4 以降で、assessment ドメイン全体の見直し時に一緒に対応推奨

---

## Test Coverage Added/Updated

| file | verified behavior |
|---|---|
| `tests/unit/dateFormat-phase3-integration.spec.ts` (新規 / 26テスト) | useRoomReservations の M/D(曜) 互換性、useHandoffDateNav の YYYY-MM-DD 出力一致（デフォルト引数含む）、SupportPlanningSheetPage の Intl 出力、RecordPanel の formatDateYmd 出力一致 |
| `tests/unit/dateFormat.spec.ts` (既存 / 58テスト) | 変更なし。共通 API 仕様テスト |
| `tests/unit/dateFormat-phase2-integration.spec.ts` (既存 / 24テスト) | 変更なし。Phase 2 統合確認テスト |
| `src/features/handoff/__tests__/useHandoffDateNav.spec.ts` (既存 / 22テスト) | 変更なし。pure helpers テスト全パス（formatDateLocal のリグレッションなし） |

---

## Risks Observed

### locale
- `SupportPlanningSheetPage` の2件が `Intl.DateTimeFormat('ja-JP', ...)` に依存。CI/ブラウザ環境で出力形式が一致する前提。共通 API の `formatDateTimeIntl` が同じ `Intl` パスを使うため、旧実装との差分はゼロ
- **残存リスク**: `MonthlySummaryTable`, `TableDailyRecordUserPicker` 等の `month: 'short'` パターンは環境依存出力のため見送り継続

### timezone
- 影響なし。すべてローカルタイムゾーンの DateAPI を使用。TZ 変換ロジックは一切触っていない

### fallback semantics
- `useRoomReservations.formatDateDisplay`: invalid date 入力時 → `safeFormatDate` の第3引数で元の文字列を返す（旧実装と同一）
- `useHandoffDateNav.formatDateLocal`: default `d = new Date()` を wrapper で維持。null/undefined は入力されない設計

### special labels
- `useHandoffDateNav`: 「今日」「昨日」のラベル生成は `formatDateLabel` 関数が担当。`formatDateLocal` はその内部で日付文字列生成に使われるだけ。ラベルロジックは完全に維持

### readability concerns
- `useRoomReservations` の `safeFormatDate` + ラムダ: ローカル変数 `WEEKDAY_LABELS` を分離し、ラムダ本体を短く保った。旧実装より若干複雑だが許容範囲

---

## Recommended Phase 4 Candidates

### 高優先
1. `MonthlySummaryTable.formatDate` — `month: 'short'` の出力確認ができれば `formatDateTimeIntl` で置換可能
2. `tokuseiSurveyHelpers.formatDateTime` — assessment ドメイン見直し時に対応
3. `relativeTime` 系3ファイルの共通化 — 同一パターンの `relativeTime` が3ファイルに散在。共通ヘルパーとして `lib/dateFormat.ts` に追加すべき

### 中優先
4. `TableDailyRecordUserPicker` — `month: 'short'`, `weekday: 'short'` の `safeFormatDate` 化
5. `BriefingPanel` — `weekday: 'long'` + `month: 'long'` の `formatDateTimeIntl` 化
6. `RoomManagementTabs` — `month: 'long'` のみ
7. analysis 系2ファイル — グラフ軸ラベル

### wrapper 削除候補
8. Phase 2 の wrapper 関数群（`formatDateJP`, `formatDate`, `formatDateLocal` 等）を直接呼び出しに順次変更

---

## 変更ファイル一覧

### ソースファイル (4件)
- `src/features/dashboard/tabs/hooks/useRoomReservations.ts`
- `src/features/handoff/hooks/useHandoffDateNav.ts`
- `src/pages/SupportPlanningSheetPage.tsx`
- `src/features/daily/components/split-stream/RecordPanel.tsx`

### テストファイル (1件)
- `tests/unit/dateFormat-phase3-integration.spec.ts` (新規)

### ドキュメント (2件)
- `docs/date-format-inventory.md` (更新)
- `docs/date-format-phase3-report.md` (本ファイル、新規)
