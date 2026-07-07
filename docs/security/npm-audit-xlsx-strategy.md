# xlsx 対応方針（npm audit: npm-audit-separation lane 1）

更新日: 2026-07-07

## 固定範囲

- 対象: `npm audit --omit=dev` の `xlsx` 依存のみ
- 対象ブランチ: `main` ベース（このPRは docs-only）
- 変更対象: 本PRではこの `docs/security/npm-audit-xlsx-strategy.md` のみ
- 変更しない: `firebase` / `@blocknote` / lockfile / app 実装

## 監査証跡

- 収集: `npm audit --omit=dev --json > %TEMP%\npm-audit-omit-dev-xlsx-plan.json`
- 本PRで確認した `npm audit --omit=dev` の該当結果:
  - `xlsx`（direct）: High (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9)
  - `fixAvailable`: none（`fixAvailable = false`）

## xlsx 実害発生範囲（現時点）

- `src/lib/reports/xlsxUtils.ts`
  - `XLSX.utils.*` を用いたクライアント側エクスポート実装
- `src/features/reports/monthly/MonthlySummaryExcel.ts`
  - 月次集計を `exportToExcel` へ変換
- `src/features/users/UsersPanel/hooks/useUsersPanelExport.ts`
  - 月次サマリ export 時に lazy import で `MonthlySummaryExcel` を読み込み

上記以外の xlsx 生成・変換実装は `exceljs` 系（`generateSupportProcedureExcel.ts` / `generateSeikatsuKaigoExcel.ts`）
で、こちらは本PRの範囲外。

## 方針判断

`xlsx` は `fixAvailable=false` かつ direct high であり、依存更新で即時解消しづらい。
そのため、`xlsx` は「今期は置換 or 使用縮小」で扱う。

### 候補A（暫定運用継続 + 監査継続）
- 進め方: 現行導線を維持し、機能要件とリスクを運用で担保
- メリット: 実装工数が小さい
- リスク: High 脆弱性が継続（本質的な解消なし）
- 判定: **非推奨（継続はデフォルト運用として不適）**

### 候補B（機能縮小）
- 進め方:
  - 月次サマリの Excel エクスポートを一旦 CSV に置換（本PRで実装可否を別PR化）
  - `xlsx` 依存をクライアントから除去
- メリット: `xlsx` の direct high リスクを短期的に消せる
- リスク: 業務要件が「必須で `.xlsx` 形式」を要求する場合は交渉が必要
- 判定: **デフォルト実装方針として採用を推奨**

### 候補C（`xlsx` 置換）
- 進め方: `xlsx` ベース実装を別ライブラリまたは backend 経由エクスポートへ置換
- メリット: ファイル形式要件が維持しやすい
- リスク: 置換先/導入先の互換性検証コスト、導入範囲拡大
- 判定: 将来PRとして検討（フェーズ2）

## 受入/実装PRの分離

- このレーンは `xlsx` 方針決定のみ
- 実装PR（例: 月次サマリを CSV に切替）は次PRで実施
  - タイトル想定: `feat(reports): replace xlsx monthly summary export`
  - 差分要件: `src/lib/reports/xlsxUtils.ts` / `MonthlySummaryExport` 経路の差し替え
- 依存更新PR（`xlsx` 削除）は、機能切替確定後に lockfile 反映を分離して実施

## 次レーンとの分離

- `firebase` major 調査PR: 別建て（別PR）
- `@blocknote` major 調査PR: 別建て（別PR）

## 決定（この段階）

- このPRでは実コード変更なし、`xlsx` は**方針決定＋実装分割**として扱う。
- 次の小PRで、候補Bを優先して実行するか、運用要件で候補Cへ変更するかを確定する。
