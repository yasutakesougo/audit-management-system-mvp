# .env / 環境変数設定ガイド

本システムで利用する主な環境変数と、よくある落とし穴をまとめます。

---

## 主要環境変数
| 変数名                        | 用途                       | 例/備考 |
|-------------------------------|----------------------------|---------|
| VITE_FEATURE_SCHEDULES        | スケジュール機能ON/OFF     | '1' で有効 |
| VITE_FEATURE_SCHEDULES_GRAPH  | Graph API連携ON/OFF        | '1' で有効 |
| VITE_APP_E2E                  | E2Eテスト用フラグ          | '1' でE2E専用ルート有効 |
| VITE_MSAL_CLIENT_ID           | MSALクライアントID         | Azure AD登録値 |
| VITE_MSAL_TENANT_ID           | MSALテナントID             | Azure AD登録値 |
| VITE_MSAL_AUTHORITY           | MSAL認証エンドポイント     | Azure AD登録値 |
| VITE_SCHEDULES_WEEK_START     | 週の開始曜日（1=月曜）     | '1' or '0' |

---

## 設定・運用の注意点
- すべてのVITE_変数は .env, .env.local, .env.production などで管理
- 文字列型で値を入れる（例: '1', '0', 'true', 'false'）
- 機密情報（MSAL系）は .env.local で管理し、git管理外に
- E2E/CI用の .env.ci も分離推奨

---

## よくある落とし穴
- 変数名のtypo（VITE_が抜けている等）
- 文字列/数値の型不一致
- CI環境で.envが正しく読まれていない
- 本番/開発で値が食い違う（.env.production/.env.localの優先順位）

---

## 参考
- Vite公式: https://vitejs.dev/guide/env-and-mode.html
- MSAL/Azure AD: https://learn.microsoft.com/ja-jp/azure/active-directory/develop/
