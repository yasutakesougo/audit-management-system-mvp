# 📌 MSAL ログイン E2E スモーク

## 目的（なぜやるか／価値）

認証の致命的バグを自動検知し、ログイン/ログアウト動線を守る。

MSAL (Microsoft Authentication Library) による認証フローは、アプリケーションの最も重要な入り口です。ログインが機能しなければ、すべての機能が利用不可能になります。このE2Eスモークテストを導入することで、以下の価値を提供します：

- **早期発見**: 認証周りの破壊的変更を CI で即座に検知
- **品質保証**: デプロイ前にログイン/ログアウトの動作を自動確認
- **安全網**: MSAL 設定やリダイレクト URI の変更による事故を防止
- **開発効率**: 手動での認証テストの負担を削減

## 受け入れ基準（Definition of Done）

- [ ] Playwright で signIn() → /me レンダリング → signOut() のフローを実装
- [ ] CI で E2E テストが緑になる（GitHub Actions で自動実行）
- [ ] /me 取得成功ログをアーティファクトとして保存
- [ ] モック環境（VITE_E2E_MSAL_MOCK=1）で安定してパスする
- [ ] テストが 30 秒以内に完了する

## 目安工数

- [x] S（小）
- [ ] M（中）
- [ ] L（大）

## タスク例

- [ ] `tests/e2e/auth-smoke.spec.ts` を作成
- [ ] signIn() のモック実装を確認
- [ ] /me エンドポイントのレスポンスを検証
- [ ] signOut() 後の状態をアサート
- [ ] CI ワークフロー（ci.yml または e2e.yml）にテストを追加
- [ ] アーティファクトのアップロード設定を追加

## 備考

関連ファイル:
- `src/hooks/useAuth.ts` - MSAL 認証ロジック
- `tests/e2e/app-shell.smoke.spec.ts` - 既存のスモークテスト参考
- `.github/workflows/e2e.yml` - E2E テストワークフロー

参考:
- [MSAL React ドキュメント](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/lib/msal-react)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
