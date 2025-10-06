# QA + Notify (Phase 2) — TL;DR

## 目的
- 主要フローの E2E 自動化と a11y 確認を恒常運用に載せる
- 失敗検知を通知で可視化

## 実装スコープ
- **E2E:** Playwright（Chromium）で 週/日/月 表示と作成/編集を通し検証
- **a11y:** jest-axe / axe-core によるクリティカル違反 0 を担保
- **通知:** 失敗時のみ Webhook（チャット/Slack 等）へポスト
- **CI:** Quality Gates（lint / test / typecheck）→ E2E、Nightly Health＋E2E
- **安定化:** リトライ(2)、1回目失敗で Trace/Video を出力

## 使い方
- ヘルスチェック: `npm run health`
- セルフヒール試行: `npm run heal:try`
- E2E: `npm run e2e`（必要に応じて `--headed`）
- CI: 既存の「Quality Gates」＋ E2E ジョブが走る

## 運用メモ
- E2E の外部依存は MSW/モックで吸収
- a11y 違反はスナップショット更新ではなく UI/ラベル修正で解消
- Flaky は自動リトライと trace で切り分け
