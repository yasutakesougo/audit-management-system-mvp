# Sprint Implementation Checklist

このチェックリストは [SPRINT_PLAN.md](./SPRINT_PLAN.md) の実装進捗を管理するための中央管理シートです。

## 🎯 Sprint 1: 認証E2Eテストと安定性改善 (Week 1-2)

### PR#1: MSAL認証 E2E スモークテスト (Week 1)
**担当者**: _未定_  
**期限**: Week 1  
**Issue**: [issues/001-msal-login-e2e-smoke.md](./../issues/001-msal-login-e2e-smoke.md)

- [ ] **準備**
  - [ ] Issue Draft を確認
  - [ ] GitHub Issue を作成（テンプレート: 📌 Backlog Task）
  - [ ] Feature branch を作成 (`feature/msal-login-e2e-smoke`)

- [ ] **実装**
  - [ ] `tests/e2e/msal-login.smoke.spec.ts` を作成
  - [ ] signIn / signOut ヘルパー関数を実装（または既存活用）
  - [ ] ログイン → /me → ログアウト フローを実装
  - [ ] ログアウト後のリダイレクト確認を実装

- [ ] **CI設定**
  - [ ] `playwright.config.ts` でリトライ設定を確認（最大2回）
  - [ ] `.github/workflows/e2e-smoke.yml` を追加/更新
  - [ ] ローカルで `npm run test:e2e:smoke` が成功することを確認

- [ ] **ドキュメント**
  - [ ] `docs/E2E_BEST_PRACTICES.md` に認証テストパターンを追記
  - [ ] PR description に受け入れ基準をチェックリスト形式で記載

- [ ] **レビュー・マージ**
  - [ ] PR作成
  - [ ] CI が緑になることを確認
  - [ ] コードレビュー依頼
  - [ ] レビュー指摘対応
  - [ ] PR マージ

**完了日**: _____  
**メモ**: ________________________________________________

---

### PR#2: Users CRUD 基本回帰テスト（追加/削除）(Week 1-2)
**担当者**: _未定_  
**期限**: Week 2  
**Issue**: [issues/002-users-crud-smoke.md](./../issues/002-users-crud-smoke.md)  
**依存**: PR#1 完了後

- [ ] **準備**
  - [ ] PR#1 が完了していることを確認
  - [ ] Issue Draft を確認
  - [ ] GitHub Issue を作成
  - [ ] Feature branch を作成 (`feature/users-crud-add-delete`)

- [ ] **実装**
  - [ ] `tests/e2e/users-crud-add-delete.smoke.spec.ts` を作成
  - [ ] `beforeEach` でテストデータクリーンアップを実装
  - [ ] ユーザー追加フローを実装
  - [ ] 一覧確認フローを実装
  - [ ] 削除フローを実装
  - [ ] 削除キャンセルのテストを実装

- [ ] **テスト**
  - [ ] モックAPI（`VITE_DEMO_MODE=1`）で動作確認
  - [ ] ローカルで `npm run test:e2e` が成功することを確認
  - [ ] タイムスタンプ付きユーザー名でユニーク性を確保

- [ ] **CI設定**
  - [ ] `.github/workflows/e2e-smoke.yml` にテストを追加
  - [ ] CI が緑になることを確認

- [ ] **ドキュメント**
  - [ ] PR description に実装内容を記載
  - [ ] 既存のUsersテストとの差分を明記

- [ ] **レビュー・マージ**
  - [ ] PR作成
  - [ ] CI が緑になることを確認
  - [ ] コードレビュー依頼
  - [ ] レビュー指摘対応
  - [ ] PR マージ

**完了日**: _____  
**メモ**: ________________________________________________

---

## 🎯 Sprint 2: 品質CI統合 (Week 3-4)

### PR#3: a11y 自動チェック（jest-axe 単体導入）(Week 3)
**担当者**: _未定_  
**期限**: Week 3  
**Issue**: [issues/003-a11y-unit-checks.md](./../issues/003-a11y-unit-checks.md)  
**依存**: なし（並行実施可能）

- [ ] **準備**
  - [ ] Issue Draft を確認
  - [ ] GitHub Issue を作成
  - [ ] Feature branch を作成 (`feature/a11y-unit-checks`)

- [ ] **セットアップ**
  - [ ] `npm install --save-dev jest-axe` を実行
  - [ ] `vitest.setup.ts` に `toHaveNoViolations` を追加
  - [ ] パッケージロックファイルをコミット

- [ ] **実装**
  - [ ] `tests/unit/a11y.RecordList.spec.ts` を作成
  - [ ] `tests/unit/a11y.UsersPanel.spec.ts` を作成
  - [ ] データあり・なしの両方でテスト

- [ ] **違反修正**
  - [ ] ローカルで `npm test -- tests/unit/a11y.*` を実行
  - [ ] 既存の axe 違反を確認
  - [ ] 修正可能な違反を修正（別PR化も可）
  - [ ] 修正できない違反は Issue 化

- [ ] **CI設定**
  - [ ] CI で自動実行されることを確認（`npm test` に含まれる）
  - [ ] CI が緑になることを確認

- [ ] **ドキュメント**
  - [ ] `docs/ACCESSIBILITY_GUIDE.md` を更新
  - [ ] テスト追加方法を記載

- [ ] **レビュー・マージ**
  - [ ] PR作成
  - [ ] CI が緑になることを確認
  - [ ] コードレビュー依頼
  - [ ] レビュー指摘対応
  - [ ] PR マージ

**完了日**: _____  
**メモ**: ________________________________________________

---

### PR#4: MSAL 設定健全性ガード（env schema）(Week 3-4)
**担当者**: _未定_  
**期限**: Week 4  
**Issue**: [issues/004-msal-env-guard.md](./../issues/004-msal-env-guard.md)  
**依存**: なし（並行実施可能）

- [ ] **準備**
  - [ ] Issue Draft を確認
  - [ ] GitHub Issue を作成
  - [ ] Feature branch を作成 (`feature/msal-env-guard`)

- [ ] **実装**
  - [ ] `src/config/envSchema.ts` を作成
  - [ ] zod スキーマを定義（MSAL関連変数）
  - [ ] `validateEnv()` 関数を実装
  - [ ] エラーメッセージを分かりやすく整形

- [ ] **統合**
  - [ ] `src/main.tsx` に `validateEnv()` を追加
  - [ ] E2Eモード（`VITE_E2E=1`）では検証をスキップ
  - [ ] 不正な値でエラーが表示されることを確認

- [ ] **ドキュメント**
  - [ ] `.env.example` を更新
  - [ ] `docs/ENV_SETUP_GUIDE.md` を作成
  - [ ] 各環境変数の説明を記載

- [ ] **テスト**
  - [ ] ローカルで不正な値をテスト
  - [ ] エラーメッセージが明確であることを確認
  - [ ] E2Eテストが影響を受けないことを確認

- [ ] **レビュー・マージ**
  - [ ] PR作成
  - [ ] CI が緑になることを確認
  - [ ] コードレビュー依頼
  - [ ] レビュー指摘対応
  - [ ] PR マージ

**完了日**: _____  
**メモ**: ________________________________________________

---

## 📊 Sprint メトリクス

### Sprint 1 目標
- [ ] E2E テストカバレッジ: 認証フロー 100%
- [ ] E2E テストカバレッジ: Users CRUD 50%（追加/削除のみ）
- [ ] CI 成功率: 90% 以上
- [ ] CI 実行時間: ベースライン + 3分以内

**実績**:
- E2E カバレッジ: ____%
- CI 成功率: ____%
- CI 実行時間: +___ 分

### Sprint 2 目標
- [ ] a11y カバレッジ: RecordList・UsersPanel 100%
- [ ] env 検証カバレッジ: MSAL関連変数 100%
- [ ] CI 成功率: 95% 以上

**実績**:
- a11y カバレッジ: ____%
- env 検証カバレッジ: ____%
- CI 成功率: ____%

---

## 🔄 Sprint レビュー

### Sprint 1 レトロスペクティブ

**Keep（続けること）**:
- 

**Problem（問題点）**:
- 

**Try（次に試すこと）**:
- 

**日付**: _____  
**参加者**: ________________________________________________

---

### Sprint 2 レトロスペクティブ

**Keep（続けること）**:
- 

**Problem（問題点）**:
- 

**Try（次に試すこと）**:
- 

**日付**: _____  
**参加者**: ________________________________________________

---

## 📅 次のステップ

Sprint 1-2 完了後、以下を検討:

- [ ] Sprint 3 計画の作成
- [ ] M工数タスクの優先順位付け
  - [ ] Users CRUD 統合テスト（4ステップ網羅）
  - [ ] a11y CI 統合（複合ページ）
  - [ ] HTTPS 復帰（RSA + TLS1.2/1.3）
- [ ] チームキャパシティの再評価
- [ ] リスク・ブロッカーの洗い出し

---

## 📚 関連ドキュメント

- [SPRINT_PLAN.md](./SPRINT_PLAN.md) - 詳細なスプリント計画
- [SPRINT_QUICKSTART.md](./SPRINT_QUICKSTART.md) - 実装クイックスタート
- [.github/SPRINT_TIMELINE.md](./.github/SPRINT_TIMELINE.md) - ビジュアルタイムライン
- [Backlog.md](./Backlog.md) - バックログ候補
- [issues/README.md](./../issues/README.md) - Issue Draft 一覧

---

**最終更新**: 2026-02-03  
**次回レビュー**: Sprint 1 完了時
