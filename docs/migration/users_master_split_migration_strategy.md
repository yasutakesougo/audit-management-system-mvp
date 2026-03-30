# Users_Master データ移行方針 (v1.0)

`Users_Master` リストの単一肥大化状態から、Core, Transport, Benefit の 3リスト分離構成へデータを安全・正確に移行するための計画です。

## 1. 移行の全体フロー

1.  **事前準備**: 分離先リスト (`UserTransport_Settings`, `UserBenefit_Profile`) の自動作成完了を確認。
2.  **バックアップ**: `Users_Master` 全データの Excel キャプチャまたは JSON エクスポート。
3.  **移行スクリプト実行**: `Users_Master` の既存データを読み込み、分離先リストへ `UserID` をキーとして保存。
4.  **整合正・品質確認**: 移行後の各リストの件数とデータの完全性を検証。
5.  **事後処理**: `Users_Master` 内の移動済み列（データは残るが、SELECT から外される）の非表示化・整理。

## 2. 移行対象データ (マッピング)

### 2-1. Transport 移行対象 (UserTransport_Settings)
`Users_Master.UserID` をキーとして、以下の値をコピーします。
*   `TransportToDays`
*   `TransportFromDays`
*   `TransportCourse`
*   `TransportSchedule`
*   `TransportAdditionType`

### 2-2. Benefit 移行対象 (UserBenefit_Profile)
`Users_Master.UserID` をキーとして、以下の値をコピーします。
*   `RecipientCertNumber`
*   `RecipientCertExpiry`
*   `GrantMunicipality`
*   `GrantPeriodStart`
*   `GrantPeriodEnd`
*   `DisabilitySupportLevel`
*   `GrantedDaysPerMonth`
*   `UserCopayLimit`
*   `MealAddition`
*   `CopayPaymentMethod`

## 3. 移行スクリプト (Node.js/Dev Tool 向け擬似コード)

```typescript
async function migrateUsersData(sp: IDataProvider) {
  // 1. Users_Master から全データを取得 (現在、すべての列が SharePoint には残っている)
  const allLegacyUsers = await sp.listItems('Users_Master', { top: 500 });
  console.log(`Found ${allLegacyUsers.length} users to process.`);

  for (const user of allLegacyUsers) {
    const userId = user.UserID;
    if (!userId) continue;

    // 2. Transport データがあるかチェックして保存
    if (user.TransportToDays || user.TransportCourse || user.TransportSchedule) {
      await sp.createItem('UserTransport_Settings', {
        UserID: userId,
        TransportToDays: user.TransportToDays,
        TransportFromDays: user.TransportFromDays,
        TransportCourse: user.TransportCourse,
        TransportSchedule: user.TransportSchedule,
        TransportAdditionType: user.TransportAdditionType,
      });
    }

    // 3. Benefit データがあるかチェックして保存
    if (user.RecipientCertNumber || user.GrantMunicipality || user.UserCopayLimit) {
      await sp.createItem('UserBenefit_Profile', {
        UserID: userId,
        RecipientCertNumber: user.RecipientCertNumber,
        RecipientCertExpiry: user.RecipientCertExpiry,
        GrantMunicipality: user.GrantMunicipality,
        GrantPeriodStart: user.GrantPeriodStart,
        GrantPeriodEnd: user.GrantPeriodEnd,
        DisabilitySupportLevel: user.DisabilitySupportLevel,
        GrantedDaysPerMonth: user.GrantedDaysPerMonth,
        UserCopayLimit: user.UserCopayLimit,
        MealAddition: user.MealAddition,
        CopayPaymentMethod: user.CopayPaymentMethod,
      });
    }
  }
}
```

## 4. 移行リスクと対策

| リスク | 対策 |
| :--- | :--- |
| **データ不整合** | 移行前に `Users_Master` を Excel エクスポートし、移行後の各リストを `UserID` で Excel VLOOKUP 等により全件突合する。 |
| **スロットリング** | 500件程度であれば一括実行で問題ないが、失敗時に備え、移行後リストの重複（UserID 一致）をチェックし、スキップする冪等性を持たせる。 |
| **UserID の重複** | `Users_Master` 内で `UserID` が重複・未入力の場合、移行スクリプトが警告を出すようにする。原則として `UserID` は一意である必要がある。 |

## 5. 移行後の検証指標 (QA)

*   [ ] `Users_Master` の総件数と、各分離先リストのユニーク `UserID` 数が一致するか。 (一部、設定がないユーザーは不在でOK)
*   [ ] 詳細画面を開いたとき、正しく Transport/Benefit の値が従来通り表示されるか。 (Lazy Join の成功確認)
*   [ ] 新規作成したユーザーが、正しく分離先リストにも自動作成されるか。 (Split Write の成功確認)
