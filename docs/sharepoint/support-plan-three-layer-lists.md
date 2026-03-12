# SharePoint リスト設計案: ISP 三層モデル

> **ADR-005 準拠** | 既存 `SupportPlans` リストとの後方互換性を考慮

## 概要

ISP 三層モデルを SharePoint Online 上で実現するためのリスト設計案。
既存の `SupportPlans` リストを第1層に拡張し、第2層・第3層を新規リストとして追加する。

---

## A. `ISP_Master` — 個別支援計画本体

> 既存の `SupportPlans` リストを拡張する形で実装可能

### 列定義

| Internal Name | 表示名 | 型 | 必須 | 備考 |
|---|---|---|---|---|
| `Title` | タイトル | 1行テキスト | ✅ | `{利用者名}_{年度}` |
| `UserCode` | 利用者コード | 1行テキスト | ✅ | `Users_Master.UserID` と対応 |
| `PlanStartDate` | 計画開始日 | 日付 | ✅ | |
| `PlanEndDate` | 計画終了日 | 日付 | ✅ | |
| `UserIntent` | 本人の意向 | 複数行テキスト | ✅ | |
| `FamilyIntent` | 家族の意向 | 複数行テキスト | | |
| `OverallSupportPolicy` | 総合的支援方針 | 複数行テキスト | ✅ | |
| `QolIssues` | QOL向上課題 | 複数行テキスト | | |
| `LongTermGoalsJson` | 長期目標 | 複数行テキスト | ✅ | JSON array |
| `ShortTermGoalsJson` | 短期目標 | 複数行テキスト | ✅ | JSON array |
| `SupportSummary` | 支援内容概要 | 複数行テキスト | | |
| `Precautions` | 留意事項 | 複数行テキスト | | |
| `ConsentAt` | 同意取得日時 | 日付時刻 | | |
| `DeliveredAt` | 交付日時 | 日付時刻 | | |
| `MonitoringSummary` | モニタリング概要 | 複数行テキスト | | |
| `LastMonitoringAt` | 直近モニタリング日 | 日付時刻 | | |
| `NextReviewAt` | 次回見直し予定日 | 日付 | | |
| `Status` | ステータス | 選択肢 | ✅ | `assessment/proposal/meeting/consent_pending/active/monitoring/revision/closed` |
| `VersionNo` | 版番号 | 数値 | ✅ | 初期値: 1 |
| `IsCurrent` | 有効フラグ | はい/いいえ | ✅ | 最新版のみ `true` |
| `FormDataJson` | フォームデータ | 複数行テキスト | | 拡張データ用。既存互換 |

### 既存 `SupportPlans` との対応

| 既存フィールド | ISP_Master | 処理 |
|---|---|---|
| `DraftId` | `—` | ISP_Master は `Id` で一意。DraftId は廃止候補 |
| `UserCode` | `UserCode` | そのまま維持 |
| `DraftName` | `Title` | リネーム or マッピング |
| `FormDataJson` | `FormDataJson` | 後方互換のため残す。段階的に個別列へ移行 |
| `Status` | `Status` | 選択肢の拡張（`draft/confirmed/obsolete` → 9段階） |
| `SchemaVersion` | `VersionNo` | セマンティクス変更 |

---

## B. `SupportPlanningSheet_Master` — 支援計画シート本体

### 列定義

| Internal Name | 表示名 | 型 | 必須 | 備考 |
|---|---|---|---|---|
| `Title` | タイトル | 1行テキスト | ✅ | `{利用者名}_{場面}_{版番号}` |
| `UserCode` | 利用者コード | 1行テキスト | ✅ | |
| `ISPLookupId` | 紐づくISP | 参照 (ISP_Master) | ✅ | Lookup 列 |
| `TargetScene` | 対象場面 | 1行テキスト | | 例: "食事", "来所時" |
| `TargetDomain` | 対象領域 | 1行テキスト | | 例: "コミュニケーション" |
| `ObservationFacts` | 行動観察 | 複数行テキスト | ✅ | |
| `CollectedInformation` | 情報収集 | 複数行テキスト | | |
| `InterpretationHypothesis` | 分析・仮説 | 複数行テキスト | ✅ | |
| `SupportIssues` | 支援課題 | 複数行テキスト | ✅ | |
| `SupportPolicy` | 対応方針 | 複数行テキスト | ✅ | |
| `EnvironmentalAdjustments` | 環境調整 | 複数行テキスト | | |
| `ConcreteApproaches` | 関わり方の具体策 | 複数行テキスト | ✅ | |
| `AppliedFrom` | 適用開始日 | 日付 | | |
| `NextReviewAt` | 次回見直し予定日 | 日付 | | |
| `Status` | ステータス | 選択肢 | ✅ | `draft/review/active/revision_pending/archived` |
| `VersionNo` | 版番号 | 数値 | ✅ | 初期値: 1 |
| `IsCurrent` | 有効フラグ | はい/いいえ | ✅ | |
| `FormDataJson` | 拡張データ | 複数行テキスト | | ibdTypes フィールドとの互換用 |

### ibdTypes.ts との対応

| ibdTypes フィールド | SP 列 | 備考 |
|---|---|---|
| `SupportPlanSheet.icebergModel.observableBehaviors` | `ObservationFacts` | |
| `SupportPlanSheet.icebergModel.underlyingFactors` | `CollectedInformation` | |
| `SupportPlanSheet.icebergModel.environmentalAdjustments` | `EnvironmentalAdjustments` | |
| `SupportPlanSheet.positiveConditions` | `SupportIssues` | セマンティクス拡張 |
| `SupportPlanSheet.version` | `VersionNo` | 数値化 |
| `SupportPlanSheet.status` | `Status` | 選択肢拡張 |
| `SupportPlanSheet.nextReviewDueDate` | `NextReviewAt` | |
| `SupportPlanSheet.confirmedBy` | SP の `Modified By` | |

---

## C. `SupportProcedureRecord_Daily` — 支援手順書兼記録

### 列定義

| Internal Name | 表示名 | 型 | 必須 | 備考 |
|---|---|---|---|---|
| `Title` | タイトル | 1行テキスト | ✅ | `{利用者名}_{日付}_{時間帯}` |
| `UserCode` | 利用者コード | 1行テキスト | ✅ | |
| `ISPLookupId` | 紐づくISP | 参照 (ISP_Master) | | 間接参照（PlanningSheet 経由も可） |
| `PlanningSheetLookupId` | 紐づく支援計画シート | 参照 (SupportPlanningSheet_Master) | ✅ | |
| `RecordDate` | 記録日 | 日付 | ✅ | |
| `TimeSlot` | 時間帯 | 1行テキスト | | 例: "09:30-10:00" |
| `Activity` | 活動名 | 1行テキスト | | |
| `ProcedureText` | 支援手順 | 複数行テキスト | ✅ | |
| `ExecutionStatus` | 実施ステータス | 選択肢 | ✅ | `planned/done/skipped/partially_done` |
| `UserResponse` | 利用者の様子 | 複数行テキスト | | |
| `SpecialNotes` | 特記事項 | 複数行テキスト | | |
| `HandoffNotes` | 連絡事項 | 複数行テキスト | | |
| `PerformedBy` | 実施者 | 1行テキスト | ✅ | |
| `PerformedAt` | 実施日時 | 日付時刻 | ✅ | |

---

## D. `ISP_Monitoring_Log` — モニタリング履歴（補助リスト）

| Internal Name | 表示名 | 型 | 必須 | 備考 |
|---|---|---|---|---|
| `Title` | タイトル | 1行テキスト | ✅ | |
| `ISPLookupId` | 紐づくISP | 参照 (ISP_Master) | ✅ | |
| `UserCode` | 利用者コード | 1行テキスト | ✅ | |
| `MonitoringDate` | モニタリング実施日 | 日付 | ✅ | |
| `InterviewedWith` | 面談相手 | 1行テキスト | | |
| `MonitoringSummary` | モニタリング内容 | 複数行テキスト | ✅ | |
| `GoalProgressJson` | 目標達成状況 | 複数行テキスト | | JSON |
| `IssuesFound` | 発見された課題 | 複数行テキスト | | |
| `NeedRevision` | 計画見直し要否 | はい/いいえ | ✅ | |
| `NextAction` | 次のアクション | 複数行テキスト | | |

---

## E. `SupportPlanningSheet_Revision_Log` — 支援計画シート改訂履歴（補助リスト）

| Internal Name | 表示名 | 型 | 必須 | 備考 |
|---|---|---|---|---|
| `Title` | タイトル | 1行テキスト | ✅ | |
| `PlanningSheetLookupId` | 紐づく支援計画シート | 参照 | ✅ | |
| `OldVersionNo` | 旧版番号 | 数値 | ✅ | |
| `NewVersionNo` | 新版番号 | 数値 | ✅ | |
| `RevisionReason` | 改訂理由 | 複数行テキスト | ✅ | |
| `ChangedPoints` | 変更点 | 複数行テキスト | ✅ | |
| `ReviewedBy` | レビュー者 | 1行テキスト | | |
| `ReviewedAt` | レビュー日時 | 日付時刻 | | |

---

## リスト間リレーション

```
ISP_Master (1)
 ├─ (N) SupportPlanningSheet_Master
 │    └─ (N) SupportProcedureRecord_Daily
 ├─ (N) ISP_Monitoring_Log
 └─ (N) PlanGoals（既存リスト）

SupportPlanningSheet_Master (1)
 └─ (N) SupportPlanningSheet_Revision_Log
```

## 既存リストとの共存

| 既存リスト | 状態 | 方針 |
|---|---|---|
| `SupportPlans` | 運用中 | 段階的に `ISP_Master` へ移行。移行期間中は `FormDataJson` で互換維持 |
| `PlanGoals` | 運用中 | ISP_Master の目標管理として継続利用 |
| `Users_Master` | 運用中 | `UserCode` で全リストと接続 |

## 移行戦略

1. **Phase 1**: `ISP_Master` を新設し、`SupportPlans` のデータをコピー（`FormDataJson` 方式で後方互換）
2. **Phase 2**: `SupportPlanningSheet_Master` を新設し、ibdTypes ベースのデータを移行
3. **Phase 3**: `SupportProcedureRecord_Daily` を新設し、既存の日次記録と接続
4. **Phase 4**: 補助リスト（Monitoring Log, Revision Log）を追加
5. **Phase 5**: `SupportPlans` から `ISP_Master` への完全移行
