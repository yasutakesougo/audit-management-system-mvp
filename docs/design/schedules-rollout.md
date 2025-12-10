# スケジュール機能 実用フェーズ Rollout 計画

## 0. 概要

本ドキュメントは、生活介護システムにおける **スケジュール機能** を
「開発フェーズ」から「現場での日常運用」に段階的に移行するための計画です。

- 対象機能
  - `/schedules/week`（週表示、新UI）
  - 関連ルート：`/schedules/*`, `/admin/integrated-resource-calendar`
- 対象データ
  - SharePoint リスト：`Users_Master`, `Staff_Master`, `Schedules`, `Daily`, `Org_Master`
- 対象環境
  - `dev` / `staging` / `prod`（`env.runtime.*.json`）

---

## 1. 段階リリース方針（フェーズ定義）

### Phase 0: 内輪検証（開発チーム）

- **目的**: UI/UX とルーティングの確認、致命的なバグ潰し
- **対象**: 開発者／一部キーメンバーのみ
- **特徴**:
  - Demo / SP / Graph いずれかを自由に切替
  - 書き込み・削除も制限なし
  - Hydration HUD など開発用デバッグ機能を利用可

### Phase 1: パイロット運用（限定メンバー）

- **目的**: 実際の利用者・職員データを用いた「現場での使い勝手」の検証
- **対象**: 現場のキーメンバー数名＋管理者
- **特徴**:
  - `/schedules/week` を中心に参照優先
  - 書き込みはごく一部の担当者のみ（または一時的に停止）
  - Users / Staff / Schedules のデータ列は **Phase 1 必須カラムのみ** を保証

### Phase 2: 一般運用（限定書き込み）

- **目的**: 多くの職員が日常的にスケジュール機能を使用
- **対象**: スタッフ全体（ただし更新権限にはロール制限）
- **特徴**:
  - 予定の新規作成・変更を本格運用
  - 利用者マスタに請求系カラムを徐々に反映
  - Users CRUD や Compliance フォームを一部導入可能

### Phase 3: フル運用（Golden Thread レベル）

- **目的**: スケジュールを「公式な実績管理の一部」として運用
- **対象**: 事業所全体
- **特徴**:
  - Daily 記録、Behaviors、Tokusei、Org_Master と Golden Thread を構築
  - 監査対応（Audit ログ＋EntryHash）を含め、証跡としても使用
  - 追加加算・分析用途まで含めたフル機能稼働

---

## 2. Feature Flag / env 設定マトリクス

### 2.1 主なフラグ・環境値

| 種別 | キー | 役割 |
|------|------|------|
| 画面フラグ | `VITE_FEATURE_SCHEDULES` | スケジュール機能全体の露出（`/schedules/*`） |
| 画面フラグ | `VITE_FEATURE_SCHEDULES_CREATE` | 予定の新規作成・編集 UI の解放 |
| 画面フラグ | `VITE_FEATURE_SCHEDULES_WEEK_V2` | 新・週表示 UI の有効化 |
| 画面フラグ | `VITE_FEATURE_COMPLIANCE_FORM` | コンプライアンスフォーム機能 |
| 画面フラグ | `VITE_FEATURE_USERS_CRUD` | 利用者 CRUD 機能の解放 |
| デバッグ | `VITE_FEATURE_HYDRATION_HUD` | Hydration HUD を表示 |
| 保存モード | `VITE_SCHEDULES_SAVE_MODE` | `"mock"` or `"real"`（保存先モード） |
| 接続切替 | `VITE_FEATURE_SCHEDULES_SP` | SharePoint ベースの port を使用 |
| 接続切替 | `VITE_FEATURE_SCHEDULES_GRAPH` | Graph ベースの port を使用 |
| 接続切替 | `VITE_FORCE_SHAREPOINT` | 強制的に SharePoint を利用 |

※フラグの実評価は `env.ts` の helper（`isSchedulesFeatureEnabled` など）＋ `localStorage("feature:*")` により決定される。

### 2.2 フェーズ別 推奨設定

#### Phase 0: 内輪検証（dev）

```env
VITE_FEATURE_SCHEDULES=true
VITE_FEATURE_SCHEDULES_CREATE=true
VITE_FEATURE_SCHEDULES_WEEK_V2=true
VITE_FEATURE_USERS_CRUD=true
VITE_FEATURE_COMPLIANCE_FORM=false

VITE_SCHEDULES_SAVE_MODE="mock"  # or dev用SP
VITE_FEATURE_SCHEDULES_SP=false
VITE_FEATURE_SCHEDULES_GRAPH=false

VITE_FORCE_SHAREPOINT=false
VITE_FEATURE_HYDRATION_HUD=true
VITE_DEMO_MODE=true              # 必要に応じて
VITE_SKIP_LOGIN=true             # ログインショートカット
```

#### Phase 1: パイロット（staging）

```env
VITE_FEATURE_SCHEDULES=true
VITE_FEATURE_SCHEDULES_CREATE=false        # 参照優先
VITE_FEATURE_SCHEDULES_WEEK_V2=true
VITE_FEATURE_USERS_CRUD=false
VITE_FEATURE_COMPLIANCE_FORM=false

VITE_SCHEDULES_SAVE_MODE="real"
VITE_FEATURE_SCHEDULES_SP=true
VITE_FEATURE_SCHEDULES_GRAPH=false
VITE_FORCE_SHAREPOINT=true

VITE_FEATURE_HYDRATION_HUD=false
VITE_DEMO_MODE=false
VITE_SKIP_LOGIN=false
```

#### Phase 2: 一般運用（prod 準備）

```env
VITE_FEATURE_SCHEDULES=true
VITE_FEATURE_SCHEDULES_CREATE=true
VITE_FEATURE_SCHEDULES_WEEK_V2=true
VITE_FEATURE_USERS_CRUD=true              # RBAC で実際の権限制御
VITE_FEATURE_COMPLIANCE_FORM=false        # 任意

VITE_SCHEDULES_SAVE_MODE="real"
VITE_FEATURE_SCHEDULES_SP=true
VITE_FEATURE_SCHEDULES_GRAPH=false
VITE_FORCE_SHAREPOINT=true

VITE_FEATURE_HYDRATION_HUD=false
VITE_DEMO_MODE=false
VITE_SKIP_LOGIN=false
```

#### Phase 3: フル運用（prod 完全）

```env
VITE_FEATURE_SCHEDULES=true
VITE_FEATURE_SCHEDULES_CREATE=true
VITE_FEATURE_SCHEDULES_WEEK_V2=true
VITE_FEATURE_USERS_CRUD=true
VITE_FEATURE_COMPLIANCE_FORM=true        # 必要に応じて ON

VITE_SCHEDULES_SAVE_MODE="real"
VITE_FEATURE_SCHEDULES_SP=true
VITE_FEATURE_SCHEDULES_GRAPH=false       # 必要なら true
VITE_FORCE_SHAREPOINT=true

VITE_FEATURE_HYDRATION_HUD=false
VITE_DEMO_MODE=false
VITE_SKIP_LOGIN=false
```

### 2.3 localStorage override 運用ルール

`env.ts` により、`VITE_FEATURE_*` が false でも `localStorage["feature:schedules"]` などが true だと UI が露出する。

- **本番（prod）**:
  - 原則 localStorage override は使用しない
  - デプロイ前にブラウザごとの `feature:*` キーを削除する手順を用意
- **パイロット（staging）**:
  - 特定端末だけ先行トライアルをする目的で override を使用しても良い
  - どの端末で何を ON にしているか、表にして管理する

---

## 3. Phase 1 必須カラム表（データモデル）

### 3.1 Users_Master（利用者マスタ）

#### 🟥 Phase 1 必須（null NG）

| Domain 名 | SP 内部名 | 説明 |
|-----------|-----------|------|
| userId | UserID | 利用者コード（内部一意） |
| fullName | FullName | 利用者氏名 |
| isActive | IsActive | 利用中フラグ |
| attendanceDays | AttendanceDays | 通所曜日 |
| isSupportProcedureTarget | IsSupportProcedureTarget | 支援記録対象フラグ |
| isHighIntensitySupportTarget | IsHighIntensitySupportTarget | 重度加算対象フラグ（色分け・集計） |

#### 🟦 Phase 2（あれば良い）

| Domain 名 | SP 内部名 | 説明 |
|-----------|-----------|------|
| severeFlag | severeFlag | 重症度フラグ（UI 強調用） |
| transportToDays | TransportToDays | 送迎（往路） |
| transportFromDays | TransportFromDays | 送迎（復路） |

#### 🟩 Phase 3（請求・支給決定）

| Domain 名 | SP 内部名 |
|-----------|-----------|
| RecipientCertNumber | RecipientCertNumber |
| RecipientCertExpiry | RecipientCertExpiry |
| GrantMunicipality | GrantMunicipality |
| GrantPeriodStart | GrantPeriodStart |
| GrantPeriodEnd | GrantPeriodEnd |
| DisabilitySupportLevel | DisabilitySupportLevel |
| GrantedDaysPerMonth | GrantedDaysPerMonth |
| UserCopayLimit | UserCopayLimit |
| TransportAdditionType | TransportAdditionType |
| MealAddition | MealAddition |
| CopayPaymentMethod | CopayPaymentMethod |

---

### 3.2 Staff_Master（職員マスタ）

#### 🟥 Phase 1 必須（Staff）

| Domain 名 | SP 内部名 |
|-----------|-----------|
| staffId | StaffID |
| fullName | FullName |
| isActive | IsActive |
| rbacRole / role | RBACRole / Role |

#### 🟦 Phase 2（Staff）

| Domain 名 | SP 内部名 |
|-----------|-----------|
| department | Department |
| employmentType | EmploymentType |
| workDays | WorkDays |

#### 🟩 Phase 3（Staff）

| Domain 名 | SP 内部名 |
|-----------|-----------|
| baseShiftStartTime | BaseShiftStartTime |
| baseShiftEndTime | BaseShiftEndTime |
| baseWorkingDays | BaseWorkingDays |

---

### 3.3 Schedules（スケジュールリスト）

`FIELD_MAP.Schedules` および `SCHEDULE_FIELD_*` に基づく。

#### 🟥 Phase 1 必須（Schedules）

| Domain 名 | SP 内部名 | 説明 |
|-----------|-----------|------|
| title | Title | 予定タイトル |
| start | StartDateTime / EventDate | 開始日時 |
| end | EndDateTime / EndDate | 終了日時 |
| status | Status | ステータス（確定/案など） |
| serviceType | ServiceType | サービス区分 |
| category (personType) | cr014_personType | User / Staff / Org |
| personId / targetUserIds | cr014_personId / TargetUserId | 対象者 or 利用者 ID |
| assignedStaffId | AssignedStaffId | 担当職員 ID |
| rowKey | RowKey | 内部一意キー |
| dayKey | cr014_dayKey | 日単位キー |
| monthKey | MonthKey | 月単位キー |
| fiscalYear | cr014_fiscalYear | 年度 |
| orgAudience | cr014_orgAudience | 対象組織（必要に応じて） |

#### 🟦 Phase 2（Schedules / 分析・加算）

| Domain 名 | SP 内部名 |
|-----------|-----------|
| billingFlags | BillingFlags |
| relatedResourceIds | RelatedResourceId |
| externalOrgName | ExternalOrgName |
| externalPersonName | cr014_externalPersonName |
| dayPart | cr014_dayPart |

#### 🟩 Phase 3（Schedules / 監査・外部連携）

| Domain 名 | SP 内部名 |
|-----------|-----------|
| entryHash | EntryHash |
| createdAt | CreatedAt |
| updatedAt | UpdatedAt |
| staffNames | cr014_staffNames |
| assignedStaff | AssignedStaff |

---

### 3.4 Daily（生活記録）

#### 🟥 Phase 1 必須（Daily）

| Domain 名 | SP 内部名 | 説明 |
|-----------|-----------|------|
| date | Date | 実施日 |
| staffId | StaffIdId | 職員 LookupId |
| userId | UserIdId | 利用者 LookupId |
| status | Status | 記録ステータス（ドラフト/確定） |

#### 🟦 Phase 2（Daily）

| Domain 名 | SP 内部名 |
|-----------|-----------|
| notes | Notes |
| mealLog | MealLog |
| behaviorLog | BehaviorLog |

---

## 4. SharePoint リスト設計／チェックリスト

### 4.1 リスト一覧

| ListKeys | リスト名 |
|----------|----------|
| UsersMaster | Users_Master |
| StaffMaster | Staff_Master |
| ComplianceCheckRules | Compliance_CheckRules |
| Behaviors | Dat_Behaviors |
| SurveyTokusei | FormsResponses_Tokusei |
| OrgMaster | Org_Master |

### 4.2 導入時チェック項目

1. **内部名一致確認**
   - `fields.ts` の `FIELD_MAP` / `SCHEDULE_FIELD_*` と実リストの内部名を照合
   - 特に `StartDateTime` vs `EventDate`, `AssignedStaffId`, `TargetUserId` に注意
2. **最小フィールドセットでの動作確認**
   - `SCHEDULES_MINIMAL_FIELDS`（`Id`, `Title`, `Created`, `Modified`, `@odata.etag`）でクエリできること
   - localhost では MINIMAL、staging/prod では BASE を取得する仕様
3. **Lookup 設定の確認**
   - `StaffIdId`, `UserIdId` が正しく LookupId を持つ設定になっているか
   - 参照元リストが `Staff_Master` / `Users_Master` であること

---

## 5. 今後のタスク一覧（実行チェックリスト）

- 本ドキュメントを `docs/design/schedules-rollout.md` としてコミット
- 各フェーズの `env.runtime.{dev,staging,prod}.json` を作成し、Feature Flag 設定を反映
- SharePoint リスト設計書（内部名 vs 表示名）を整備し、`fields.ts` と差異がないか確認
- Users / Staff / Schedules / Daily の Phase 1 必須カラムが埋まった seed データを投入
- `/schedules/week` のパイロット運用（staging）を開始し、フィードバックを収集
- Phase 2/3 への移行タイミングと条件（バグ件数・現場評価など）を決定

---

## 6. まとめ

- Phase 1 のゴールは、「週表示スケジュールを安定して閲覧できる状態」と「Daily と整合する最低限のキー（人 × 日 × サービス）が埋まっている状態」。
- 上記のフラグ・カラム・リスト設計を守ることで、「動くけれど仕様が謎」という状態を避け、実運用後の拡張（請求・Golden Thread・監査）にスムーズに進める。
