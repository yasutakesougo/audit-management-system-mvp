# SharePoint リスト設計書（内部名・論理名・用途）

本ドキュメントは、アプリケーションコード（`src/sharepoint/fields.ts` など）と
SharePoint リスト設計の対応関係を整理したものです。

- 対象リスト
  - `Users_Master`（利用者マスタ）
  - `Staff_Master`（職員マスタ）
  - `Org_Master`（組織マスタ）
  - `Schedules`（スケジュール）
  - `Daily`（生活記録）
  - `Dat_Behaviors`（行動記録）
  - `FormsResponses_Tokusei`（特性アンケート）

> ⚠️ 注意
> 内部名は **サイト作成時に一度決まると変更できない** ため、
> 新規リスト作成時は本設計書と `fields.ts` を必ず突き合わせてください。

---

## 1. Users_Master（利用者マスタ）

- リスト名: `Users_Master`
- ListKey: `ListKeys.UsersMaster`
- 型: `IUserMaster`, `IUserMasterCreateDto`
- OData 取得時のフィールドセット: `USERS_SELECT_FIELDS_SAFE`

### 1-1. カラム一覧

| 論理名 (コード) | SharePoint 内部名 | 型(想定) | 用途 / 補足 |
|-----------------|------------------|----------|-------------|
| id | `Id` | number | SP 既定 ID |
| title | `Title` | text | 表示名（必要なら氏名コピー） |
| userId | `UserID` | text | 利用者コード（一意） |
| fullName | `FullName` | text | 利用者氏名 |
| furigana | `Furigana` | text | ふりがな（任意） |
| fullNameKana | `FullNameKana` | text | カナ表記（任意） |
| contractDate | `ContractDate` | date | 契約日 |
| serviceStartDate | `ServiceStartDate` | date | サービス開始日 |
| serviceEndDate | `ServiceEndDate` | date | サービス終了日 |
| isHighIntensitySupportTarget | `IsHighIntensitySupportTarget` | bool | 重度加算対象フラグ |
| isSupportProcedureTarget | `IsSupportProcedureTarget` | bool | 支援手順記録対象フラグ |
| severeFlag | `severeFlag` | bool | 重要利用者フラグ（UI 強調） |
| isActive | `IsActive` | bool | 有効／無効 |
| transportToDays | `TransportToDays` | multi-choice | 送迎（行き）曜日 |
| transportFromDays | `TransportFromDays` | multi-choice | 送迎（帰り）曜日 |
| attendanceDays | `AttendanceDays` | multi-choice | 通所曜日 |
| recipientCertNumber | `RecipientCertNumber` | text | 受給者証番号 |
| recipientCertExpiry | `RecipientCertExpiry` | date | 受給者証有効期限 |
| usageStatus | `UsageStatus` | text | 利用ステータス（現利用／休止など） |
| grantMunicipality | `GrantMunicipality` | text | 支給決定自治体 |
| grantPeriodStart | `GrantPeriodStart` | date | 支給決定期間開始 |
| grantPeriodEnd | `GrantPeriodEnd` | date | 支給決定期間終了 |
| disabilitySupportLevel | `DisabilitySupportLevel` | text | 障害支援区分 |
| grantedDaysPerMonth | `GrantedDaysPerMonth` | text | 支給日数／月 |
| userCopayLimit | `UserCopayLimit` | text | 利用者負担上限額 |
| transportAdditionType | `TransportAdditionType` | text | 送迎加算種別 |
| mealAddition | `MealAddition` | text | 食事提供加算区分 |
| copayPaymentMethod | `CopayPaymentMethod` | text | 利用者負担支払方法 |
| modified | `Modified` | datetime | SP 既定更新日時 |
| created | `Created` | datetime | SP 既定作成日時 |

> Phase1 必須列は `schedules-rollout.md` の「3.1 Users_Master」を参照。

---

## 2. Staff_Master（職員マスタ）

- リスト名: `Staff_Master`
- ListKey: `ListKeys.StaffMaster`
- フィールドマップ: `FIELD_MAP.Staff_Master`
- 取得セット: `STAFF_SELECT_FIELDS_CANONICAL`

### 2-1. カラム一覧

| 論理名 | 内部名 | 型(想定) | 用途 |
|--------|--------|----------|------|
| id | `Id` | number | SP既定 |
| title | `Title` | text | 職員表示名 |
| staffId | `StaffID` | text | 職員コード |
| fullName | `FullName` | text | 氏名 |
| furigana | `Furigana` | text | ふりがな |
| fullNameKana | `FullNameKana` | text | カナ表記 |
| jobTitle | `JobTitle` | text | 役職／職種 |
| employmentType | `EmploymentType` | text | 常勤／非常勤 等 |
| rbacRole | `RBACRole` | text | RBAC 用ロール名 |
| role | `Role` | text | 画面上の役割名（補助） |
| isActive | `IsActive` | bool | 在籍フラグ |
| department | `Department` | text | 所属部署 |
| workDaysText | `Work_x0020_Days` | text | 出勤曜日（自由記述） |
| workDays | `WorkDays` | multi-choice | 出勤曜日（構造化） |
| baseShiftStartTime | `BaseShiftStartTime` | time | 基本勤務開始時刻 |
| baseShiftEndTime | `BaseShiftEndTime` | time | 基本勤務終了時刻 |
| baseWorkingDays | `BaseWorkingDays` | number | 想定勤務日数 |
| hireDate | `HireDate` | date | 入職日 |
| resignDate | `ResignDate` | date | 退職日 |
| email | `Email` | text | メールアドレス |
| phone | `Phone` | text | 電話番号 |
| certifications | `Certifications` | multi-line | 資格情報 |

---

## 3. Org_Master（組織マスタ）

- リスト名: `Org_Master`
- ListKey: `ListKeys.OrgMaster`
- 定義: `ORG_MASTER_FIELDS`

### 3-1. カラム一覧

| 論理名 | 内部名 | 型(想定) | 用途 |
|--------|--------|----------|------|
| id | `Id` | number | SP既定 |
| title | `Title` | text | 組織名・資源名 |
| orgCode | `OrgCode` | text | 組織コード |
| orgType | `OrgType` | text | 種別（事業所/外部機関等） |
| audience | `Audience` | text | 対象（利用者/家族/職員等） |
| sortOrder | `SortOrder` | number | 並び順 |
| isActive | `IsActive` | bool | 有効フラグ |
| notes | `Notes` | text | 備考 |

---

## 4. Schedules（スケジュール）

- リスト名: `Schedules`（想定。実際のタイトルはサイトに合わせて確認）
- フィールドマップ: `FIELD_MAP.Schedules`
- 共通フィールドセット: `SCHEDULES_BASE_FIELDS`, `SCHEDULES_MINIMAL_FIELDS`

### 4-1. FIELD_MAP.Schedules ベース

| 論理名 | 内部名 | 型(想定) | 用途 |
|--------|--------|----------|------|
| id | `Id` | number | SP既定 |
| title | `Title` | text | 予定タイトル |
| start | `StartDateTime` | datetime | 開始日時（新システム用） |
| end | `EndDateTime` | datetime | 終了日時（新システム用） |
| status | `Status` | text | ステータス |
| notes | `Note` | text | メモ |
| serviceType | `ServiceType` | text | サービス種別（生活介護等） |
| staffIds | `AssignedStaffId` | lookup/array | 担当職員 ID |
| billingFlags | `BillingFlags` | text | 請求・加算フラグ |
| relatedResourceIds | `RelatedResourceId` | lookup/array | 関連資源 ID |
| targetUserIds | `TargetUserId` | lookup/array | 対象利用者 ID |
| created | `Created` | datetime | SP既定 |
| modified | `Modified` | datetime | SP既定 |
| createdAt | `CreatedAt` | datetime | アプリ管理用作成日時 |
| updatedAt | `UpdatedAt` | datetime | アプリ管理用更新日時 |
| rowKey | `RowKey` | text | 内部一意キー |
| dayKey | `Date` | date | 日単位キー（旧項目の互換） |
| monthKey | `MonthKey` | text | 月単位キー |

### 4-2. `SCHEDULE_FIELD_*` ベース（カテゴリ系）

| シンボル | 内部名 | 用途 |
|---------|--------|------|
| `SCHEDULE_FIELD_START` | `EventDate` | 一部環境での開始日時（旧） |
| `SCHEDULE_FIELD_END` | `EndDate` | 一部環境での終了日時（旧） |
| `SCHEDULE_FIELD_STATUS` | `Status` | ステータス |
| `SCHEDULE_FIELD_CATEGORY` | `cr014_category` | カテゴリ |
| `SCHEDULE_FIELD_SERVICE_TYPE` | `ServiceType` | サービス種別 |
| `SCHEDULE_FIELD_PERSON_TYPE` | `cr014_personType` | PersonType (User/Staff/Org) |
| `SCHEDULE_FIELD_PERSON_ID` | `cr014_personId` | Person ID（汎用） |
| `SCHEDULE_FIELD_PERSON_NAME` | `cr014_personName` | Person 名（汎用） |
| `SCHEDULE_FIELD_EXTERNAL_NAME` | `cr014_externalPersonName` | 外部者名 |
| `SCHEDULE_FIELD_EXTERNAL_ORG` | `cr014_externalPersonOrg` | 外部機関名 |
| `SCHEDULE_FIELD_EXTERNAL_CONTACT` | `cr014_externalPersonContact` | 連絡先 |
| `SCHEDULE_FIELD_STAFF_IDS` | `cr014_staffIds` | スタッフ ID 列（テキスト/JSON 等） |
| `SCHEDULE_FIELD_STAFF_NAMES` | `cr014_staffNames` | スタッフ名一覧 |
| `SCHEDULE_FIELD_BILLING_FLAGS` | `BillingFlags` | 請求フラグ |
| `SCHEDULE_FIELD_NOTE` | `Note` | 備考 |
| `SCHEDULE_FIELD_ASSIGNED_STAFF` | `AssignedStaff` | 担当職員名（テキスト） |
| `SCHEDULE_FIELD_ASSIGNED_STAFF_ID` | `AssignedStaffId` | 担当職員 ID（Lookup） |
| `SCHEDULE_FIELD_TARGET_USER` | `TargetUser` | 対象利用者（テキスト） |
| `SCHEDULE_FIELD_TARGET_USER_ID` | `TargetUserId` | 対象利用者 ID（Lookup） |
| `SCHEDULE_FIELD_RELATED_RESOURCE` | `RelatedResource` | 関連資源名 |
| `SCHEDULE_FIELD_RELATED_RESOURCE_ID` | `RelatedResourceId` | 関連資源 ID |
| `SCHEDULE_FIELD_ROW_KEY` | `RowKey` | 内部キー |
| `SCHEDULE_FIELD_DAY_KEY` | `cr014_dayKey` | 日キー |
| `SCHEDULE_FIELD_FISCAL_YEAR` | `cr014_fiscalYear` | 年度キー |
| `SCHEDULE_FIELD_MONTH_KEY` | `MonthKey` | 月キー |
| `SCHEDULE_FIELD_ENTRY_HASH` | `EntryHash` | 変更検出用ハッシュ |
| `SCHEDULE_FIELD_SUB_TYPE` | `SubType` | サブタイプ |
| `SCHEDULE_FIELD_ORG_AUDIENCE` | `cr014_orgAudience` | 対象組織 |
| `SCHEDULE_FIELD_ORG_RESOURCE_ID` | `cr014_resourceId` | 組織資源 ID |
| `SCHEDULE_FIELD_ORG_EXTERNAL_NAME` | `ExternalOrgName` | 外部組織名 |
| `SCHEDULE_FIELD_DAY_PART` | `cr014_dayPart` | 時間帯（午前/午後など） |
| `SCHEDULE_FIELD_CREATED_AT` | `CreatedAt` | アプリ作成日時 |
| `SCHEDULE_FIELD_UPDATED_AT` | `UpdatedAt` | アプリ更新日時 |

> Phase1 で必須となるフィールドは `schedules-rollout.md` の「3.3 Schedules」を参照。

---

## 5. Daily（生活記録）

- 定数: `DAILY_FIELD_*`
- SharePoint 型: `SpDailyItem`

### 5-1. カラム一覧

| シンボル | 内部名 | 型(想定) | 用途 |
|---------|--------|----------|------|
| `DAILY_FIELD_DATE` | `Date` | date | 記録日 |
| `DAILY_FIELD_START_TIME` | `StartTime` | time | 開始時刻 |
| `DAILY_FIELD_END_TIME` | `EndTime` | time | 終了時刻 |
| `DAILY_FIELD_LOCATION` | `Location` | text | 場所 |
| `DAILY_FIELD_STAFF_ID` | `StaffIdId` | lookupId | 職員 ID |
| `DAILY_FIELD_USER_ID` | `UserIdId` | lookupId | 利用者 ID |
| `DAILY_FIELD_NOTES` | `Notes` | text | メモ |
| `DAILY_FIELD_MEAL_LOG` | `MealLog` | text/json | 食事記録 |
| `DAILY_FIELD_BEHAVIOR_LOG` | `BehaviorLog` | text/json | 行動記録 |
| `DAILY_FIELD_DRAFT` | `Draft` | bool | 下書きフラグ |
| `DAILY_FIELD_STATUS` | `Status` | text | ステータス |

---

## 6. Dat_Behaviors（行動記録）

- ListKey: `ListKeys.Behaviors`
- 定義: `FIELD_MAP_BEHAVIORS`, `BEHAVIORS_SELECT_FIELDS`

### 6-1. カラム一覧

| 論理名 | 内部名 | 用途 |
|--------|--------|------|
| id | `Id` | SP既定 |
| userId | `UserID` | 対象利用者 ID（コード or Lookup） |
| timestamp | `BehaviorDateTime` | 行動発生日時 |
| antecedent | `Antecedent` | きっかけ（A） |
| behavior | `BehaviorType` | 行動内容（B） |
| consequence | `Consequence` | 結果・対応（C） |
| intensity | `Intensity` | 強度 |
| duration | `DurationMinutes` | 継続時間 |
| memo | `Notes` | メモ |
| created | `Created` | 作成日時 |

---

## 7. FormsResponses_Tokusei（特性アンケート）

- ListKey: `ListKeys.SurveyTokusei`
- 定義: `FIELD_MAP_SURVEY_TOKUSEI`, `SURVEY_TOKUSEI_SELECT_FIELDS`

### 7-1. カラム一覧

| 論理名 | 内部名 | 用途 |
|--------|--------|------|
| id | `Id` | SP既定 |
| responseId | `ResponseId` | Forms 側のレスポンス ID |
| responderEmail | `ResponderEmail` | 回答者メール |
| responderName | `ResponderName` | 回答者名 |
| fillDate | `FillDate` | 回答日時 |
| targetUserName | `TargetUserName` | 対象利用者名 |
| guardianName | `GuardianName` | 保護者名 |
| relation | `Relation` | 続柄 |
| heightCm | `HeightCm` | 身長 |
| weightKg | `WeightKg` | 体重 |
| personality | `Personality` | 性格・特徴 |
| sensoryFeatures | `SensoryFeatures` | 感覚特性 |
| behaviorFeatures | `BehaviorFeatures` | 行動の特徴 |
| preferences | `Preferences` | 好きなこと |
| strengths | `Strengths` | 強み |
| notes | `Notes` | その他特記事項 |
| created | `Created` | 作成日時 |

---

## 8. 今後の拡張・運用ルール

- 新しい列を追加する場合：
  - [ ] 先に SharePoint で内部名を設計（英字のみ／スペース不可）
  - [ ] `src/sharepoint/fields.ts` に FIELD_MAP / 定数を追加
  - [ ] 関連する domain 型（例: `IUserMaster`）にもプロパティを追加
  - [ ] 必要なら `USERS_SELECT_FIELDS_SAFE` 等の SELECT にも追加
- 既存列の表示名を変更する場合：
  - 内部名は変えず、SP 側で表示名だけ編集する（コード変更不要）
