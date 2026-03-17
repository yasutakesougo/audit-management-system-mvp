---
description: Harden AI — モジュール硬化テンプレートに基づく全モジュール自動監査と修正提案
---

# Harden AI ワークフロー

あなたはモジュール設計硬化の専門家です。
`docs/guides/module-hardening-template.md` に基づいて全モジュールを監査し、
硬化候補を特定し、修正計画を出力します。

## コンテキスト

このプロジェクトの設計硬化は4モジュール（Users / Schedules / Assessment / DailyOps）で
実証済みの方法論に基づきます。詳細は `docs/guides/module-hardening-template.md` を参照。

**設計硬化の本質**:
環境差分・デモ責務・旧経路を UI/Store/Hook から追い出し、境界を明確化し、lint で固定する。

## 手順

### Phase 1: 全モジュール自動スキャン

// turbo
1. 以下の4パターンで `src/features/` 配下を全スキャンする

```bash
# ① store内のdemo seed混在
rg 'seedDemo|demoData|demo.*seed' src/features/*/stores/ \
  --glob '!**/seedDemo*' --glob '!**/useAssessmentDemoSeed*' -l

# ② UI/Hook層のenv直参照（factory層は除外）
rg 'isDemoModeEnabled|shouldSkipSharePoint' src/features/ \
  --glob '!**/repositoryFactory*' \
  --glob '!**/infra/*' \
  --glob '!**/*Factory*' \
  --glob '!**/seedDemo*' \
  --glob '!**/useAssessmentDemoSeed*' \
  --glob '!**/*.test.*' \
  --glob '!**/*.spec.*' -l

# ③ dead code候補（importゼロの旧adapter/demo層）
rg 'demoAdapter|demoStore|usersStoreDemo|demoSchedulesPort' src/ \
  --glob '!**/index.ts' \
  --glob '!**/*.test.*' \
  --glob '!**/module-hardening*' -l

# ④ barrel露出（index.tsからのdemo re-export）
rg 'export.*demo|export.*Demo' src/features/**/index.ts -l
```

### Phase 2: 検出結果の分類

2. スキャン結果を以下のフォーマットで分類する（まだ修正はしない）

```markdown
## 硬化監査レポート

### 🔴 要対応（硬化対象）

| モジュール | 症状 | 該当ファイル | 推奨Step |
|-----------|------|-------------|----------|

### 🟡 要確認（判断が必要）

| モジュール | 症状 | 該当ファイル | 備考 |
|-----------|------|-------------|------|

### 🟢 正常（対応不要）

| モジュール | 理由 |
|-----------|------|

### ⚪ 対象外（hardening前段階 or 未接続）

| モジュール | 理由 |
|-----------|------|
```

### Phase 3: 分類基準

3. 各検出結果を以下のルールで振り分ける

**🔴 要対応** の条件:
- store 内に `seedDemoData()` 等が残っている
- UI/Hook 層で `isDemoModeEnabled()` / `shouldSkipSharePoint()` を直接呼んでいる
- barrel から旧 demo adapter が re-export されている
- dead code が残存している

**🟡 要確認** の条件:
- `create*Repository` 等の factory 関数内での `shouldSkipSharePoint()` 呼出
  → **正当な責務** の可能性あり。呼出元がデータ層なら対応不要
- routes.tsx 内での環境判定
  → ルーティング層での分岐は設計判断が必要
- demo 関連だがテストファイル内のみの参照

**🟢 正常** の条件:
- 硬化済み（Users / Schedules / Assessment / DailyOps パターン成立）
- env 参照が factory / infra 層のみ

**⚪ 対象外** の条件:
- 本番データソース未接続（Nurse 等）
- demo モジュール自体（`src/features/demo/`）

### Phase 4: 修正計画の出力

4. 🔴 に分類されたモジュールについて、以下のフォーマットで修正計画を出力する

```markdown
## 修正計画: [モジュール名]

### 症状
- [検出された問題]

### 推奨手順

| Step | 内容 | コミットメッセージ |
|------|------|--------------------|
| 1    | ...  | `refactor(module): ...` |
| 2    | ...  | `refactor(module): ...` |
| 4    | ...  | `chore(eslint): ...` |

### 影響範囲
- 変更ファイル: X件
- 推定削除行数: ~Y行
- 既存テストへの影響: なし / 軽微

### 前提条件
- [ ] factory パターンが正しく稼働している
- [ ] 消費者が単一入口に集約済み
```

### Phase 5: ユーザー承認後の実行

5. ユーザーが修正計画を承認したら、模ジュールごとに硬化を実行する
   - 1 Step = 1 コミット
   - 各 Step 後に `tsc --noEmit` と `npx eslint . --max-warnings=0` で確認
   // turbo

6. 全 Step 完了後に最終確認
   ```bash
   npx tsc --noEmit
   npx eslint . --max-warnings=0 2>&1 | tail -5
   npx vitest run --reporter=verbose 2>&1 | tail -20
   ```
   // turbo

7. `module-hardening-template.md` の「実績」セクションに結果を追記

## 判断ルール

### factory 層の `shouldSkipSharePoint()` は触らない

以下のパターンは **正当な環境判定** であり、hardening の対象外:

```typescript
// ✅ OK: factory / infra 層での環境判定
export function createXxxRepository() {
  if (shouldSkipSharePoint()) {
    return new InMemoryXxxRepository();
  }
  return new SharePointXxxRepository(spFetch);
}
```

### 禁止対象は UI / Hook / Store 層での直接呼び出し

```typescript
// ❌ NG: UI / Hook 層での直接呼び出し
function useXxx() {
  if (isDemoModeEnabled()) { ... }  // → factory or options 注入へ
}
```

## 重要度判定

| 症状 | 重要度 | 理由 |
|------|:------:|------|
| store内seed混在 | 🔴 高 | 本番でseedが走る可能性 |
| UI層env直参照 | 🔴 高 | 環境判定の責務漏れ |
| barrel露出 | 🟠 中 | 誤import経路が残る |
| dead code残存 | 🟠 中 | 読みやすさ低下 |
| test内のみの参照 | 🟢 低 | 実害なし（後回し可） |

---

## Next: CI 化（Level 4 への移行）

> **現在のステータス**: 手動運用（Level 3）
> **目標**: PR ごとに自動検出（Level 4）

### 着手トリガー（以下のどれかが発生したら）

- [ ] 新しい feature モジュールを追加する
- [ ] demo/prod 切替を持つ新規実装が入る
- [ ] 複数人レビューの頻度が増える
- [ ] `/harden` の手動実行を1回でも忘れる
- [ ] hardening 対象がまた2件以上見つかる

### 最小実装イメージ

```yaml
# .github/workflows/architecture-lint.yml
name: Architecture Lint
on: [pull_request]
jobs:
  harden-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check env direct references in UI/Hook/Store
        run: |
          HITS=$(rg 'isDemoModeEnabled|shouldSkipSharePoint' src/features/ \
            --glob '!**/*Factory*' \
            --glob '!**/*factory*' \
            --glob '!**/repositoryFactory*' \
            --glob '!**/infra/*' \
            --glob '!**/*.spec.*' \
            --glob '!**/*.test.*' \
            --glob '!**/demo/**' \
            -l || true)
          if [ -n "$HITS" ]; then
            echo "::warning::Potential hardening violations found:"
            echo "$HITS"
            exit 1
          fi
```

> このチェックリストと実装スケッチは、着手判断時にそのまま使える。

