# スケジュール機能 env ロールアウトチェックリスト

対象:

- `env/templates/.env.staging.flags`
- `env/templates/.env.production.flags`
- 実運用中の `.env` / `env.runtime.*.json`

目的:

- フェーズごとの Flag 設定をテンプレ通りに揃えつつ、既存の MSAL / SharePoint / その他設定を壊さずに移行する。

---

## 1. 対象ファイルを確認する

- [ ] 実際に使われている env ファイルを確認する
  - 例: `.env.local`, `.env.staging.local`, `env.runtime.dev.json`, `env.runtime.staging.json`, `env.runtime.prod.json`
- [ ] ビルド／CI で参照されているパスを `package.json` / `scripts` / pipeline で確認

---

## 2. フラグキーの洗い出し

- [ ] `env/templates/.env.staging.flags` を開き、Flag 系キー一覧を控える
- [ ] `env/templates/.env.production.flags` も同様に確認
- [ ] 既存の env ファイルを開き、以下に該当するキーを全てリストアップする
  - `VITE_FEATURE_SCHEDULES*`
  - `VITE_FEATURE_USERS_CRUD`
  - `VITE_FEATURE_COMPLIANCE_FORM`
  - `VITE_SCHEDULES_SAVE_MODE`
  - `VITE_FEATURE_SCHEDULES_SP`, `VITE_FEATURE_SCHEDULES_GRAPH`
  - `VITE_FORCE_SHAREPOINT`
  - `VITE_FEATURE_HYDRATION_HUD`
  - `VITE_DEMO_MODE`, `VITE_SKIP_LOGIN`

---

## 3. テンプレとの差分を確認（staging）

対象: `env/templates/.env.staging.flags` vs staging 用 env

- [ ] テンプレ側の各キーが staging env に存在するか確認
- [ ] 値がテンプレ通りか確認
  - `VITE_FEATURE_SCHEDULES=true`
  - `VITE_FEATURE_SCHEDULES_CREATE=false`
  - `VITE_FEATURE_SCHEDULES_WEEK_V2=true`
  - `VITE_FEATURE_USERS_CRUD=false`
  - `VITE_FEATURE_COMPLIANCE_FORM=false`
  - `VITE_SCHEDULES_SAVE_MODE=real`
  - `VITE_FEATURE_SCHEDULES_SP=true`
  - `VITE_FEATURE_SCHEDULES_GRAPH=false`
  - `VITE_FORCE_SHAREPOINT=true`
  - `VITE_FEATURE_HYDRATION_HUD=false`
  - `VITE_DEMO_MODE=false`
  - `VITE_SKIP_LOGIN=false`
- [ ] staging env にだけ存在する不要・旧キーがあればコメントアウト or 削除方針を決める

---

## 4. テンプレとの差分を確認（production）

対象: `env/templates/.env.production.flags` vs prod 用 env

- [ ] テンプレ側の各キーが prod env に存在するか確認
- [ ] 値がテンプレ通りか確認
  - `VITE_FEATURE_SCHEDULES=true`
  - `VITE_FEATURE_SCHEDULES_CREATE=true`
  - `VITE_FEATURE_SCHEDULES_WEEK_V2=true`
  - `VITE_FEATURE_USERS_CRUD=true`
  - `VITE_FEATURE_COMPLIANCE_FORM=false`（後から true にして OK）
  - `VITE_SCHEDULES_SAVE_MODE=real`
  - `VITE_FEATURE_SCHEDULES_SP=true`
  - `VITE_FEATURE_SCHEDULES_GRAPH=false`
  - `VITE_FORCE_SHAREPOINT=true`
  - `VITE_FEATURE_HYDRATION_HUD=false`
  - `VITE_DEMO_MODE=false`
  - `VITE_SKIP_LOGIN=false`
- [ ] prod env にだけ存在する不要・旧キーがあればコメントアウト or 削除を検討する

---

## 5. localStorage override の初期化手順

- [ ] `docs/design/env-flag-operations.md` のポリシーに従い、本番利用端末のブラウザで以下を実施

```js
Object.keys(localStorage)
  .filter(k => k.startsWith('feature:'))
  .forEach(k => localStorage.removeItem(k));
```

- [ ] staging 用テスト端末では、必要な場合のみ override を利用し、どの端末で何を ON にしたかメモしておく

---

## 6. 動作確認チェック

### 6.1 staging

- [ ] `npm run dev` または staging デプロイを更新
- [ ] 対象ユーザーでログインし、以下を確認
  - [ ] `/schedules/week` にアクセスできる
  - [ ] 新規作成ボタンや編集 UI が想定通り制限されている（`VITE_FEATURE_SCHEDULES_CREATE=false`）
  - [ ] 他のスケジュール関連パスがあれば `/schedules/week` にリダイレクトされる
- [ ] 必要に応じて `VITE_FEATURE_SCHEDULES_CREATE=true` にした staging 分岐を試し、create UI が正しく出ることも確認（本番前に false に戻す）

### 6.2 production

- [ ] prod 環境に env 変更を反映・デプロイ
- [ ] RBAC で編集権限のあるユーザー／ないユーザーを用意し、それぞれで確認
  - [ ] `/schedules/week` の表示
  - [ ] 予定の新規作成・編集が権限通りにできる／できない
- [ ] Daily や他機能に影響が出ていないかスモークテスト

---

## 7. ロールアウト完了条件

- [ ] staging で 1 週間程度のパイロットを実施し、大きな問題がない
- [ ] prod に env 反映後、想定外の UI 露出（非公開機能）がない
- [ ] `docs/design/env-flag-operations.md` に従い、「誰がどのフェーズで何のフラグを触るか」が合意されている

完了後は、必要に応じて Phase 2/3 のフラグ変更（例: `VITE_FEATURE_COMPLIANCE_FORM=true`）を小さな単位で進める。
