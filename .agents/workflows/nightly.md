---
description: Nightly AI — Nightly Patrol の結果確認・Issue Draft 生成・運用サイクルの実行
---

# Nightly AI ワークフロー

あなたは Nightly Patrol の運用サイクルを回すオペレーターです。
**新しい仕組みを作るのではなく、既存の patrol + metrics 基盤を操作します。**

## コンテキスト

### 稼働中の基盤（触らない）

| 基盤 | ファイル | 実行タイミング |
|------|---------|:----------:|
| **Nightly Patrol** | `scripts/ops/nightly-patrol.mjs` | JST 03:15 (自動) |
| **OS Metrics** | `scripts/ops/os-metrics.mjs` | patrol 直後 (自動) |
| **Nightly Health CI** | `.github/workflows/nightly-health.yml` | JST 03:00 (自動) |
| **Nightly Patrol CI** | `.github/workflows/nightly-patrol.yml` | JST 03:15 (自動) |
| **Monthly Audit** | `.github/workflows/monthly-audit.yml` | 毎月1日 JST 03:00 |
| **Triage ワークフロー** | `.agents/workflows/triage.md` | 手動 `/triage` |

### Patrol が検知する 5 観点

| # | 観点 | 閾値 (🟡/🔴) | 解決手段 |
|---|------|:----------:|---------|
| 1 | 巨大ファイル (≥600行) | 3 / 8 | `/refactor` |
| 2 | 型安全性 (any) | 10 / 30 | `/review` |
| 3 | TODO/FIXME/HACK | 20 / 50 | Issue 化 |
| 4 | テスト未整備 feature | 2 / 5 | `/test-design` |
| 5 | Handoff 未実施 | — | `/handoff` |
| 6 | インデックス圧迫 | 18 / 20 | 修復コマンド提示 |

### Quality Gate（CI パイプライン）

| ゲート | ファイル | 発火条件 |
|--------|---------|---------|
| CI Preflight | `.github/workflows/ci-preflight.yml` | PR 作成時 |
| CI (lint + typecheck + test) | `.github/workflows/ci.yml` | PR 作成時 |
| PR Guardrails | `.github/workflows/pr-guardrails.yml` | PR マージ前 |
| Smoke E2E | `.github/workflows/smoke.yml` | PR + main |
| Deep E2E | `.github/workflows/e2e-deep.yml` | main + nightly |
| Regression | `.github/workflows/regression.yml` | main |
| SP Schema Label | `.github/workflows/label-schema-changes.yml` | PR (provision/ 変更時) |

### テレメトリ基盤

| 基盤 | ファイル | 責務 |
|------|---------|------|
| Fetch Span | `src/telemetry/fetchSpan.ts` | SP/Graph 通信トレース |
| Circuit Breaker | `src/lib/circuitBreaker/evaluator.ts` | Shadow (HUD のみ) |
| SP Telemetry | `src/lib/sp/telemetry.ts` | SP 操作テレメトリ |
| Today Telemetry | `src/features/today/telemetry/` | CTA 追跡 |
| Telemetry Dashboard | `src/features/telemetry/` | KPI 計算・Issue Draft |

### Runbook 一覧

| Runbook | ファイル |
|---------|---------|
| Operations | `docs/operations/operations-runbook.md` |
| Flaky Test | `docs/FLAKY_TEST_RUNBOOK.md` |
| Playwright Smoke | `docs/PLAYWRIGHT_SMOKE_RUNBOOK.md` |
| Today Execution | `docs/TODAY_EXECUTION_LAYER_RUNBOOK.md` |
| Quality Baseline | `docs/ops/quality-baseline-runbook.md` |
| Weekly Review | `docs/ops/ops-weekly-review-runbook.md` |
| Monitoring Hub | `docs/ops/monitoring-hub-v1-runbook.md` |

## 手順

### A. 朝のトリアージ（`/triage` の代替手順）

1. 最新の patrol レポートを確認する
   ```
   docs/nightly-patrol/YYYY-MM-DD.md
   docs/nightly-patrol/dashboard-YYYY-MM-DD.md
   ```
   // turbo

2. ステータスを確認する

   | 確認項目 | 見る場所 |
   |---------|---------|
   | 🔴 がないか | patrol レポートの Status テーブル |
   | Health Score | dashboard の Health Score |
   | CI の状態 | GitHub Actions の最新実行結果 |

3. 🔴 または 🟡 がある場合、Issue Draft を生成する

   ```markdown
   ## Issue Draft: [観点名]

   ### 検知内容
   - 観点: [巨大ファイル / any / TODO / テスト未整備]
   - 件数: X 件
   - ステータス: 🔴 or 🟡
   - 検知日: YYYY-MM-DD

   ### 対象ファイル (上位5件)
   | ファイル | 値 | 推奨アクション |
   |---------|:--:|-------------|

   ### 推奨ワークフロー
   - `/refactor` — 巨大ファイルの場合
   - `/review` — any の場合
   - `/test-design` — テスト未整備の場合

   ### Labels
   - `nightly-patrol`
   - `tech-debt`
   - `priority-[high|medium|low]`
   ```

4. Issue Draft をユーザーに提示する（自動作成はしない）

### B. 週次レビュー

1. 7日分の patrol レポートのトレンドを確認する
   // turbo

2. 以下を出力する:

   ```markdown
   ## Weekly Nightly Review — YYYY-MM-DD

   ### Health Score 推移
   | 日 | Score | Grade | 変化 |
   |----|:-----:|:-----:|:----:|

   ### 改善・悪化した観点
   | 観点 | 先週 | 今週 | 方向 |
   |------|:----:|:----:|:----:|

   ### 今週の推奨アクション (優先度順)
   1. ...
   2. ...
   3. ...
   ```

### C. CI 失敗時の対応

1. 失敗した workflow を特定する

2. 以下の Runbook を参照して対応する:
   - E2E 失敗 → `docs/FLAKY_TEST_RUNBOOK.md`
   - SP 関連 → `docs/ops/monitoring-hub-v1-runbook.md`
   - 型エラー → `npx tsc --noEmit` で確認
   - lint → `npm run lint` で確認

3. 対応結果を出力する

## 禁止事項

- **patrol スクリプトを書き換えない**（拡張は別 PR で）
- **Issue を自動作成しない**（Draft を提示するのみ）
- **CI ワークフローの閾値を勝手に変えない**
- **テレメトリの計測ポイントを削除しない**
- **Runbook に書いていない対応を独自にやらない**

## フェーズロードマップ

| Phase | 状態 | 内容 |
|:-----:|:----:|------|
| **A (観測)** | ✅ 導入済み | patrol scan + dashboard |
| **B (Autonomous)** | ✅ 導入済み | インフラ修復提案付き Issue Draft 生成 |
| **C (自動 Issue)** | ⏳ 次フェーズ | 承認付き自動 Issue 作成 |
| **D (自動 PR)** | ⏳ 将来 | 単純修正の PR 自動生成 |
