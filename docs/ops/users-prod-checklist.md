# Users（利用者マスタ）本番導入チェックリスト

## 1. 前提

- SharePoint サイト: `https://isogokatudouhome.sharepoint.com/sites/welfare`
- 利用者マスタリスト: `Users_Master`
- 認証: Entra ID（MSAL）経由で SharePoint にアクセス。

## 2. Entra ID / アプリ登録

1. 既存の Schedules/Attendance/Daily 用アプリ登録を流用する（推奨）。
2. 委任権限:
   - 必須: `AllSites.Read`
   - 更新まで行う場合は `AllSites.Manage` も検討。
3. 管理者同意を付与し、リダイレクト URI を確認。

## 3. SharePoint: Users_Master リスト

1. リスト名: **Users_Master**
2. 必須列の存在を確認（`docs/design/users.md` 参照）:
   - `UserID`（Text, 必須）
   - `Title`（Text, 氏名）
   - `IsActive`（Yes/No, 既定値 true）
   - `ServiceStartDate` / `ServiceEndDate`
   - 加算フラグ（例: `IsHighIntensitySupportTarget`, `IsSupportProcedureTarget`, `severeFlag`）
   - 通所曜日/送迎フラグ (`AttendanceDays`, `TransportToDays`, `TransportFromDays`)
3. インポート手順: まずテスト環境に CSV インポート → アプリから一覧表示を確認 → 本番へ適用。

## 4. .env.local の確認

```env
VITE_SP_LIST_USERS=Users_Master
VITE_SP_RESOURCE=https://isogokatudouhome.sharepoint.com
VITE_SP_SITE_RELATIVE=/sites/welfare
VITE_SP_BASE_URL=https://isogokatudouhome.sharepoint.com/sites/welfare
```

## 5. 開発モード動作確認

1. `npm run dev:users`
2. ブラウザで `http://localhost:5178/` → `/users`（一覧）や UserForm を開く。
3. `VITE_SKIP_LOGIN=1` / `VITE_FORCE_SHAREPOINT=0` なのでログイン無しで UI を確認。
4. 確認ポイント: 一覧表示、新規作成/編集、必須項目バリデーション、在籍フラグ切替。

## 6. 本番相当動作確認

1. `.env.local` を本番相当に設定:
   - `VITE_SKIP_LOGIN=0`
   - `VITE_FORCE_SHAREPOINT=1`
   - `VITE_SP_LIST_USERS=Users_Master`
2. `npm run dev` またはビルド済み環境で起動。
3. `/users` にアクセスし、Entra サインイン後に実データ表示を確認。
4. CRUD が Users_Master へ反映され、Schedules/Attendance/Daily で参照できることを確認。

## 7. ロールアウト注意点

- 既存紙/Excel 台帳と `UserID` を突合し、重複や揺れを解消してから切替。
- `UserID` 変更は原則禁止。必要なら新規登録＋旧コード退役の運用を周知。
- 退所・休止は `IsActive` / `UsageStatus` で管理し、レコード削除は避ける。
- モジュール横断で `UserID` 一貫性が崩れないよう、変更フローを明文化する。
