# イソカツ AI Dev OS

> **AIで回る開発運用システム** — 観測 → 判断 → 実行 → 記録 の自律ループ

## Overview

```
 🌙 深夜     Nightly Patrol → コード品質スキャン → Health Score 算出
     ↓
 🌅 朝       /triage → レポート確認 → 🔴 を1件選択 → Issue化
     ↓
 ☀️ 日中     /scan → /define → /design → /implement → /review → /fortress → /pr
     ↓
 🌆 終業     /handoff → 引き継ぎ記録 → docs/handoff/
     ↓
 🌙 深夜     Nightly Patrol（翌日）
```

## Quick Start

```bash
# パトロール + ダッシュボード（推奨: 連続実行）
npm run patrol:full

# 個別実行する場合（必ずこの順）
npm run patrol
npm run patrol:dashboard

# レポート確認
cat docs/nightly-patrol/$(date +%Y-%m-%d).md
```

## Commands (26)

| Phase | Commands |
|:-----:|----------|
| 0. Scan | `/scan` `/triage` |
| 1. Define | `/define` |
| 2. Design | `/architect` `/design` `/sp-schema` `/plan-sheet` `/record-design` |
| 3. Build | `/implement` `/powerapps` `/flow` `/react-feature` `/cursor-task` |
| 4. Verify | `/review` `/fortress` `/compliance` `/test` `/test-design` `/ux-review` `/debug` |
| 5. Package | `/issue` `/pr` `/handoff` `/docs` `/refactor` `/refactor-plan` |

## Architecture

📄 [Full Architecture Diagram](docs/ai-dev-os/ARCHITECTURE.md)

## Key Files

| File | Purpose |
|------|---------|
| `.agents/workflows/*.md` | 26 command workflows |
| `.github/workflows/nightly-patrol.yml` | Nightly code quality scan |
| `scripts/ops/nightly-patrol.mjs` | Patrol scanner |
| `scripts/ops/os-metrics.mjs` | Metrics dashboard generator |
| `docs/operations/ai-dev-os-rules.md` | 5 operational rules |
| `docs/handoff/` | Session handoff documents |
| `docs/nightly-patrol/` | Patrol reports & dashboards |

## Health Score

```
Score = 100 − (large_files × 5) − (any × 2) − (untested × 3) − (todo × 1) + (handoff × 5)

A: 80-100  B: 60-79  C: 40-59  D: 20-39  F: 0-19
```

## Principles

1. **Code later** — まず要件を分解する
2. **Separate first** — UI / state / data / 業務ルールを混ぜない
3. **Audit-ready** — 制度・監査まで含めて設計
4. **Role, not task** — AIには責務と出力形式を渡す
5. **Always asset** — 毎回 Issue / PR / 手順書に落とす
