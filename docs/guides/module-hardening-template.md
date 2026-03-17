# Module Hardening Template

> モジュールの設計硬化を再現可能な4ステップで実行するためのガイド。
> 4モジュール（Users / Schedules / Assessment / DailyOps）で実証済み。

---

## 目的

UI / Store / Hook 層に混在する **環境差分・デモ責務・旧経路** を正しい層へ戻し、
lint で固定することで **設計が戻らない状態** を作る。

---

## 対象判定チェックリスト

以下のいずれかに該当するモジュールが hardening 対象。

| 症状 | 典型例 |
|------|--------|
| **二重経路** | `useUsersDemo` と `useUsers` が並存し、消費者が混在 |
| **Dead code** | Port/Adapter 層が残っているが `App.tsx` から外れている |
| **Seed 混在** | `seedDemoData()` が store 内に定義されている |
| **Env 直参照** | UI/Hook 内で `isDemoModeEnabled()` や `shouldSkipSharePoint()` を直接呼んでいる |
| **Barrel 露出** | `index.ts` から旧 demo adapter が re-export されている |

### 発見方法

```bash
# 1. store 内の demo seed を探す
rg 'seedDemo|demoData|demo.*seed' src/features/<module>/stores/

# 2. UI/Hook 層の env 直参照を探す
rg 'isDemoModeEnabled|shouldSkipSharePoint|IS_DEMO' src/features/<module>/ \
  --glob '!**/repositoryFactory*' --glob '!**/infra/*'

# 3. dead code (import ゼロ) を探す
rg 'demoAdapter|demoStore|usersStoreDemo' src/ --glob '!**/index.ts'

# 4. barrel 露出を探す
rg 'demoAdapter|demoSchedulesPort|SchedulesProvider' src/features/<module>/**/index.ts
```

---

## 4ステップ

### Step 1: 責務を正しい層へ戻す

**目的**: 混在している責務を分離する。

| パターン | Before | After |
|----------|--------|-------|
| Seed 混在 | `store.ts` 内に `seedDemoData()` | 専用モジュール `seedDemo*.ts` へ抽出 |
| Env 直参照 | Hook 内で `isDemoModeEnabled()` 呼出 | `options.demoMode` で外部注入 or factory 層で判定 |
| 二重経路 | `useUsersDemo` + `useUsers` 並存 | `useUsers()` に一本化、factory で環境切替 |
| Inline fixture | Page 内に demo データ定義 | `*DemoFixtures.ts` へ抽出 |

**原則**:
- **Store** は状態管理のみ
- **Factory** が環境判定を担う
- **Seed / Fixture** は専用モジュール
- **Hook** は外部注入で環境を受け取る

**コミット粒度**: 1ステップ = 1コミット。振る舞いは変えない。

```
refactor(<module>): extract demo seeding from <store> to dedicated module
```

### Step 2: 不要物を削る

**目的**: Step 1 で参照がゼロになった旧コードを削除する。

- 旧 store / adapter / context の削除
- barrel (`index.ts`) からの re-export 除去
- 未使用 import のクリーンアップ

**判定基準**: `rg` で import が 0 件なら削除可能。

```
refactor(<module>): delete dead <layer> demo layer
```

### Step 3: 境界を整理する

**目的**: 将来の factory 化・外部注入に備えて境界を明確にする。

- Hook に `options` パラメータを追加（後方互換維持）
- UI 側に残った `isDemoModeEnabled()` 直呼びを除去
- factory 層の環境判定はそのまま維持（正当な責務）

```
refactor(<module>): lift isDemoModeEnabled out of <hook>
```

### Step 4: Lint で固定する

**目的**: 再発を機械的に防止する。

`.eslintrc.cjs` の `no-restricted-imports` に追加:

```javascript
// パターン: 旧モジュールからの import を禁止
{
  group: ['**/<module>/stores/<oldStore>', '**/<module>/stores/<oldStore>.*'],
  importNames: ['seedDemoData'],
  message: 'seedDemoData は <newModule> へ移動済みです。'
}
```

**コミット**:
```
chore(eslint): guard against <module> demo regression
```

---

## 実績

### Users（PR #1017）

| Step | 内容 | 削除行数 |
|------|------|---------|
| 1 | `useUsersDemo` → `useUsers()` へ消費者を移行 | — |
| 2 | barrel から旧 re-export を遮断 | — |
| 3 | `usersStoreDemo.ts` を削除 | ~120 |
| 4 | ESLint で `usersStoreDemo` import を禁止 | — |

**結果**: 単一入口 `useUsers()` + `repositoryFactory` + lint ガード

### Schedules

| Step | 内容 | 削除行数 |
|------|------|---------|
| 1 | `useSchedulesToday` から `shouldSkipSharePoint()` 直参照を除去 | — |
| 2 | barrel から `demoSchedulesPort` / `SchedulesProvider` / `useSchedulesPort` を除去 | — |
| 3 | `context.ts` / `demoAdapter.ts` を削除 | ~405 |
| 4 | ESLint で旧 adapter / context import を禁止 | — |

**結果**: 単一入口 `useScheduleRepository()` + `repositoryFactory` + lint ガード

### Assessment

| Step | 内容 | 削除行数 |
|------|------|---------|
| 1 | `assessmentStore` から `seedDemoData` を `useAssessmentDemoSeed` へ抽出 | — |
| 2 | `IcebergAnalysisPage` の inline fixture を `icebergDemoFixtures.ts` へ抽出 | ~50 |
| 3 | `useTokuseiSurveyResponses` で `isDemoModeEnabled()` を `options.demoMode` 注入に変更 | — |
| 4 | ESLint で旧 seed import を禁止 | — |

**結果**: 純粋 store + 外部注入 + lint ガード

### DailyOps

| Step | 内容 | 削除行数 |
|------|------|---------|
| 1 | `behaviorStore` から `seedDemoBehaviors` を `seedDemoBehaviors.ts` へ抽出 | ~40 |
| 4 | ESLint で旧 seed import を禁止 | — |

**結果**: 純粋 store + seed 隔離 + lint ガード

> DailyOps は factory 層が正しく稼働済みだったため、Step 2/3 は不要。
> テンプレートは **問題の大きさに応じてスケール** する。

### DailyOps / useDailyOpsSignals

| Step | 内容 | 削除行数 |
|------|------|---------|
| 1 | hook 内の `makeDemoPort()` + `shouldSkipSharePoint()` を `createDailyOpsSignalsPort` factory へ抽出 | ~9 |
| 3 | hook が factory 利用に純化、`shouldSkipSharePoint` import 除去 | — |
| 4 | file-scoped ESLint override で hook への `shouldSkipSharePoint` 再流入を防止 | — |

**結果**: hook 純化 + factory 切替 + lint ガード
**パターン**: factory パターン（Users / Schedules と同型）

### Org / store

| Step | 内容 | 削除行数 |
|------|------|---------|
| 3 | `shouldSkipSharePoint()` 直参照を `options?.skipSharePoint ?? shouldSkipSharePoint()` へ変更 | — |
| 3 | `logSkipSharePointGuard` import 除去 | — |

**結果**: options 注入 + 後方互換維持
**パターン**: options 注入パターン（Assessment と同型）

> この2件で、テンプレートが **問題の性質に応じて factory / options 注入を使い分けられる** ことが実証された。

---

## 判断基準: どの Step が必要か

```
混在責務あり？ → Step 1 (分離)
Dead code あり？ → Step 2 (削除)
UI に env 直参照あり？ → Step 3 (境界整理)
常に必要 → Step 4 (lint 固定)
```

Step 4 は **必ず実行**。Step 1-3 は問題の性質に応じて取捨選択する。

---

## コミット規約

```
# Step 1: 分離
refactor(<module>): extract <demo function> from <store> to dedicated module

# Step 2: 削除
refactor(<module>): delete dead <layer> demo layer

# Step 3: 境界整理
refactor(<module>): lift isDemoModeEnabled out of <hook>

# Step 4: lint 固定
chore(eslint): guard against <module> demo regression
```

---

## factory 層の `isDemoModeEnabled` は触らない

`repositoryFactory` 内での `isDemoModeEnabled()` / `shouldSkipLogin()` 呼び出しは
**環境判定の正当な責務**であり、hardening の対象外。

禁止すべきは **UI / Hook / Store 層** での直接呼び出しのみ。

---

## 横展開候補の見つけ方

```bash
# store 内に残っている demo seed を全モジュールで検索
rg 'seedDemo|demoData' src/features/*/stores/ --glob '!**/seedDemo*'

# UI/Hook 層の env 直参照（factory 除外）
rg 'isDemoModeEnabled|shouldSkipSharePoint' src/features/ \
  --glob '!**/repositoryFactory*' \
  --glob '!**/infra/*' \
  --glob '!**/*Factory*'
```

該当があれば、このテンプレートの Step 1 から適用する。
