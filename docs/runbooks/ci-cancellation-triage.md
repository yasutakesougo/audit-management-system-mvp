# CI Cancellation Triage Runbook

更新日: 2026-06-23

## 目的

`#2334` の追跡対象である CI のキャンセル/集約挙動を、次の観点で分類し、PR差分起因とCI基盤側の影響を分離する。

- PR差分起因の実障害
- flaky / infra 由来の失敗
- 部分再試行時の aggregate false negative
- Playwright / Deep / Quality の直接 cancel
- unit shard 再試行時の別 shard canceled

## 分類カテゴリ

### 1) PR-diff-caused failure

- 単体失敗 / テスト失敗が `failure` で、再試行しても同一シグネチャで継続
- `head SHA`/`merge commit SHA`を添えて、対象PR変更範囲と照合
- 再現対象: 同一テスト、同一 assertion failure、同一 fixture path

### 2) flaky or infra cancellation

- `failure` / `timed_out` / `startup_failure` / `action_required` / `stopped`
- 再実行で成功/失敗が揺れる、またはインフラ側手順の影響が明示的

### 3) partial rerun side-effect cancellation (A)

- `unit-test-shard` の aggregate 判定で、`run_attempt > 1` かつ
  - 失敗はなし
  - `success`/`cancelled` のみ
  - `cancelled` に、当該再試行対象外 shard が混在
- `TypeCheck & Test` が canceled を失敗に扱っていた状態を回避する対象

### 4) direct workflow cancellation

- `deep-tests` / `quality` / `quality_extended` の主要テストステップで `cancelled`
- 失敗そのものではなく、直接キャンセルとして分類
- ただし、対象ステップで `failure` が確認されれば最優先で fix 対象

## CI上の監査フィールド

監査ログには必ず次を残す。

- `run_id`
- `job_id`
- `workflow name`
- `job name`
- `attempt`
- `shard`
- `conclusion`
- `head SHA`
- `merge commit SHA`
- `classification`

### aggregate での記録

- `typecheck-and-test`（`ci.yml`）は `unit-shard-cancel-audit.json` を生成
  - artifact: `unit-shard-cancel-audit-<run_number>-<attempt>`
  - 結果: `unit_shards_pass` / `unit_shards_cancelled_rerun_side_effect` / `unit_shards_cancelled` / `unit_shards_failure` / `unit_shards_skipped` / `unit_shards_missing` / `unit_shards_nonstandard`
- `deep`（`e2e-deep.yml`）は `deep-cancel-audit.json` を生成
  - artifact: `playwright-report-deep-*` / `test-results-deep-*` に同梱
- `quality` は `quality-cancel-audit.json` を生成
- `quality_extended` は `quality-extended-cancel-audit.json` を生成

## 判定手順（最小）

1. 対象 PR の失敗シグネチャを列挙
2. `#2334` 事象と照合し、A/B/C 判定に振り分け
3. PR差分起因なら修正を対象 PR へ反映
4. A/B は aggregate の扱いを変更せず、分類情報を残して再試行・追跡

## ケース分離（今回の対象）

- A: `#2333` / `#2299` の aggregate rerun 側 cancelled
  - `TypeCheck & Test` で `unit-test-shard result: cancelled` が再試行結果に混入
  - `unit-test-shard` 再試行側効果として識別
- B: `#2329` の `Quality Gates` / `Deep Tests` の実行中に直接 cancel
  - `TypeCheck` 成功ではなく、playwright実行・インストール系 step が `cancelled`
- C: 同一 `main` / unit shard での再現比較による非PR起因評価
  - issue 追跡と切り分け結果は `#2334` に追加追記

## 例外

- cancellation を無条件 success 扱いしない
- 実際のテスト failure は必ず fail-closed
- PR 実装との関係が不明な場合は保留して追加観測を行う

