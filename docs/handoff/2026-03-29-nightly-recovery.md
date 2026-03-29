# Handoff: Nightly Maintenance — Emergency Recovery — 2026-03-29

## 1. 完了したこと
- [x] **CI 緑化**: `ExceptionTable.logic.spec.ts` で発生していた `TS2783` (Duplicate ID) を修正。`tsc --noEmit` が通ることを確認済み。
- [x] **Health Score 止血**: `schedules` フィーチャー内の 21 件の `any` をすべて適切な型 (`ScheduleFormState`, `StaffOption`, `SchedItem` 等) に置換。`eslint-disable` も全削除済み。
- [x] **Health Score 回復**: `🔴 20` まで急落していたスコアを `🟡 62` までリカバリー。

## 2. 現在の状態
- ブランチ: `feat/daily-pr-3-c-1-table-row-view-model`
- 最新コミット: `d12cabc3` (ローカル修正はまだ git commit していません)
- ビルド (tsc): ✅ Pass
- テスト ( lint / vitest ): ✅ Pass
- 現状の課題: 巨大ファイル 7 件（特に `RestApiUserRepository.ts` 837行）

## 3. 残課題
| # | 課題 | 優先度 | 見積もり | 備考 |
|---|------|:------:|---------|------|
| 1 | `RestApiUserRepository.ts` の分割 | 🟠 High | 2h | 800行超の臨界ファイル。`/refactor` ワークフローを推奨 |
| 2 | 残りの巨大ファイル (6件) の監視 | 🟡 Mid | — | 700行前後のファイルが複数存在 |

## 4. 次の1手
`src/features/users/infra/RestApiUserRepository.ts` に対し `/refactor` を実行し、責務（API通信・型変換・ドメインロジック）を分離する。

## 5. コンテキスト
- **設計判断**: 今回のリカバリーでは、既存のドメイン型 (`ScheduleFormState`, `SchedItem`) を基準に props や state の型を一本化しました。これにより、後続の修正でも `any` の再混入を防げます。
- **注意点**: まだ今回の修正（tscエラー修正 + any 21件排除）は **git commit されていません**。次回のセッション開始時に `git add` / `git commit` から開始することを推奨します。

## 6. 関連Issue/PR
| 種別 | # | 状態 |
|------|---|:----:|
| PR | #1339 | 今回のベース (Merged) |
| Report | docs/nightly-patrol/2026-03-29.md | ✅ 生成済み |
| Dashboard | docs/nightly-patrol/dashboard-2026-03-29.md | ✅ 更新済み |
