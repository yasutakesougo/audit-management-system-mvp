# 🛡️ Branch Protection Setup Guide

## Current CI Status Analysis

このプロジェクトは以下の包括的CI体制が整っています：

### ✅ 主要ワークフロー

- `fast-lane.yml`: 高速統合テスト (typecheck, lint, unit, E2E smoke)
- `ci-preflight.yml`: 完全品質検証 (TZマトリックス, schedule unit, opt-in E2E)

### ✅ 品質ガード

- TESTIDS guard
- TypeScript compilation
- ESLint
- Unit tests (store, telemetry, hydration)
- E2E tests (prefetch, users, nurse BP sync)
- Build + bundle guards

## 🎯 Branch Protection Rules Setup

GitHubでの設定手順：

### 1. アクセス

```text
Repository → Settings → Branches → "Add rule"
```

### 2. Basic Settings

```yaml
Branch name pattern: main
```

### 3. Protection Rules (推奨設定)

#### ✅ Pull Request Requirements

```yaml
☑ Require a pull request before merging
  └─ Required number of approvals: 1
  └─ ☑ Dismiss stale pull request approvals when new commits are pushed
  └─ ☑ Require review from code owners (if CODEOWNERS exists)
```

#### ✅ Status Checks

```yaml
☑ Require status checks to pass before merging
☑ Require branches to be up to date before merging

Required status checks:
  ☑ fast-lane / fast
  ☑ CI Preflight / preflight (0)
  ☑ CI Preflight / preflight (1)
  ☑ CI Preflight / schedule-unit (Asia/Tokyo)
  ☑ CI Preflight / schedule-unit (America/Los_Angeles)
```

#### ✅ Additional Restrictions

```yaml
☑ Restrict pushes that create files larger than 100MB
☑ Include administrators (推奨: 管理者も同じルールに従う)
```

#### 🔧 Optional (Team Policy次第)

```yaml
□ Require linear history (squash merge preferred)
□ Allow force pushes (normally disabled)
□ Allow deletions (normally disabled)
```

## 🚀 効果

設定後、以下が自動化されます：

### ✅ 品質保証

- TypeScript compilation必須
- Lint必須
- Unit tests必須
- 主要E2E smoke tests必須

### ✅ レビュー体制

- 1名以上の承認必須
- CI通過後のみマージ可能
- ブランチ最新状態必須

### ✅ 事故防止

- 直接pushの物理的阻止
- 大容量ファイルの自動拒否
- 管理者も同じルールに従う

## 📋 設定後の運用

### 通常のPR作成フロー

```bash
# 1. 機能ブランチ作成
git checkout -b feature/new-feature

# 2. 開発・コミット
git add .
git commit -m "feat: implement new feature"

# 3. Push & PR作成
git push origin feature/new-feature
# GitHub UIでPR作成

# 4. CI完了 + レビュー承認を待つ
# 5. merge (GitHub UI or CLI)
```

### 緊急時の例外処理

管理者権限で一時的にルール無効化が可能ですが、
基本的にはCI修正 → 再実行で対応することを推奨。

## ✅ 設定完了チェック

- [ ] Branch protection rules設定完了
- [ ] Status checksに `fast-lane / fast` 追加
- [ ] Status checksに `CI Preflight / preflight` 追加
- [ ] 1つ以上のPR approval必須
- [ ] Include administrators有効
- [ ] テストPRで動作確認

この設定により、**高品質なコードのみがmainブランチに入る**体制が完成します。
