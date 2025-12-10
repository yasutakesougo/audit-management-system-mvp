# 🗂️ SharePoint アクセス制御ガイド

> 対象: 開発・運用・監査チーム
> 関連: [playbook.md](./playbook.md#2-方針の全体構造)

---

## 1. 目的

本システムでは SharePoint Online をデータストアとして利用しています。
Power Automate、Graph API、PnPjs 経由のアクセスを標準化し、
**最小権限・一元管理・監査可能性** を確保します。

---

## 2. 接続設定

| 環境変数 | 例 | 備考 |
|-----------|----|------|
| `VITE_SP_RESOURCE` | `https://isogokatudouhome.sharepoint.com` | テナントルート |
| `VITE_SP_SITE_RELATIVE` | `/sites/welfare` | サイト相対パス |
| `VITE_SP_SITE_ID` | `guid:{...}` | `Get-PnPSite` で取得 |
| `VITE_SP_LIST_SCHEDULES` | `ScheduleEvents` | スケジュール管理リスト |

---

## 3. リスト権限設計

| リスト名 | 権限 | 備考 |
|-----------|------|------|
| Users_Master | 読取専用 | 全職員 |
| SupportRecord_Daily | 編集 | 登録者＋管理者 |
| ScheduleEvents | 参照＋追加 | 職員ユーザー |
| Compliance | 管理者専用 | 監査チーム |

---

## 4. API ポリシー

- REST: `_api/web/lists/GetByTitle('ListName')/items`
- Select 句: `EventDate, EndDate, Category, AssignedStaff/Title`
- Expand 句: `AssignedStaff, TargetUser`
- 1 リクエスト最大: `$top=500`
- リトライ戦略: `exponentialBackoff(3, 200, 2.0)`

---

## 5. 監査と整合性

- 各リストの内部名・型を `schema-audit.md` に定期エクスポート。
- `Get-PnPListItem` により構造差分を検知。
- 破損検出時は Power Automate で Teams 通知。

---

## 6. 参考資料

- [SharePoint REST API Reference](https://learn.microsoft.com/sharepoint/dev/sp-add-ins/sharepoint-rest-interface)
- [PnP PowerShell Get-PnPSite](https://pnp.github.io/powershell/cmdlets/Get-PnPSite.html)
