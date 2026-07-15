# Architecture Violation Exception Ledger (2026-07-15)

## 対象基準

- ベースコミット: `05fea33645c2802159d23f62b05aad9327b714b9`
- 計測設定:
  - `.dependency-cruiser.cjs`
  - `.dependency-cruiser-known-violations.json`
- 実行コマンド:
  - `npm run arch:check`
  - `npx depcruise --config .dependency-cruiser.cjs --output-type err-long -- src tests`
- 件数の扱い（固定方針）:
  - **920件**: 現行CI (`npm run arch:check`) が `--ignore-known` 前提で管理している既知違反数
  - **921件**: `--ignore-known` を外した生の再集計件数（`depcruise --no-ignore` 相当）
  - **差分1件**: 集計条件の差分として扱い、原因不明の段階では「既知違反が921件」と断定しない
- 結果:
  - `npm run arch:check`: **no new violations**, 920 known ignored（管理上の既知違反ベース）
  - `depcruise --no-ignore`: **921 violations**（生の依存違反数）

## 現在の既知違反分布（再集計）

`*.json` の既知違反エントリ (`.dependency-cruiser-known-violations.json`) から集計。

| ルール | 件数 |
| --- | ---: |
| no-external-feature-internals | 462 |
| no-cross-feature-internals | 414 |
| module-domain-is-pure | 38 |
| no-runtime-circular-dependencies | 3 |
| legacy-domain-no-external-platform | 3 |
| module-application-does-not-use-ui-or-adapters | 1 |

## 3レーン分類と境界

### 1) 維持レーン（意図的例外の継続管理）

- 対象: `src/app`, `src/pages`, composition root, routeからfeatureを組み立てる依存, adapter登録やruntime wiring
- 方針: 構造上意図的に許容している例外を維持し、例外ごとに理由と削除条件を明記する。
- 追加条件:
  - 理由のない恒久ignoreは作成しない
  - 代替パスが確認できる場合は、別PRでまず経路を公開API/インターフェース経由へ移す

- `no-external-feature-internals` の大半が `src/app` / `src/pages` → `src/features/...` の依存で、UI層を介した既存呼び出しとして現存している。
- 本分類で次リリースの「触らない対象」を明確化し、CI安定化とレビュー時のノイズを下げる。

上位起点ファイル（件数順、抜粋）:

1. `src/pages/SupportPlanGuidePage.tsx` (28)
2. `src/pages/today-isolated/TodayOpsPage_v3.tsx` (27)
3. `src/pages/TimeBasedSupportRecordPage.tsx` (17)
4. `src/pages/support-planning-sheet/hooks/useSupportPlanningSheetOrchestrator.ts` (15)
5. `src/pages/transport-assignment/hooks/useTransportAssignmentPage.ts` (15)

### 2) 移行中レーン（段階的に境界内へ戻す）

- 目的: 1PRで today/daily/kiosk を同時に触らず、機能群ごとの移行を分割する。

機能境界整理PR分割:
- today境界整理
- daily境界整理
- kiosk境界整理


- `no-cross-feature-internals` が主で、主に機能横断の相互参照として出現。
- 多くは業務上の束ね処理（`today`、`daily`、`kiosk` など）と密に連携しているため、1機能ずつではなく「束ね機能の分離計画」として扱うのが妥当。

起点モジュール上位（抜粋）:

1. `today`: 62
2. `daily`: 59
3. `kiosk`: 31
4. `exceptions`: 25
5. `dashboard`: 21

目的モジュール上位（抜粋）:

1. `users`: 71
2. `daily`: 66
3. `today`: 30
4. `ibd`: 25
5. `planning-sheet`: 25

### 3) 境界再設計レーン（設計変更が前提）

- `module-domain-is-pure`（38）: ドメイン内部に `utils`/他モジュール参照が混在。
- `no-runtime-circular-dependencies`（3）: 実行時循環依存。解消は影響範囲が大きいため別PR。
- `module-application-does-not-use-ui-or-adapters`（1）: `transportAssignmentApplication` の層配置見直し対象。

境界再設計方針:
- いずれも個別importの機械的置換ではなく、先に設計確認PRを作る
- その後、実装を小さく分割してPR化する

## 今後の分類帳（次PR境界）

### 現在例外として維持（そのまま回避）
- 大半の `src/app`/`src/pages` 由来 `no-external-feature-internals`。

### 移行中例外
- `today`/`daily`/`kiosk` を含む `no-cross-feature-internals` は、束ね機能の公開API整備を伴う後続PRで順次縮小。

### 既に解消見込みがある旧ignore（再点検対象）
- `npm run arch:check` の既知件数が `921` へ変動しているため、過去PRとの比較をし、再発生なしなら除外再評価を追加。

### 境界設計そのものを見直す候補
- `module-domain-is-pure` と `legacy-domain-no-external-platform`（計41）
- `no-runtime-circular-dependencies`（3）

### PR化前の固定チェック
- `git status --short`
- `git diff --name-only`
- `git diff -- tests/e2e/daily-pdca.integration.spec.ts`
- 非Markdown差分を検出した場合は、対象ファイルだけ復元してMarkdownのみのPRにする

## 受入条件（この台帳の更新）

1. 上位5件ずつを次PRで分離し、`known violations` の件数増加を 0 に保つ。
2. `arch:check` 新規違反 0 を維持。
3. 解消済みと判定した場合、`.dependency-cruiser-known-violations.json` の該当除外を1PRあたり1〜2件単位で縮小。
