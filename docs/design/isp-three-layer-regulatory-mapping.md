# ISP 三層モデル — 制度要件込み UI・ドメイン棚卸し

> Issue 4-1: 加算・減算・監査要件を反映した三層モデルの再定義と実装ロードマップ  
> 日付: 2026-03-12

---

## 1. 制度要件を踏まえた三層の再定義

### 旧理解（Issue 1〜3 時点）

> 支援計画シート＝現場支援を具体化する文書

### 新理解（追加要件後）

> 支援計画シート＝現場支援の具体化文書 **かつ** 加算算定・減算回避・連携評価・監査説明の根拠文書

| 層 | 文書 | 制度上の役割 |
|---|---|---|
| 第1層 | ISP | 法定上位計画・同意・モニタリング・見直し |
| 第2層 | 支援計画シート | **加算根拠** / **減算回避** / **連携** / 専門支援設計 |
| 第3層 | 支援手順書兼記録 | **日々の実施証跡** / 未作成減算回避 / 再アセスメント根拠 |

### 関連制度

| 制度 | 影響 | 対象文書 |
|---|---|---|
| **重度障害者支援加算** | 生活介護等で加算算定 | 第2層 |
| **行動援護 未作成減算** | 95/100減算 | 第2層（未作成で発動） |
| **行動障害支援連携加算** | 連携対象文書 | 第2層＋第3層 |

---

## 2. 既存フィールド GAP 分析

### 2-1. Users_Master（利用者）

| 制度要件フィールド | 既存フィールド | 状態 |
|---|---|---|
| 障害支援区分 | `DisabilitySupportLevel` | ✅ 存在 |
| 重度支援対象 | `IsHighIntensitySupportTarget` | ✅ 存在 |
| 支援手順記録対象 | `IsSupportProcedureTarget` | ✅ 存在 |
| 重度フラグ | `severeFlag` | ✅ 存在 |
| 行動関連項目合計点 | — | ❌ **要追加**: `BehaviorScore` |
| 児童行動基準スコア | — | ❌ **要追加**: `ChildBehaviorScore` |
| 強度行動障害該当フラグ | — | ❌ **要追加**: `SevereBehaviorSupportEligible` |
| 判定基準日 | — | ❌ **要追加**: `EligibilityCheckedAt` |
| 対象サービス一覧 | — | ❌ **要追加**: `ServiceTypesJson` |

### 2-2. Staff_Master（職員）

| 制度要件フィールド | 既存フィールド | 状態 |
|---|---|---|
| 資格情報（汎用） | `Certifications` | ⚠️ 存在するが構造未定義 |
| 実践研修修了 | — | ❌ **要追加**: `HasPracticalTraining` |
| 基礎研修修了 | — | ❌ **要追加**: `HasBasicTraining` |
| 行動援護従業者養成研修修了 | — | ❌ **要追加**: `HasBehaviorGuidanceTraining` |
| 中核的人材養成研修修了 | — | ❌ **要追加**: `HasCorePersonTraining` |
| 修了日 | — | ❌ **要追加**: `TrainingCompletionDate` |
| 資格確認日 | — | ❌ **要追加**: `CertificationCheckedAt` |

### 2-3. 支援計画シート（第2層）

| 制度要件フィールド | 既存フィールド | 状態 |
|---|---|---|
| userId | `UserCode` | ✅ |
| ispId | `ISPId` / `ISPLookupId` | ✅ |
| 作成者 | — | ❌ **要追加**: `AuthoredByStaffId` |
| 作成者資格 | — | ❌ **要追加**: `AuthoredByQualification` |
| 作成日 | `Created` | ✅ |
| 対象サービス種別 | — | ❌ **要追加**: `ApplicableServiceType` |
| 対象加算種別 | — | ❌ **要追加**: `ApplicableAddOnType` |
| 利用者交付日 | — | ❌ **要追加**: `DeliveredToUserAt` |
| 関係機関連携記録JSON | — | ❌ **要追加**: `LinkedAgenciesJson` |
| 見直し実施日 | — | ❌ **要追加**: `ReviewedAt` |
| 見直し予定日 | `NextReviewAt` | ✅ |
| 版番号 | `VersionNo` | ✅ |
| 現行版フラグ | `IsCurrent` | ✅ |
| 適用開始日 | `AppliedFrom` | ✅ |
| 状態 | `Status` | ✅ |

### 2-4. 支援手順書兼記録（第3層）

| 制度要件フィールド | 既存フィールド | 状態 |
|---|---|---|
| 根拠支援計画シートID | `PlanningSheetId` | ✅ |
| 実施者 | `PerformedBy` | ✅ |
| 実施者資格 | — | ❌ **要追加**: `PerformedByQualification` |
| 実施者サービス種別 | — | ❌ **要追加**: `ServiceType` |
| 実施日 | `RecordDate` | ✅ |
| 実施ステータス | `ExecutionStatus` | ✅ |
| フィードバック要否 | — | ❌ **要追加**: `FeedbackRequired` |
| フィードバック完了日 | — | ❌ **要追加**: `FeedbackCompletedAt` |
| インシデント関連 | — | ❌ **要追加**: `IncidentRelated` |

---

## 3. 追加フィールド一覧（新設が必要なもの）

### Users_Master 追加（5フィールド）

```
BehaviorScore         : Number   行動関連項目合計点
ChildBehaviorScore    : Number   児童行動基準点数
SevereBehaviorEligible: Boolean  強度行動障害該当
EligibilityCheckedAt  : DateTime 判定基準日
ServiceTypesJson      : Note     対象サービスJSON
```

### Staff_Master 追加（6フィールド）

```
HasPracticalTraining      : Boolean  実践研修修了
HasBasicTraining          : Boolean  基礎研修修了
HasBehaviorGuidanceTraining: Boolean 行動援護養成研修修了
HasCorePersonTraining     : Boolean  中核的人材研修修了
TrainingCompletionDate    : DateTime 修了日
CertificationCheckedAt    : DateTime 資格確認日
```

### SupportPlanningSheet_Master 追加（6フィールド）

```
AuthoredByStaffId       : Text     作成者スタッフID
AuthoredByQualification : Text     作成者資格区分
ApplicableServiceType   : Choice   対象サービス
ApplicableAddOnType     : Choice   対象加算種別
DeliveredToUserAt       : DateTime 交付日
ReviewedAt              : DateTime 見直し実施日
LinkedAgenciesJson      : Note     連携機関情報JSON
```

### SupportProcedureRecord_Daily 追加（4フィールド）

```
PerformedByQualification: Text     実施者資格
ServiceType             : Choice   サービス種別
FeedbackRequired        : Boolean  フィードバック要否
FeedbackCompletedAt     : DateTime フィードバック完了日
IncidentRelated         : Boolean  インシデント関連
```

---

## 4. 既存画面の責務再配置マッピング

### 現行画面一覧

| パス | 画面名 | 現在の責務 | 三層での位置 |
|---|---|---|---|
| `/support-plan-guide` | SupportPlanGuidePage | ISP 作成・参照 | **第1層** 上位計画ハブ |
| `/isp-editor` | ISPComparisonEditorPage | ISP 比較編集 | **第1層** 版比較 |
| `/isp-editor/:userId` | 同上（利用者指定） | 同上 | **第1層** |
| `/daily-record` | DailyRecordPage | 日々の活動記録 | **第3層候補**（連携対象） |
| `/time-based-record` | TimeBasedSupportRecordPage | 時間軸支援記録 | **第3層** 直接対応 |

### 新設が必要な画面

| パス案 | 画面名 | 責務 | 層 |
|---|---|---|---|
| `/planning-sheet` | 支援計画シート一覧 | 全利用者の現行シート一覧・フィルタ | **第2層** |
| `/planning-sheet/:id` | 支援計画シート詳細 | 観察→仮説→方針→手順の流れ表示 | **第2層** |
| `/planning-sheet/new` | 支援計画シート作成 | 行動観察〜具体策の入力 | **第2層** |
| `/audit/compliance` | 監査コンプライアンス | 未作成減算リスク・見直し期限超過 | **横断** |

### 既存画面の拡張

| 画面 | 追加する要素 |
|---|---|
| SupportPlanGuidePage | 紐づく支援計画シート一覧 / 次回見直し / 対象加算状況 |
| TimeBasedSupportRecordPage | 根拠シートID / 実施者資格 / フィードバック欄 |

---

## 5. 新規ドメイン定義（Issue 4-2 以降）

### A. 加算判定ドメイン (`src/domain/billing/`)

```typescript
interface AddOnEligibility {
  userId: string;
  serviceType: ServiceType;
  addOnType: AddOnType;
  eligible: boolean;
  reason: string;
  checkedAt: string;
  evidence: {
    planningSheetId?: string;
    staffQualification?: string;
    behaviorScore?: number;
  };
}
```

### B. 減算判定ドメイン (`src/domain/billing/`)

```typescript
interface DeductionRisk {
  userId: string;
  serviceType: 'behavior_support';  // 行動援護
  month: string;                     // YYYY-MM
  planningSheetExists: boolean;
  planningSheetQualityAdequate: boolean;
  deductionApplied: boolean;         // 95/100 減算
  deductionRate: number;             // 0.95
  resolvedMonth: string | null;
}
```

### C. 研修資格ドメイン (`src/domain/staff-qualification/`)

```typescript
interface StaffQualification {
  staffId: string;
  hasPracticalTraining: boolean;
  hasBasicTraining: boolean;
  hasBehaviorGuidanceTraining: boolean;
  hasCorePersonTraining: boolean;
  trainingCompletionDate: string | null;
  certificationCheckedAt: string | null;
  meetsAuthoringRequirement: boolean;  // 計算値
}
```

### D. 監査証跡ドメイン（既存 `src/domain/isp/types.ts` を拡張）

既に `AuditTrail`, `ThreeLayerTraceabilityView`, `ISPToRecordPath` 等が定義済み。  
追加で必要なのは「その時点の作成者資格スナップショット」のみ。

---

## 6. 実装ロードマップ（修正版）

### Issue 4-1 ✅ — 制度要件込み棚卸し文書

このドキュメント。

### Issue 4-2 — 支援計画シートに制度項目を追加

| 作業 | 影響範囲 |
|---|---|
| SP フィールド追加 7列 | `ispThreeLayerFields.ts` |
| Zod スキーマ拡張 | `schema.ts` |
| Mapper 拡張 | `mapper.ts` |
| Port / Repository 調整 | 型拡張のみ |
| テスト追加 | schema.spec + mapper.spec |

**推定規模**: 中（schema.ts + mapper.ts + fields の3ファイル修正 + テスト追加）

### Issue 4-3 — 利用者・職員マスタに判定用属性を追加

| 作業 | 影響範囲 |
|---|---|
| Users_Master に5フィールド追加 | `userFields.ts`, `IUserMaster` |
| Staff_Master に6フィールド追加 | `staffFields.ts`, SP型 |
| 研修資格ドメイン型追加 | `src/domain/staff-qualification/` |
| 既存画面への表示追加 | ユーザー詳細/スタッフ管理 |

**推定規模**: 中（マスタは既に構造がある。SP側のリスト列追加は手動 or ensureList）

### Issue 4-4 — 監査・加算判定ビュー追加

| 作業 | 影響範囲 |
|---|---|
| 加算判定ドメイン | `src/domain/billing/` 新設 |
| 減算判定ロジック | 月次判定関数 |
| コンプライアンスダッシュボード | `/audit/compliance` 新設画面 |
| 未作成リスク一覧 | Repository 横断クエリ |

**推定規模**: 大（新ドメイン + 新画面。ただし Repository は Issue 3 で完成済み）

---

## 7. 推奨実装順序

```
Issue 4-1  ✅ この文書
    ↓
Issue 4-2  支援計画シート制度項目追加（schema + fields + mapper 修正）
    ↓
Issue 4-3  マスタ拡張（User 5列 + Staff 6列 + 資格ドメイン）
    ↓
Issue 4-4  監査・加算ダッシュボード（新ドメイン + 新画面）
```

### 判断ポイント

- **4-2 を先にやる理由**: 三層モデルのスキーマが最も深い。先に固めると 4-3, 4-4 で参照できる
- **4-3 は 4-2 と並行可能**: マスタ拡張は独立して進められる
- **4-4 は 4-2 + 4-3 に依存**: 判定ロジックが利用者属性 × シート属性を参照するため
