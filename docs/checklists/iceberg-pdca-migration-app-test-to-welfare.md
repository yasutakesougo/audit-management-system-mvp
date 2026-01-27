# Iceberg PDCA: app-test → welfare 移行チェックリスト

目的：検証環境（`/sites/app-test`）で作成した Iceberg PDCA 機能を、本番サイト（`/sites/welfare`）へ安全に切り替える。

---

## Phase 1: 事前確認（5分）

- [ ] SharePoint 本番サイト `/sites/welfare` に `Iceberg_PDCA` リストが存在する
- [ ] リストの列（表示名）が揃っている（UserID / Summary / Phase）
- [ ] 本番でアクセスするユーザー（staff/admin）の権限が確保されている
- [ ] MSAL の設定（tenant/client/redirect/scopes）が本番でも同じ方針で問題ない

---

## Phase 2: InternalName の確認（最重要）

> **Title（表示名）ではなく InternalName を API で使う必要があります。**  
> app-test で `UserID0/Summary0/Phase0` だったのと同様に、本番でもズレる可能性があります。

- [ ] `UserID` の InternalName を確認
- [ ] `Summary` の InternalName を確認
- [ ] `Phase` の InternalName を確認

確認 URL（例：welfare に切替して実行）：
- `.../sites/welfare/_api/web/lists/getbytitle('Iceberg_PDCA')/fields?$select=Title,InternalName`

3行（Title + InternalName）をメモに残す：
- UserID: `________`
- Summary: `________`
- Phase: `________`

---

## Phase 3: 環境変数を本番に切替

- [ ] `VITE_SP_SITE_URL` を `/sites/welfare` に変更
- [ ] `VITE_SP_SITE_RELATIVE` を `/sites/welfare` に変更

例：
- `VITE_SP_SITE_URL=https://isogokatudouhome.sharepoint.com/sites/welfare`
- `VITE_SP_SITE_RELATIVE=/sites/welfare`

---

## Phase 4: 本番の安全装置（権限/ログ）

- [ ] `VITE_WRITE_ENABLED=0`（本番デフォルト）
- [ ] `VITE_AUDIT_DEBUG=0`（本番推奨）
- [ ] staff ロールで「作成フォーム/編集ボタンが出ない」こと
- [ ] admin ロールでのみ書き込み UI が出ること（運用方針が admin write の場合）

---

## Phase 5: 本番スモークテスト（Go/No-Go）

### Read 確認
- [ ] `/analysis/iceberg-pdca` を開ける
- [ ] 利用者選択で一覧が表示される（空なら空表示）
- [ ] Network で GET が `200 OK`

### Write 確認（必要な場合のみ）
- [ ] admin で Create が可能（POST 201）
- [ ] admin で Update が可能（PATCH/MERGE 204 または 200）
- [ ] staff では UI が出ない（writeEnabled=0）

---

## ロールバック手順（緊急時）

- [ ] `.env`（またはデプロイ環境変数）を app-test に戻す
  - `VITE_SP_SITE_URL` / `VITE_SP_SITE_RELATIVE`
- [ ] 影響が UI のみの場合：`VITE_FEATURE_ICEBERG_PDCA=0` で機能OFFも検討
- [ ] 事故が疑われる場合：SharePoint 側の権限（編集）を一時的に外して write を止める

---

## 完了判定

- [ ] Phase 1〜5 がすべてチェック済み
- [ ] InternalName が文書化されている
- [ ] staff で write が無効化されている（本番）

→ ✅ 完了
