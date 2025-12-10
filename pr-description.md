<!-- PR description for gh pr create -->
# Schedules acceptance & SP update

## 概要

- 受け入れ登録を Week / Day 両ビューと FAB クイック作成に統合し、SharePoint と往復同期できるようにしました。

## 主な変更点

- Week / Day に受け入れ登録 UI とフッター・チップ表示を追加
- FAB（＋）のクイック作成でも受け入れ情報を保存・表示
- SharePoint ポートに update 実装（acceptedBy/acceptedOn/acceptedNote を往復反映）
- acceptance フローの E2E (`schedule-week.acceptance.spec.ts`) を追加
- Week / Day 全 E2E ロケータを strict モード対応に刷新
- Unit tests（`ScheduleCreateDialog`, `schedule.tabs`）のロケータを最新 UI に追従

## テスト状況

- `npx playwright test schedule-week --reporter=line --workers=1`（17/17 pass）
- `npx playwright test schedule-day --reporter=line --workers=1`（12/12 pass）
- `npm run test -- --run ScheduleCreateDialog.spec.tsx schedule.tabs.spec.tsx --reporter=verbose`

## 確認ポイント（レビュア向け）

- 受け入れダイアログで acceptedBy/acceptedOn/acceptedNote が SP に往復反映されること
- Week / Day で「受け入れ済み」表示とフッターが意図どおりに出ること（未登録時プレースホルダー含む）
- FAB クイック作成後、受け入れ情報がカード/フッターに反映されること
- E2E ロケータ更新で false positive/negative がないこと（strict locator の妥当性）
- Unit でラベル変更やフィールド必須が正しくカバーされていること

## マージ後のフォローアップ

- UI 微調整（Week チップのアイコン/ツールチップ、Day フッター強調）を検討・実装
- docs: `docs/ops/schedules-prod-checklist.md` に運用ルール追記（受け入れ必須・acceptedBy 記録）
