# UI語彙統一 完了報告

作成日: 2026-04-09

## 1. 統一した内容
- 全利用者の日次系を `日々の記録` に統一
- IBD計画系を `支援計画シート` に統一
- IBD実施系を `支援手順の実施` に統一
- 振り返り系を `見直し・PDCA` に統一
- 正常系だけでなく、空状態・ローディング・エラー・リダイレクト・権限制御メッセージも統一
- 曖昧な CTA の `実行` を、意味が伝わる文言（例: `開始` / `行う` / `保存`）へ置換

## 2. 変更しなかった内容
- 型名・変数名・ドメイン用語・既存 API 名などの内部識別子
- `SPS` など内部表現として必要な識別子
- 一部の状態名として意味を持つ `実行`（例: `PDCA` の `DO=実行`、監査列名 `実行者`）

## 3. 品質確認
- 全量型チェック: `npm run typecheck:full` 通過
- 追加確認テスト:
  - `src/features/support-plan-guide/components/__tests__/ApprovalSection.spec.tsx`
  - `src/features/exceptions/domain/__tests__/exceptionLogic.spec.ts`
  - `src/features/exceptions/domain/__tests__/exceptionLogicBoundary.spec.ts`
  - `src/features/exceptions/domain/__tests__/buildTodayExceptions.spec.ts`
  - 結果: `4 files / 63 tests passed`

## 4. 残留例外一覧
- `src/debug/*` の開発支援 UI 文言（例: `SELECT 実行`）
- 状態・概念ラベルとして固定運用している語彙
  - `src/features/ibd/analysis/pdca/components/PdcaCycleBoard.tsx` の `実行`（DOステージ）
  - `src/features/audit/AuditPanel.tsx` の `実行者`（監査項目名）
  - `src/pages/IcebergAnalysisPage.tsx` の `会議モード実行中`（モード状態）
