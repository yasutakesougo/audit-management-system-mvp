# スプリント計画 - クイックスタートガイド

このガイドは [SPRINT_PLAN.md](./SPRINT_PLAN.md) の実装を開始するための手順書です。

## 📋 概要

- **Sprint 1** (Week 1-2): 認証E2Eテストと安定性改善
- **Sprint 2** (Week 3-4): 品質CI統合
- **工数**: 各タスク S（1-2日）× 4タスク

## 🚀 Sprint 1: 認証E2Eテストと安定性改善

### Week 1: PR#1 - MSAL認証 E2E スモークテスト

**目的**: 認証の致命的バグを自動検知、CI/CDで安定稼働

**実装手順**:

1. **Issue Draft を確認**
   ```bash
   cat issues/001-msal-login-e2e-smoke.md
   ```

2. **GitHub Issue を作成**
   - テンプレート「📌 Backlog Task」を使用
   - Issue Draft の内容をコピー

3. **実装開始**
   ```bash
   # Feature branch を作成
   git checkout -b feature/msal-login-e2e-smoke
   
   # テストファイルを作成
   touch tests/e2e/msal-login.smoke.spec.ts
   ```

4. **テスト実装**
   - `tests/e2e/msal-login.smoke.spec.ts` を実装
   - signIn / signOut ヘルパー関数を実装または既存を活用

5. **ローカルで実行**
   ```bash
   # E2E テストを実行
   npm run test:e2e:smoke
   ```

6. **CI設定の調整**
   - `playwright.config.ts` でリトライ・タイムアウト設定を確認
   - `.github/workflows/e2e-smoke.yml` を追加/更新

7. **ドキュメント更新**
   - `docs/E2E_BEST_PRACTICES.md` に認証テストパターンを追記

8. **PR作成**
   - 受け入れ基準がすべて満たされていることを確認
   - CI が緑になることを確認

**受け入れ基準チェックリスト**:
- [ ] `tests/e2e/msal-login.smoke.spec.ts` を作成
- [ ] Playwright で signIn() → /me → signOut() を検証
- [ ] CI（GitHub Actions）で緑になる
- [ ] リトライ設定を追加（最大2回）
- [ ] ドキュメント更新

---

### Week 1-2: PR#2 - Users CRUD 基本回帰テスト

**目的**: ユーザー追加→削除の主要フローを保護

**実装手順**:

1. **Issue Draft を確認**
   ```bash
   cat issues/002-users-crud-smoke.md
   ```

2. **GitHub Issue を作成**

3. **実装開始**
   ```bash
   git checkout -b feature/users-crud-add-delete
   touch tests/e2e/users-crud-add-delete.smoke.spec.ts
   ```

4. **テスト実装**
   - ユーザー追加フロー
   - 一覧確認フロー
   - 削除フロー
   - `beforeEach` でクリーンアップ

5. **ローカルで実行**
   ```bash
   npm run test:e2e -- tests/e2e/users-crud-add-delete.smoke.spec.ts
   ```

6. **PR作成**

**受け入れ基準チェックリスト**:
- [ ] `tests/e2e/users-crud-add-delete.smoke.spec.ts` を作成
- [ ] ユーザー追加 → 一覧確認 → 削除 のフローをテスト
- [ ] モックAPI で安定してパス
- [ ] CI で緑になる

---

## 🎯 Sprint 2: 品質CI統合

### Week 3: PR#3 - a11y 自動チェック

**目的**: アクセシビリティ違反を自動検知

**実装手順**:

1. **Issue Draft を確認**
   ```bash
   cat issues/003-a11y-unit-checks.md
   ```

2. **jest-axe をインストール**
   ```bash
   npm install --save-dev jest-axe
   ```

3. **テスト実装**
   ```bash
   touch tests/unit/a11y.RecordList.spec.ts
   touch tests/unit/a11y.UsersPanel.spec.ts
   ```

4. **vitest.setup.ts を更新**
   ```typescript
   import { expect } from 'vitest';
   import { toHaveNoViolations } from 'jest-axe';
   
   expect.extend(toHaveNoViolations);
   ```

5. **ローカルで実行**
   ```bash
   npm test -- tests/unit/a11y.*
   ```

6. **既存の違反を修正**（別PR化も可）

7. **ドキュメント更新**
   - `docs/ACCESSIBILITY_GUIDE.md` を更新

**受け入れ基準チェックリスト**:
- [ ] jest-axe インストール
- [ ] RecordList・UsersPanel のテスト作成
- [ ] axe 違反がゼロ
- [ ] CI で自動実行

---

### Week 3-4: PR#4 - MSAL 設定健全性ガード

**目的**: 設定ミスを起動時に検知

**実装手順**:

1. **Issue Draft を確認**
   ```bash
   cat issues/004-msal-env-guard.md
   ```

2. **env スキーマを作成**
   ```bash
   touch src/config/envSchema.ts
   ```

3. **バリデーションを実装**
   - zod スキーマを定義
   - エラーメッセージを整形

4. **main.tsx に組み込み**
   ```typescript
   import { validateEnv } from './config/envSchema';
   validateEnv();
   ```

5. **ローカルで動作確認**
   ```bash
   # 不正な値でテスト
   VITE_MSAL_CLIENT_ID= npm run dev
   # → エラーメッセージが表示されることを確認
   ```

6. **.env.example を更新**

7. **ドキュメント作成**
   ```bash
   touch docs/ENV_SETUP_GUIDE.md
   ```

**受け入れ基準チェックリスト**:
- [ ] `src/config/envSchema.ts` を作成
- [ ] 不正値で起動時エラー
- [ ] エラーメッセージに修正方法を含める
- [ ] .env.example 更新
- [ ] ドキュメント作成

---

## 📊 進捗管理

### Sprint 1 進捗

```
[ ] PR#1: MSAL認証 E2E スモークテスト
  [ ] Issue 作成
  [ ] テスト実装
  [ ] CI 設定
  [ ] ドキュメント更新
  [ ] PR マージ

[ ] PR#2: Users CRUD 基本回帰テスト
  [ ] Issue 作成
  [ ] テスト実装
  [ ] CI 設定
  [ ] ドキュメント更新
  [ ] PR マージ
```

### Sprint 2 進捗

```
[ ] PR#3: a11y 自動チェック
  [ ] Issue 作成
  [ ] jest-axe インストール
  [ ] テスト実装
  [ ] CI 設定
  [ ] ドキュメント更新
  [ ] PR マージ

[ ] PR#4: MSAL 設定健全性ガード
  [ ] Issue 作成
  [ ] env スキーマ実装
  [ ] バリデーション組み込み
  [ ] .env.example 更新
  [ ] ドキュメント更新
  [ ] PR マージ
```

---

## 🔧 開発環境セットアップ

### 必要なツール

```bash
# Node.js 20+
node --version

# npm 10+
npm --version

# Playwright (E2E tests)
npx playwright --version
```

### ローカル環境構築

```bash
# 依存関係インストール
npm install

# E2E ブラウザインストール
npm run e2e:install

# 環境変数設定
cp .env.example .env.local
# .env.local を編集して必要な値を設定

# 開発サーバー起動
npm run dev

# テスト実行
npm test                    # Unit tests
npm run test:e2e:smoke      # E2E smoke tests
```

---

## 📚 関連ドキュメント

- [SPRINT_PLAN.md](./SPRINT_PLAN.md) - 詳細なスプリント計画
- [Backlog.md](./Backlog.md) - バックログ候補
- [issues/README.md](./issues/README.md) - Issue Draft 一覧
- [E2E_BEST_PRACTICES.md](./docs/E2E_BEST_PRACTICES.md) - E2Eテストのベストプラクティス
- [E2E_TEST_STRATEGY.md](./docs/E2E_TEST_STRATEGY.md) - E2Eテスト戦略

---

## 🆘 トラブルシューティング

### E2E テストが失敗する

```bash
# Playwright を最新に更新
npm run e2e:install

# キャッシュをクリア
rm -rf node_modules/.vite
npm run dev:e2e
```

### CI が緑にならない

```bash
# ローカルで CI 環境を再現
CI=1 npm run test:e2e:smoke

# リトライ設定を確認
# playwright.config.ts の retries を確認
```

### MSAL 認証エラー

```bash
# 環境変数を確認
cat .env.local

# E2E モードで実行
VITE_E2E=1 VITE_E2E_MSAL_MOCK=true npm run dev
```

---

## 💡 Tips

- **並行作業**: PR#1 と PR#3 は独立しているため、並行して実装可能
- **早期フィードバック**: PR#1 を最優先で完了させ、CI環境を整備
- **段階的修正**: a11y 違反が多数発見された場合は、優先度を付けて別PRで修正
- **ドキュメント先行**: 実装前に Issue Draft を確認し、不明点を解消

---

## 📞 サポート

質問や不明点がある場合は、以下を参照してください:

1. Issue Draft の「実装ポイント」セクション
2. 既存のテストコード（`tests/e2e/`, `tests/unit/`）
3. GitHub Issue のコメント欄で質問

---

**最終更新**: 2026-02-03
