# Sprint Plan Documentation - README

このディレクトリには、Iceberg-PDCA プロジェクトの2週間スプリント計画に関する全ドキュメントが含まれています。

## 📋 ドキュメント構成

### 🎯 メインドキュメント（必読）

1. **[SPRINT_PLAN.md](./SPRINT_PLAN.md)** - 📘 詳細なスプリント計画
   - Sprint 1-2 の全体像
   - タスク分解（PR#1-4）
   - 受け入れ基準、工数見積もり
   - リスク分析と対策
   - メトリクス目標

2. **[SPRINT_QUICKSTART.md](./SPRINT_QUICKSTART.md)** - 🚀 実装クイックスタート
   - 各PRの実装手順
   - ステップバイステップガイド
   - トラブルシューティング
   - 環境セットアップ

3. **[IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md)** - ✅ 進捗管理チェックリスト
   - 各タスクの詳細チェックリスト
   - 担当者・期限管理
   - メトリクス記録
   - レトロスペクティブ記録

### 📊 補足ドキュメント

4. **[.github/SPRINT_TIMELINE.md](./.github/SPRINT_TIMELINE.md)** - 🗓️ ビジュアルタイムライン
   - 4週間の全体スケジュール
   - 依存関係グラフ
   - リスクヒートマップ
   - 並行作業の機会

5. **[issues/README.md](./../issues/README.md)** - 📝 Issue Draft 一覧
   - 各 Issue Draft の概要
   - GitHub Issue 作成方法
   - テンプレート構造

### 🎫 Issue Drafts（実装詳細）

6. **[issues/001-msal-login-e2e-smoke.md](./../issues/001-msal-login-e2e-smoke.md)**
   - Sprint 1, PR#1
   - MSAL認証 E2E スモークテスト
   - 工数: S（1-2日）

7. **[issues/002-users-crud-smoke.md](./../issues/002-users-crud-smoke.md)**
   - Sprint 1, PR#2
   - Users CRUD 基本回帰テスト
   - 工数: S（1-2日）

8. **[issues/003-a11y-unit-checks.md](./../issues/003-a11y-unit-checks.md)**
   - Sprint 2, PR#3
   - a11y 自動チェック
   - 工数: S（1-2日）

9. **[issues/004-msal-env-guard.md](./../issues/004-msal-env-guard.md)**
   - Sprint 2, PR#4
   - MSAL 設定健全性ガード
   - 工数: S（1-2日）

### 🔗 関連ドキュメント

10. **[Backlog.md](./Backlog.md)** - バックログ候補
    - Sprint計画の元となるバックログ
    - おすすめバックログ（S工数優先）
    - 次フェーズ候補（M工数）

---

## 🚦 使い方フロー

### 👨‍💼 プロジェクトマネージャー向け

1. **計画確認**
   ```bash
   # 全体計画を確認
   cat SPRINT_PLAN.md
   
   # ビジュアルタイムラインを確認
   cat .github/SPRINT_TIMELINE.md
   ```

2. **進捗管理**
   ```bash
   # 進捗チェックリストを開く
   open IMPLEMENTATION_CHECKLIST.md
   ```

3. **リスク監視**
   - `SPRINT_PLAN.md` の「リスクと対策」セクションを参照
   - `.github/SPRINT_TIMELINE.md` のリスクヒートマップを確認

---

### 👨‍💻 開発者向け

1. **タスク着手前**
   ```bash
   # クイックスタートガイドを確認
   cat SPRINT_QUICKSTART.md
   
   # 担当タスクの Issue Draft を確認
   cat ../issues/001-msal-login-e2e-smoke.md
   ```

2. **実装中**
   ```bash
   # Issue Draft の「実装ポイント」を参照
   # 受け入れ基準を確認しながら実装
   ```

3. **PR作成前**
   ```bash
   # チェックリストで完了確認
   open IMPLEMENTATION_CHECKLIST.md
   ```

---

### 👥 チーム全体向け

1. **キックオフミーティング**
   - `SPRINT_PLAN.md` を全員で確認
   - `.github/SPRINT_TIMELINE.md` で並行作業を調整
   - 担当者を `IMPLEMENTATION_CHECKLIST.md` に記入

2. **デイリースタンドアップ**
   - `IMPLEMENTATION_CHECKLIST.md` で進捗を共有
   - ブロッカーを早期発見

3. **スプリントレビュー**
   - `IMPLEMENTATION_CHECKLIST.md` のメトリクスを確認
   - 目標達成度を評価

4. **レトロスペクティブ**
   - `IMPLEMENTATION_CHECKLIST.md` に振り返りを記録
   - Keep/Problem/Try を整理

---

## 📖 推奨読書順序

### 初めての方

1. 📘 [SPRINT_PLAN.md](./SPRINT_PLAN.md) - 全体像を把握
2. 🗓️ [.github/SPRINT_TIMELINE.md](./.github/SPRINT_TIMELINE.md) - スケジュール確認
3. 🚀 [SPRINT_QUICKSTART.md](./SPRINT_QUICKSTART.md) - 実装方法を理解
4. 📝 [issues/001-msal-login-e2e-smoke.md](./issues/001-msal-login-e2e-smoke.md) - 最初のタスク詳細

### 実装担当者

1. 🚀 [SPRINT_QUICKSTART.md](./SPRINT_QUICKSTART.md) - 実装フロー確認
2. 📝 担当する Issue Draft - 詳細仕様を確認
3. ✅ [IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md) - チェックリスト確認

### レビュアー

1. 📝 対応する Issue Draft - 受け入れ基準を確認
2. ✅ [IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md) - 完了項目を確認
3. 📘 [SPRINT_PLAN.md](./SPRINT_PLAN.md) - コンテキスト理解

---

## 🎯 Sprint 概要

### Sprint 1: 認証E2Eテストと安定性改善 (Week 1-2)

**目標**: MSAL認証とUsers CRUD の最小限の安全網を構築

| PR | タスク | 工数 | 依存 |
|----|--------|------|------|
| #1 | MSAL認証 E2E スモークテスト | S (1-2日) | なし |
| #2 | Users CRUD 基本回帰（追加/削除） | S (1-2日) | PR#1 |

**成果物**:
- E2E テストスイート（認証、Users CRUD）
- CI/CD の安定化
- E2E ベストプラクティスドキュメント

---

### Sprint 2: 品質CI統合 (Week 3-4)

**目標**: 品質を自動で保証する仕組みを確立

| PR | タスク | 工数 | 依存 |
|----|--------|------|------|
| #3 | a11y 自動チェック（jest-axe） | S (1-2日) | なし |
| #4 | MSAL 設定健全性ガード（env schema） | S (1-2日) | なし |

**成果物**:
- アクセシビリティチェックスイート
- 環境変数バリデーション
- 品質ガイドドキュメント

---

## 📊 メトリクス目標

### Sprint 1 完了時

- ✅ E2E テストカバレッジ: 認証 100%, Users CRUD 50%
- ✅ CI 成功率: 90%+
- ✅ CI 実行時間: +3分以内

### Sprint 2 完了時

- ✅ a11y カバレッジ: RecordList & UsersPanel 100%
- ✅ env 検証カバレッジ: MSAL変数 100%
- ✅ CI 成功率: 95%+

---

## ⚠️ 重要な注意事項

### 依存関係

- **PR#2 は PR#1 完了後に開始**: Playwright環境整備が前提
- **PR#3, PR#4 は並行実施可能**: 相互依存なし

### リスク対策

1. **MSAL モック不安定**: `VITE_E2E_MSAL_MOCK=true` で回避
2. **CI タイムアウト**: `playwright.config.ts` で調整
3. **axe 違反多数発見**: 優先度付けて段階的修正

詳細は `SPRINT_PLAN.md` の「リスクと対策」セクションを参照。

---

## 🔗 外部リンク

- [GitHub Project Board](https://github.com/yasutakesougo/audit-management-system-mvp/projects)
- [GitHub Issues](https://github.com/yasutakesougo/audit-management-system-mvp/issues)
- [CI/CD Workflows](https://github.com/yasutakesougo/audit-management-system-mvp/actions)

---

## 📞 サポート

質問や不明点がある場合:

1. Issue Draft の「実装ポイント」を確認
2. `SPRINT_QUICKSTART.md` のトラブルシューティングを確認
3. GitHub Issue でチームに質問
4. プロジェクトマネージャーに相談

---

## 🔄 ドキュメント更新履歴

| 日付 | 更新内容 | 担当者 |
|------|----------|--------|
| 2026-02-03 | 初版作成 | GitHub Copilot |
| | Sprint 1-2 計画策定 | |
| | Issue Draft 4件作成 | |

---

**最終更新**: 2026-02-03  
**次回レビュー**: Sprint 1 完了時（Week 2終了）

---

## 🎓 学習リソース

プロジェクト関連の学習リソース:

- [E2E_BEST_PRACTICES.md](./docs/E2E_BEST_PRACTICES.md) - E2Eテストのベストプラクティス
- [E2E_TEST_STRATEGY.md](./docs/E2E_TEST_STRATEGY.md) - E2Eテスト戦略
- [ACCESSIBILITY_GUIDE.md](./docs/ACCESSIBILITY_GUIDE.md) - アクセシビリティガイド
- [playwright.config.ts](./playwright.config.ts) - Playwright設定

外部リソース:

- [Playwright Documentation](https://playwright.dev/)
- [jest-axe Documentation](https://github.com/nickcolley/jest-axe)
- [Zod Documentation](https://zod.dev/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
