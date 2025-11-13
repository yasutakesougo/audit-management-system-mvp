# CSP 運用ガイド

本ドキュメントは、監査支援システムの Content Security Policy (CSP) を安全に維持するための運用手順をまとめたものです。MSAL リダイレクトフローを既定としつつ、ポップアップフローとの差分、Report-Only から Enforce への切替、違反レポートの扱い、CI ガードレールの位置付けを網羅しています。

---

## 1. 認証フロー別ポリシー

### 1.1 既定: MSAL Redirect フロー
リダイレクトフローでは iframe や popup を要求しないため、`frame-src` と `child-src` を閉じた状態で運用します。以下はステージング／本番共通の推奨ポリシー雛形です。

```text
Content-Security-Policy:
  default-src 'none';
  base-uri 'self';
  connect-src 'self'
    https://isogokatudouhome.sharepoint.com
    https://login.microsoftonline.com
    https://microsofteur.accesscontrol.windows.net
    https://aadcdn.msftauth.net
    https://aadcdn.msauth.net;
  font-src 'self' https: data:;
  img-src 'self' https: data: blob:;
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  object-src 'none';
  frame-ancestors 'none';
  form-action 'self';
  navigate-to 'self' https://login.microsoftonline.com;
  worker-src 'self';
  upgrade-insecure-requests;
  report-to csp-endpoint;
  report-uri /__csp__/*
```

補足:
- `style-src 'unsafe-inline'` は Emotion/MUI のランタイム挿入に対応するため必須です。
- `connect-src` の SharePoint URL はテナント固有です。サブサイト追加時は忘れずに追記します。
- `report-uri` は Collector へのパスに合わせて調整します。開発環境と揃える場合は `/__csp__/report` を利用します。
- MSAL Redirect は `redirectStartPage` で遷移元 URL を自動保持するため、認証後は元の画面へ復帰します。

### 1.2 Popup フローへ切り替える場合
MSAL ポップアップ／iframe を用いる場合は `frame-src` を開放し、`frame-ancestors` も用途に応じて緩和します。

```text
  frame-src 'self' https://login.microsoftonline.com https://aadcdn.msftauth.net;
  frame-ancestors 'self';
```

また、COOP/COEP の緩和が必要な場合は逆プロキシ側で環境限定で設定します。

---

## 2. Report-Only → Enforce 切替 SOP

1. **初期化**: `npm run build && npm run test:csp -- --headed` を実施し、手動操作含めて違反が発生しないことを確認します。
2. **ステージング投入 (Report-Only)**: 24〜48 時間は Report-Only で運用し、`violations.ndjson` と CI アーティファクトを監視します。
3. **評価**: 違反が検知された場合はトリアージ (後述) を実施し、必要に応じて依存ライブラリを修正または CSP を調整します。
4. **Enforce 切替**: 問題がなければ `Content-Security-Policy-Report-Only` を `Content-Security-Policy` に変更します。`Report-To` ヘッダはそのまま維持し、違反検知を継続します。

---

## 3. ロールバック手順

- 逆プロキシまたはアプリの環境変数 (`CSP_ENFORCE`, `CSP_DISABLE`) で Report-Only へ即時戻せるようにします。
- 緊急時は collector のみ残したまま `Content-Security-Policy` を外し、`Content-Security-Policy-Report-Only` に切り替えます。
- ロールバック理由と発生した違反ログを Slack/Teams へ展開し、再発防止策を issue 化します。

---

## 4. Report-To / 収集サーバ設定

- Collector: `scripts/csp-report-server.mjs` (ポート既定 8787, プレフィックス `/__csp__`).
- プレビュー/自動テスト: `scripts/preview-csp.mjs` が dist 配信とヘルスチェック (`/__health`) を提供。
- ログ: `csp-reports/violations.ndjson` に NDJSON 形式で蓄積。CI では `.github/workflows/test-csp.yml` が 7 日間保持します。
- 追加分析が必要な場合は `jq` や BigQuery へ取り込み、違反傾向を可視化します。

---

## 5. CI ガードレール

- `npm run test:csp`: preview + collector を自動で起動し、Playwright でホーム画面を巡回して違反がないことを検証。
- `.github/workflows/test-csp.yml`: Push/PR トリガーで `npm run build` → `npm run test:csp` を実行し、`csp-reports` をアーティファクトとしてアップロード。
- 推奨設定: `test-csp.yml` を main ブランチへの PR に対する必須チェックに設定する。
- CI では「違反ゼロ」に加えて Collector がレポートを 1 件以上受信していることを確認し、監視パイプラインが正常に動作しているかを合わせてチェックします。

---

## 6. 典型違反のトリアージ手順

1. **ログ確認**: `violations.ndjson` または CI アーティファクトを確認し、`blocked-uri`, `violated-directive`, `source-file` を抽出。
2. **分類**:
   - *合法なはず*: ランタイム挿入 (Emotion/MUI)、MSAL、SharePoint など。
   - *不正な挙動*: 外部 CDN 追加、`unsafe-eval` 要求など。
3. **対応**:
   - 合法ケース: CSP ポリシーへ必要なホストやスキームを追加。
   - 不正ケース: 関連コード／依存ライブラリを修正。必要なら暫定的に機能フラグで無効化。
4. **再検証**: `npm run test:csp` と該当操作の手動確認。CI を再実行し、違反が解消されたことを確定。
5. **記録**: Issue/Ticket に違反内容、対応、再発防止策をメモ。

典型的な違反レポート例:

```json
{"effectiveDirective":"script-src","blockedURI":"inline","scriptSample":"eval(...)","sourceFile":"/dist/app.js"}
```

違反例:
- `unsafe-inline`/`unsafe-eval` 要求: 依存パッケージの eval 使用。ビルド設定や代替ライブラリを検討。
- 外部画像ホスト追加: `img-src` にホストを追加、または画像のプロキシ化。

---

## 7. 逆プロキシでの適用ヒント

- **環境変数**: `CSP_ENFORCE`, `CSP_DISABLE`, `CSP_PREFIX`, `CSP_COLLECTOR_ORIGIN` をリバースプロキシやサーバレスの設定と同期。
- **Report-Only 切替**: フラグ 1 つで出し分けできるよう、Infrastructure as Code にテンプレート化。
- **ヘルスチェック**: Collector `/__csp__/health`, Preview `/__health` を監視設定に組み込み、Collector 停止時はアラートを上げる。

---

## 8. ヘッダテンプレート

### 8.1 ステージング (Report-Only)

```text
Content-Security-Policy-Report-Only: <上記ポリシー>
Report-To: {"group":"csp-endpoint","max_age":10886400,"endpoints":[{"url":"https://stg.example.com/__csp__/report"}]}
```

### 8.2 本番 (Enforce)

```text
Content-Security-Policy: <上記ポリシー>
Report-To: {"group":"csp-endpoint","max_age":10886400,"endpoints":[{"url":"https://prod.example.com/__csp__/report"}]}
```

### 8.3 逆プロキシ設定例 (nginx)

```nginx
add_header Content-Security-Policy "$csp_policy" always;
add_header Report-To "$csp_report_to" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

`$csp_policy` は環境ごとに差し替えるか、Feature Flag に応じて変数を切り替えます。

---

## 9. 運用チェックリスト

- [ ] `npm run build && npm run test:csp -- --headed` を本番リリース前に実行。
- [ ] `csp-reports/violations.ndjson` を監視 Job で定期解析し、ダッシュボード化。
- [ ] 逆プロキシ/アプリのフラグで Report-Only ↔ Enforce を即時切替できることを定期的に検証。
- [ ] 新規サードパーティ追加時は事前に CSP 影響評価を実施。
- [ ] `docs/security/csp.md` をリリース毎に更新し、変化点を CHANGELOG に記載。

---

## 10. 参考リンク

- [MDN: Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Microsoft identity platform - SPA best practices](https://learn.microsoft.com/azure/active-directory/develop/msal-js-sso)
- [Google CSP Evaluator](https://csp-evaluator.withgoogle.com/)

---

最新の CSP 設定を反映したら、本ドキュメントに追記を行い、CI ガードが無効化されていないか定期確認してください。