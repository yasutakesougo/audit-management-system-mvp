# Handoff — 2026-03-22 Nightly Patrol Phase B 完成

## 今回の作業内容

### P0: ワークフロー文書 3 本を作成

既存資産の棚卸しを実施し、3 つの新規 Agent は不要と判断。
代わりに「操作マニュアル」としてのワークフロー文書を作成。

| ワークフロー | ファイル | 目的 |
|------------|---------|------|
| `/orchestrator` | `.agents/workflows/orchestrator.md` | 既存 Orchestrator パターンの選択ガイド |
| `/nightly` | `.agents/workflows/nightly.md` | patrol 結果の操作手順・Phase ロードマップ |
| `/sp-schema` | `.agents/workflows/sp-schema.md` | SP インフラの正しい使い方 |

### P1: Issue Draft 生成 (Phase B-1)

`nightly-patrol.mjs` に Phase B を追加。巨大ファイル / any / テスト不足の 3 種類。

| ファイル | 変更種別 |
|---------|---------|
| `scripts/ops/buildIssueDrafts.mjs` | 新規: 純関数 |
| `scripts/ops/renderIssueDraftMarkdown.mjs` | 新規: Markdown 整形 |
| `scripts/ops/nightly-patrol.mjs` | 追加: import + 後段呼び出し |

### Phase B-2: TODO/FIXME + Handoff 追加

`buildIssueDrafts.mjs` に 2 つの Draft Builder を追加。
`nightly-patrol.mjs` は 1 行変更のみ（`patrolResults` にフィールド追加）。
`renderIssueDraftMarkdown.mjs` は変更なし（汎用性が証明された）。

## 現在の状態

### Nightly Patrol Phase ロードマップ

| Phase | 状態 |
|:-----:|:----:|
| A (観測) | ✅ |
| B-1 (巨大ファイル / any / テスト不足) | ✅ |
| B-2 (TODO/FIXME / Handoff) | ✅ |
| B-3 (重複検知・マージ) | ⏳ 次候補 |
| C (承認付き自動 Issue) | ⏳ |
| D (自動 PR) | ⏳ |

### 今日のリポジトリ実データでの Draft 結果

| # | Severity | Title |
|:-:|:--------:|-------|
| 1 | 🔴 critical | SupportPlanningSheetPage.tsx (859行) 分割 |
| 2 | 🔴 critical | TelemetryDashboard.tsx (836行) 分割 |
| 3 | 🔴 critical | テスト未整備 14 feature |
| 4 | 🟠 high | 巨大ファイル 6件 監視 |

TODO (11件 < 閾値20) と Handoff (2日前更新 < 閾値7日) は正しく静観。

## 未完了タスク

- [ ] **数日観測**: Draft が毎日同じ文面にならないか、severity が体感と合っているか
- [ ] **B-3 実装**: 重複検知（継続 / 新規 / 悪化の分類）
- [ ] **1件実 Issue 化**: Draft をそのまま GitHub Issue にして運用検証

## 次回の推奨作業

1. `docs/nightly-patrol/issue-drafts-*.md` を 3〜5 日分確認する
2. B-3 の設計を決める（前日の Draft との diff ベースが有力）
3. 4 件のうち最も対応しやすいものを 1 件だけ実 Issue 化

## 注意点

- `buildIssueDrafts.mjs` は純関数なので単体テスト追加が容易
- CI (`nightly-patrol.yml`) は `docs/nightly-patrol/` 全体を git add するので Issue Draft も自動 commit される
- `renderIssueDraftMarkdown.mjs` は汎用。新しい category を追加しても変更不要
- `_groupByDirectory` は B-3 用に予約済み（未使用プレフィックス付き）
