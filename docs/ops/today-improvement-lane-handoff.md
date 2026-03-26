# /today 改善レーン 完了ハンドオフ（2026-03-26）

## 1. 結果（実装済み）

- PR-1: `/today` hydration 監視対象化
  - route key / matcher / budget / tests を追加
- PR-2: `/today` 系 `Users_Master` 読取整流
  - `useUsersQuery` を shared read hook として導入
  - Today 周辺 consumer を共通経路へ置換
- PR-3: 失敗UX SSOT化
  - `operationFeedback` を新設し、`412 conflict` / `optimistic rollback` / `non-blocking sync failure` を統一
  - Schedules と Today(Transport/UserStatus) の表示契約を統一
- 追確認: `tests/e2e/schedule-week.conflict.spec.ts` green
  - create失敗(412)で conflict feedback が表示されることを実UIで確認

## 2. 主要検証

- Vitest（PR-3関連 + SSOT）: pass
- Hydration 関連テスト: pass
- E2E (`schedule-week.conflict.spec.ts`): pass
- `typecheck`: pass
- `eslint`: pass

## 3. 運用上の意味

- `/today` は「監視される」「重複読取を抑える」「失敗理由が伝わる」状態へ到達
- 監視・読取・失敗体験の3層で最低限の運用品質を満たした

## 4. PR本文ドラフト（貼り付け用）

```md
## 背景

- `/today` は現場オペレーションの中核画面であり、可観測性・読取効率・失敗時UXの3点を優先改善する必要がありました。
- 本PRは `/today` 改善レーン（PR-1〜PR-3）を統合して、実装・検証を完了させるものです。
- **影響範囲:** `/today` 実行レイヤー（監視 / Users読取 / 失敗UX）に限定、他画面の挙動変更なし。

## 変更内容

- PR-1: `/today` hydration 監視対象化
  - route key / matcher / budget を追加
  - hydration 関連テストを更新
- PR-2: `useUsers` 読取整流
  - `useUsersQuery` を shared read hook として導入
  - `/today` 配下の主要 consumer を共通 query key 経路へ置換
  - dedupe 観点のテストを追加
- PR-3: 失敗UX SSOT化
  - `operationFeedback` を追加
  - `412 conflict` / `optimistic rollback` / `non-blocking sync failure` の表示契約を統一
  - create/update 双方で conflict 判定が同一契約になるよう調整
- 追確認: E2E (`tests/e2e/schedule-week.conflict.spec.ts`)
  - 現行UIに合わせて起動経路を安定化
  - create失敗時(412)の conflict feedback 表示を実UIで確認

## 検証

- Vitest（SSOT/関連ユニット）: pass
- Hydration 関連テスト: pass
- Playwright: `tests/e2e/schedule-week.conflict.spec.ts` pass
- `npm run typecheck`: pass
- `eslint`（変更ファイル）: pass

## ドキュメント

- `docs/ops/today-side-effects-audit-matrix.md` を更新（副作用契約・監視状態）
- `docs/ops/today-improvement-pr-candidates.md` を更新（3PR完了 + E2E追確認）
- `docs/ops/today-improvement-lane-handoff.md` を追加（完了ハンドオフ + PR本文ドラフト）

`/today` を監視・取得・失敗体験の3点で改善したレーン完了PRです。
```
