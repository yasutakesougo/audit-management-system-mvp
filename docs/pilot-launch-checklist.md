# 限定運用開始チェックリスト

> **作成日**: 2026-03-10
> **目的**: `.env` 実値設定 → 実効確認 → pilot Go の最終判断を 1 枚で完結させる

---

## Step 1. 環境変数の実値設定

`.env.production`（またはデプロイ先の環境変数管理画面）で以下を確認。

| # | 変数 | 確認事項 | ✅ |
|---|------|---------|-----|
| 1-1 | `VITE_MSAL_CLIENT_ID` | 本番 Azure AD アプリの Client ID が入っている | ☐ |
| 1-2 | `VITE_MSAL_TENANT_ID` | 本番テナント ID が入っている | ☐ |
| 1-3 | `VITE_SP_RESOURCE` | `https://<tenant>.sharepoint.com` 形式で本番 URL | ☐ |
| 1-4 | `VITE_SP_SITE_RELATIVE` | `/sites/<SiteName>` 形式で本番サイトパス | ☐ |
| 1-5 | `VITE_AAD_ADMIN_GROUP_ID` | Entra ID の管理者グループ Object ID（`__FILL_BEFORE_DEPLOY__` を置換済み） | ☐ |
| 1-6 | `VITE_AAD_RECEPTION_GROUP_ID` | Entra ID の受付グループ Object ID（`__FILL_BEFORE_DEPLOY__` を置換済み） | ☐ |
| 1-7 | `VITE_FEATURE_TODAY_OPS` | `1` に設定されている | ☐ |
| 1-8 | `VITE_WRITE_ENABLED` | `1` に設定されている | ☐ |
| 1-9 | `VITE_SKIP_LOGIN` | `0` または未設定（`1` は**禁止**） | ☐ |
| 1-10 | `VITE_SKIP_SHAREPOINT` | `0` または未設定（`1` は `guardProdMisconfig` で即停止） | ☐ |

---

## Step 2. ロール実効確認

3 つのロールで 1 回ずつログインし、想定どおりの導線に入れることを確認。

### admin ユーザー

| # | 確認項目 | 期待結果 | ✅ |
|---|---------|---------|-----|
| 2-1 | `/` にアクセス | `/dashboard` にリダイレクトされる | ☐ |
| 2-2 | `/users` にアクセス | ユーザー一覧が表示される（403 にならない） | ☐ |
| 2-3 | `/staff` にアクセス | 職員一覧が表示される | ☐ |
| 2-4 | `/admin/data-integrity` にアクセス | データ整合性ページが表示される | ☐ |

### reception ユーザー（設定済みの場合）

| # | 確認項目 | 期待結果 | ✅ |
|---|---------|---------|-----|
| 2-5 | `/` にアクセス | `/today` にリダイレクトされる | ☐ |
| 2-6 | `/dailysupport` にアクセス | 日次記録メニューが表示される | ☐ |
| 2-7 | `/users` にアクセス | 「アクセス権がありません」（403）が表示される | ☐ |

### viewer ユーザー（グループ未所属）

| # | 確認項目 | 期待結果 | ✅ |
|---|---------|---------|-----|
| 2-8 | `/` にアクセス | `/today` にリダイレクトされる | ☐ |
| 2-9 | `/users` にアクセス | 「アクセス権がありません」（403）が表示される | ☐ |
| 2-10 | `/staff` にアクセス | 「アクセス権がありません」（403）が表示される | ☐ |

---

## Step 3. コア機能の最終操作確認

実データで最低 1 回の CRUD 操作を行い、SP 読み書きが通ることを確認。

| # | 機能 | 操作 | 確認ポイント | ✅ |
|---|------|------|------------|-----|
| 3-1 | **TodayOps** | `/today` を開く | Hero セクション・NextAction が表示される | ☐ |
| 3-2 | **Dashboard** | `/dashboard` を開く | KPI カード（出席・申し送り・日次記録）にデータが出る | ☐ |
| 3-3 | **出席管理** | `/daily/attendance` で 1 名の出席を登録 | 登録後にリストに反映される | ☐ |
| 3-4 | **日次記録** | `/daily/table` で 1 件の記録を作成・保存 | 保存成功のフィードバックが出る | ☐ |
| 3-5 | **ユーザー一覧** | `/users` でユーザー一覧が表示される | SP `Users_Master` リストからデータを取得できる | ☐ |
| 3-6 | **職員一覧** | `/staff` で職員一覧が表示される | SP `Staff_Master` リストからデータを取得できる | ☐ |

---

## Step 4. Handoff 利用判断

| # | 確認項目 | 回答 | ✅ |
|---|---------|------|-----|
| 4-1 | pilot は**単一端末**で運用するか？ | はい → localStorage で OK / いいえ → SP バックエンド必要 | ☐ |
| 4-2 | （単一端末の場合）`/handoff-timeline` で申し送りを 1 件登録・表示確認 | 正常に動作する | ☐ |
| 4-3 | （複数端末の場合）SP `Handoff` リスト作成 + `VITE_HANDOFF_STORAGE=sharepoint` 設定 | 未対応なら pilot スコープから除外 | ☐ |

---

## Step 5. 最終判断

| # | 判断項目 | 結果 |
|---|---------|------|
| 5-1 | Step 1 の全項目が ✅ | ☐ はい / ☐ いいえ |
| 5-2 | Step 2 の admin 確認（2-1〜2-4）が ✅ | ☐ はい / ☐ いいえ |
| 5-3 | Step 3 の CRUD 確認で致命的エラーなし | ☐ はい / ☐ いいえ |
| 5-4 | Handoff の利用方針が決定済み | ☐ はい / ☐ いいえ |
| 5-5 | [pilot-operation-constraints.md](pilot-operation-constraints.md) を関係者に共有済み | ☐ はい / ☐ いいえ |

> **5-1 〜 5-5 が全て「はい」なら → 限定運用 Go**

---

## 問題発生時の対応

| 症状 | 原因候補 | 対処 |
|------|---------|------|
| ログイン後に白画面 | `.env` の SP 設定ミス（Zod バリデーション失敗） | ブラウザ DevTools Console でエラー確認 → `.env` 修正 |
| 全員が閲覧のみ（admin 不可） | `VITE_AAD_ADMIN_GROUP_ID` 未設定 or 値が間違い | Entra ID でグループ Object ID を再確認 |
| `/today` が 404 | `VITE_FEATURE_TODAY_OPS` が OFF | `.env.production` で `=1` 設定 → 再ビルド |
| SP データが表示されない | リストが存在しない or 権限不足 | SP サイトでリスト存在確認 + アプリ権限確認 |
| Handoff データが消える | localStorage クリア or 別端末 | pilot 条件（単一端末）を再確認 |

---

*関連: [pilot-operation-constraints.md](pilot-operation-constraints.md) / [feature-catalog.md](feature-catalog.md) / [env-reference.md](env-reference.md) / [go-live-playbook.md](go-live-playbook.md)*
