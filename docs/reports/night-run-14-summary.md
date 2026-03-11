# Night Run 14 — BusinessJournalPreviewPage.tsx 分割

**Date:** 2026-03-11
**Status:** ✅ 分割完了・全チェック pass
**Typecheck:** ✅ Pass
**Lint:** ✅ Pass (0 warnings)
**Tests:** ✅ 3,230 passed (no regression)

---

## ゴール

`BusinessJournalPreviewPage.tsx` を **薄いオーケストレーター** に削減し、UI ロジックを責務ごとに分離されたコンポーネントに抽出する。

---

## 前後比較

### 分割前（2ファイル）

| ファイル | 行数 |
|---------|------|
| `BusinessJournalPreviewPage.tsx` | 290 |
| `BusinessJournalPreviewSections.tsx` | 243 |
| **合計** | **533行（2ファイル）** |

### 分割後（4ファイル）

| ファイル | 行数 | 責務 |
|---------|------|------|
| `BusinessJournalPreviewPage.tsx` | **128** | State management + composition |
| `BusinessJournalPreviewControls.tsx` | 92 | Header + MonthSelector + Legend |
| `BusinessJournalPreviewGrid.tsx` | 187 | Sticky-header monthly grid table |
| `BusinessJournalPreviewSections.tsx` | 243 | CellContent + DetailDialog（変更なし） |
| **合計** | **650行（4ファイル）** | — |

> 合計行数は増えているが、各ファイルの **単一責務** が明確になり、
> 個別テスト・レビュー・変更が格段に容易になる。

---

## 抽出内容

### `BusinessJournalPreviewControls.tsx`（新規）

ページ上部の3要素をまとめたコンポーネント：

1. **PageHeader** — タイトル「業務日誌プレビュー」+ 説明文
2. **MonthSelector** — `<TextField select>` による月選択（`journal-preview-month-select` testid）
3. **ColourLegend** — 出欠ステータスと食事量の凡例

また `MonthOption` 型を export して型の SSOT をここに持つ。

```tsx
<BusinessJournalPreviewControls
  selectedYear={selectedYear}
  selectedMonth={selectedMonth}
  monthOptions={monthOptions}
  onMonthChange={handleMonthChange}
/>
```

### `BusinessJournalPreviewGrid.tsx`（新規）

月間グリッドテーブル全体（sticky header + 利用者行）：

- `TableContainer` > `Table` > `TableHead` / `TableBody`
- 日付ヘッダー（曜日カラー）
- 利用者名セル（sticky left、PersonalJournal リンク）
- 日次データセル（Tooltip + CellContent）
- `buildPersonalJournalUrl` ヘルパーを内包（URL構築ロジックをページから分離）

```tsx
<BusinessJournalPreviewGrid
  data={data}
  selectedYear={selectedYear}
  selectedMonth={selectedMonth}
  dayHeaders={dayHeaders}
  onCellClick={handleCellClick}
/>
```

### `BusinessJournalPreviewPage.tsx`（スリム化）

State + Event handlers + 最小限の Composition のみ：

- `selectedYear`, `selectedMonth`, `dialogOpen`, `selectedUser`, `dialogUserId`, `selectedEntry` の state
- `monthOptions` の useMemo
- `handleMonthChange`, `handleCellClick`
- Summary footer（利用者数 + 表示月）
- DetailDialog の呼び出し

---

## 設計上の決断

### なぜ `buildPersonalJournalUrl` を Grid 内に置いたか

元のページでは `personalJournalUrl` 構築がインライン2行で行われていたが、将来的にURLパターンが変わった際に `Grid` だけ修正すれば済む。PageとGridの結合を減らすため `Grid` 内部に封じた。

### `MonthOption` 型を Controls に export した理由

月選択の具体的な shape（`value/label/year/month`）は Controls と Page の間の契約。Controls が型を所有し、Page が `import { MonthOption }` で型安定性を維持する。

### BusinessJournalPreviewSections.tsx を変更しなかった理由

`CellContent` + `DetailDialog` は Wave 2 分割で既に独立しており、今回の責務分割とは直交する。手を加えると変更範囲が広がるため対象外にした。

---

## ファイル構成（分割後）

```
src/pages/
├── businessJournalPreviewHelpers.ts     ← 型・定数・純関数（変更なし）
├── businessJournalPreview.mock.ts       ← モックデータ生成（変更なし）
├── BusinessJournalPreviewControls.tsx   ← ★ 新規：Header / Selector / Legend
├── BusinessJournalPreviewGrid.tsx       ← ★ 新規：Monthly grid table
├── BusinessJournalPreviewSections.tsx   ← CellContent / DetailDialog（変更なし）
└── BusinessJournalPreviewPage.tsx       ← ★ 更新：Orchestrator only（290→128行）
```

---

## 検証結果

| Check | Result |
|-------|--------|
| `npm run typecheck` | ✅ Exit 0 |
| `npm run lint` | ✅ Exit 0 (0 warnings) |
| `npx vitest run` | ✅ 3,230 passed / 0 failed |

---

## Night Run 累計状態

| # | 内容 | 結果 |
|---|------|------|
| NR 1–3 | インフラ / 型安全強化 | ✅ |
| NR 4 | useUserForm.ts 4分割 | ✅ |
| NR 5 | useUserFormHelpers 30 tests | ✅ |
| NR 6 | parseTransportSchedule Array.isArray guard | ✅ |
| NR 7 | pipeline round-trip tests | ✅ |
| NR 8 | serializeTransportSchedule guard | ✅ |
| NR 9 | serviceProvisionFormHelpers 31 tests | ✅ |
| NR 10 | StaffForm 597→149 lines | ✅ |
| NR 11 | useStaffForm + sections 80 tests | ✅ |
| NR 12 | StaffForm Playwright E2E 12 tests | ✅ |
| NR 13 | BulkDailyRecordList flaky timeout 修正 | ✅ |
| **NR 14** | **BusinessJournalPreviewPage 4ファイル分割** | **✅** |
