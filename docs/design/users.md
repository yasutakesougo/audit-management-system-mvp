# Users（利用者マスタ）設計メモ

## 1. ゴール

- SharePoint リスト `Users_Master` を全モジュール共通の単一マスタとして扱う。
- Schedules / Attendance / Daily / Nurse / SupportPlan など **全モジュールが同じ利用者キーを参照** する状態を維持する。
- 利用者情報の更新は基本このマスタのみで行い、他モジュールは参照＋派生情報とする。

## 2. ドメインモデル概要

- 生データ: `SpUserItem`（`src/types/index.ts`）
- アプリ整形済みモデル: `User` / `SupportUser`（一覧・検索・フィルタで使用）
- 主キー: `UserID`（事業所内で一意な利用者コード。Schedules/Attendance/Daily の参照キー）

## 3. SharePoint 列マッピング（Users_Master）

ソースオブトゥルース: `src/sharepoint/fields.ts` の `FIELD_MAP.Users_Master` / `USERS_SELECT_FIELDS_SAFE`

| カテゴリ | SP 内部名 | 型 | アプリ側プロパティ例 | 用途・備考 |
| --- | --- | --- | --- | --- |
| キー | `Id` | Number | `id` | SP 既定 ID |
| キー | `Title` | Text | `fullName` | 表示名（必須） |
| キー | `UserID` | Text | `userId` | 事業所内一意コード（必須、変更原則不可） |
| 基本 | `Furigana` | Text | `furigana` | ふりがな |
| 基本 | `FullNameKana` | Text | `nameKana` | カナ表記（必要に応じて） |
| 期間 | `ContractDate` | Date | `contractDate` | 契約日 |
| 期間 | `ServiceStartDate` | Date | `serviceStartDate` | サービス開始日 |
| 期間 | `ServiceEndDate` | Date | `serviceEndDate` | サービス終了日（退所日） |
| フラグ | `IsHighIntensitySupportTarget` | Yes/No | `highIntensitySupport` | 重度加算対象 |
| フラグ | `IsSupportProcedureTarget` | Yes/No | `isSupportProcedureTarget` | 支援手順記録対象 |
| フラグ | `severeFlag` | Yes/No | `severeFlag` | 旧フラグ（互換） |
| ステータス | `IsActive` | Yes/No | `active` | 在籍中かどうか（削除せず残す） |
| 通所 | `TransportToDays` | MultiChoice | `toDays` | 送迎（往路）曜日 |
| 通所 | `TransportFromDays` | MultiChoice | `fromDays` | 送迎（復路）曜日 |
| 通所 | `AttendanceDays` | MultiChoice | `attendanceDays` | 想定出席曜日（Attendance 突合） |
| 証書 | `RecipientCertNumber` | Text | `certNumber` | 受給者証番号 |
| 証書 | `RecipientCertExpiry` | Date | `certExpiry` | 受給者証有効期限 |
| 利用状態 | `UsageStatus` | Text/Choice | `usageStatus` | 在籍/休止/退所など（任意拡張） |
| 支給決定 | `GrantMunicipality` | Text | `grantMunicipality` | 支給市町村 |
| 支給決定 | `GrantPeriodStart` | Date | `grantPeriodStart` | 支給期間開始 |
| 支給決定 | `GrantPeriodEnd` | Date | `grantPeriodEnd` | 支給期間終了 |
| 支給決定 | `DisabilitySupportLevel` | Text | `disabilitySupportLevel` | 受給区分 |
| 支給決定 | `GrantedDaysPerMonth` | Text | `grantedDaysPerMonth` | 支給日数 |
| 支給決定 | `UserCopayLimit` | Text | `userCopayLimit` | 自己負担上限 |
| 加算 | `TransportAdditionType` | Text | `transportAdditionType` | 送迎加算種別 |
| 加算 | `MealAddition` | Text | `mealAddition` | 食事加算 |
| 請求 | `CopayPaymentMethod` | Text | `copayPaymentMethod` | 自己負担徴収方法 |
| メタ | `Created`/`Modified` | Date | `created`/`modified` | 監査用 |

> 列追加時は `fields.ts` とこの表を同時更新し、ハードコードを避ける。

## 4. 関連モジュール

- Schedules: 予定対象のユーザー解決に `UserID` を使用。
- Attendance: `Attendance.userCode` が `Users_Master.UserID` と一致する前提で出席判定。
- Daily Support Records: `cr013_usercode`（仮）を `UserID` と突合し、1 日 1 人の軸を維持。
- Nurse / SupportPlan: 対象者選択のソースを Users_Master に限定。

## 5. バリデーション・UI ポリシー（UserForm 例）

- 必須: `UserID`, `Title`, `ServiceStartDate`（事業所要件に応じて）
- `UserID` は原則変更禁止。変更が必要なら新規登録＋旧コード退役の運用を推奨。
- ステータス管理は `IsActive` / `UsageStatus` で行い、レコード削除は避ける。
- 検索・フィルタ: 名前/フリガナ/コード/在籍ステータス/通所曜日で絞り込みできると良い。

## 6. テスト方針（mini セット）

- `tests/unit/users.store.spec.ts`: フック選択・デモ切り替え・環境フラグの分岐。
- `tests/unit/users.api.spec.ts`: SharePoint CRUD 呼び出し、マッピング、監査出力。
- 将来追加: `UserForm` の必須項目バリデーション・加算フラグ表示・在籍切替 UI。
