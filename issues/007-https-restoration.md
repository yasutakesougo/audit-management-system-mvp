# 📌 HTTPS 復帰（RSA + TLS1.2/1.3）

## 目的（なぜやるか／価値）

Entra/MSAL の本番挙動に近い HTTPS 動作を開発環境でも再現する。

本番環境では HTTPS が必須であり、MSAL の認証フローも HTTPS を前提としています。開発環境で HTTPS を使用することで：

- **本番同等性**: 本番環境と同じ条件でテストできる
- **認証検証**: MSAL の Redirect URI や Cookie の挙動を正確に確認
- **セキュリティ**: Secure Cookie や混在コンテンツの問題を事前に発見
- **デバッグ**: HTTPS 特有の問題（CSP, CORS など）を早期に検知

## 受け入れ基準（Definition of Done）

- [ ] mkcert で発行した証明書を使って Vite dev server が TLS1.2/1.3 で稼働する
- [ ] `npm run dev:https` で HTTPS サーバーが起動する
- [ ] ブラウザで `https://localhost:5173` にアクセスして証明書エラーなく表示される
- [ ] MSAL 認証フローが HTTPS 環境で正常に動作する
- [ ] `.certs/` ディレクトリを `.gitignore` に追加済み
- [ ] README に HTTPS セットアップ手順を記載

## 目安工数

- [ ] S（小）
- [x] M（中）
- [ ] L（大）

## タスク例

- [ ] mkcert のインストール手順を文書化
  - macOS: `brew install mkcert`
  - Linux: mkcert のバイナリをダウンロード
  - Windows: Chocolatey または Scoop でインストール
- [ ] 証明書生成スクリプトの確認・修正
  - `npm run certs:mkcert` が正常に動作することを確認
  - `.certs/localhost.pem` と `.certs/localhost-key.pem` が生成される
- [ ] Vite 設定の更新
  - `vite.config.ts` に HTTPS オプションを追加
  - 証明書ファイルのパスを指定
- [ ] `vite.config.ts` / `npm run dev:https` の HTTPS 設定を適用
  - `vite.config.ts` の `server.https` に `.certs/localhost.pem` / `.certs/localhost-key.pem` を読み込んで適用する
  - 既存の `npm run dev:https` がこの HTTPS 設定を利用して Vite dev server を起動すること（不要な `--https` / 証明書パスの二重指定がないこと）を確認・調整する
- [ ] MSAL 設定の更新
  - Redirect URI に `https://localhost:5173` を追加
  - Entra ID の登録アプリケーションでも Redirect URI を更新
- [ ] `.gitignore` の更新
  - `.certs/` を追加
- [ ] README の更新
  - HTTPS セットアップ手順を追加
  - トラブルシューティングセクションを追加

## 備考

関連ファイル:
- `vite.config.ts` - Vite の設定ファイル
- `package.json` - npm scripts（`dev:https`, `certs:mkcert` など）
- `.gitignore` - 証明書ファイルの除外
- `README.md` - セットアップドキュメント
- `src/auth/msalConfig.ts` - MSAL 設定
- `src/lib/msalConfig.ts` - MSAL 設定（互換 shim）

参考:
- [mkcert GitHub](https://github.com/FiloSottile/mkcert)
- [Vite HTTPS Config](https://vitejs.dev/config/server-options.html#server-https)
- [MSAL Redirect URI Configuration](https://learn.microsoft.com/en-us/azure/active-directory/develop/scenario-spa-app-registration#redirect-uri-msaljs-20-with-auth-code-flow)

注意事項:
- mkcert でルート CA をインストールする必要があります（`mkcert -install`）
- CI 環境では HTTPS を使用しない（証明書管理が複雑になるため）
- 証明書ファイルは `.gitignore` に追加し、コミットしないこと

トラブルシューティング:
- 証明書エラーが出る場合: ルート CA が正しくインストールされているか確認
- ポート競合: package.json の `ports:clean` スクリプトでポートをクリア
- MSAL エラー: Redirect URI が `https://localhost:5173` になっているか確認
