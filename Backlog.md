## Backlog候補

> 新規タスク作成時は GitHub Issue で「📌 Backlog Task」テンプレートを使用してください。  
> テンプレートを使用すると、自動的にプロジェクトボードに追加されます。詳細は [プロジェクトボード自動連携](docs/project-auto-integration.md) を参照してください。

### 📍 計画的なロードマップの Issue 化

以下のバックログ項目は、計画的なロードマップとして [issues/](./issues/) ディレクトリに正式な Issue ドラフトとして文書化されています。

- **Phase 1（短期）**: Status Quo 短期レビュー整備 - S 工数の Issue 001-004
- **Phase 2（中期）**: CI 強化 - M 工数の Issue 005-007

詳細は [issues/README.md](./issues/README.md) を参照してください。

### 複合ページ axe スイープ（ストレッチゴール）

**目標:**  
RecordListとUsersPanelを同時にレンダリングしたページで、アクセシビリティ検証（axe）を実施し、違反ゼロを確認する。

**受け入れ基準:**  
- RecordListとUsersPanelを組み合わせてテスト環境でレンダリングする  
- axe-core（jest-axeや@axe-core/cliなど）でa11yスキャンを実行する  
- アクセシビリティ違反がゼロであることをアサートする  
- axeスキャン結果のJSONをCI用にアーカイブし、将来的な差分検証にも使えるようにする  
- GitHub Actions 等の CI ワークフローで `npx jest-axe` または  
  `npx axe [URL] --save` を走らせ、`artifacts/axe-report.json` として保存する想定  

**補足:**  
この項目はドキュメントのみのBacklogエントリです。このコミットではコードやテストの変更はありません。

### おすすめバックログ（S工数優先導入）

1. **MSAL ログイン E2E スモーク** — [Issue Draft](./issues/001-msal-login-e2e-smoke.md)
  - 目的: 認証の致命的バグを自動検知し、ログイン/ログアウト動線を守る
  - 受け入れ基準: Playwrightで signIn() → /me レンダリング → signOut() が CI で緑になる
  - 工数: S
2. **Users CRUD 基本回帰テスト（追加/削除）** — [Issue Draft](./issues/002-users-crud-smoke.md)
  - 目的: 最小限の CRUD 回帰を保証して、主要なユーザー操作の破壊的変更を早期検知する
  - 受け入れ基準: モック API を使った ユーザー追加 → 削除 のフローが安定してパスする
  - 工数: S
3. **a11y 自動チェック（jest-axe 単体導入）** — [Issue Draft](./issues/003-a11y-unit-checks.md)
  - 目的: 初期段階でアクセシビリティ違反を検知し、UI 品質を維持する
  - 受け入れ基準: RecordList・UsersPanel の単体テストで axe 違反がゼロになる
  - 工数: S
4. **MSAL 設定健全性ガード（env schema）** — [Issue Draft](./issues/004-msal-env-guard.md)
  - 目的: Redirect URI や Authority などの設定ミスを起動時に検知し、環境差異による事故を防ぐ
  - 受け入れ基準: zod 等で env を検証し、不正値があると `npm start` 時にエラーで停止する
  - 工数: S

### 次フェーズ候補（M工数、基盤整備後）

1. **Users CRUD 統合テスト（4 ステップ網羅）** — [Issue Draft](./issues/005-users-crud-integration.md)
  - 目的: 追加 → 一覧 → 編集 → 削除のユーザーフロー全体を自動で保証する
  - 受け入れ基準: モック API と DB リセット機構を併用し、4 ステップを通しで自動化して安定パスする
  - 工数: M
2. **a11y CI 統合（複合ページ）** — [Issue Draft](./issues/006-a11y-ci-integration.md)
  - 目的: RecordList と UsersPanel を組み合わせた画面でもアクセシビリティ違反ゼロを維持する
  - 受け入れ基準: axe レポートを CI で保存し、違反ゼロのときにジョブが成功する
  - 工数: M
3. **HTTPS 復帰（RSA + TLS1.2/1.3）** — [Issue Draft](./issues/007-https-restoration.md)
  - 目的: Entra/MSAL の本番挙動に近い HTTPS 動作を開発環境でも再現する
  - 受け入れ基準: mkcert で発行した証明書を使って Vite dev server が TLS1.2/1.3 で安定稼働する
  - 工数: M
