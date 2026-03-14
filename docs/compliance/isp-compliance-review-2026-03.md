# ISP / モニタリング 制度整合レビュー

> **レビュー日**: 2026-03-14
> **レビュー手法**: `/compliance` → `/architect` → `/docs`
> **対象バージョン**: main (2026-03-14 時点)
> **関連 Issue**: Skill Matrix Practice Issue #2

---

## 1. レビュー対象

| # | ファイル / 領域 | チェック観点 |
|---|----------------|-------------|
| A | `supportPlanDeadline.ts` | 期限計算の制度正確性 |
| B | `supportPlanAdapter.ts` | データ永続化の監査証跡 |
| C | `monitoringEvidenceAdapter.ts` | モニタリング記録の完全性 |
| D | ISP 三層型定義 (`domain/isp/types.ts`, `schema.ts`) | 型レベルの監査証跡網羅性 |
| E | ISP Editor / ComplianceTab | ISP 必須項目の UI 網羅性 |
| F | SharePoint 行スキーマ (`IspSpRow` 等) | SP 列と監査要件の対応 |

---

## 2. 評価フレームワーク

障害福祉サービス（生活介護）の制度要件に基づき、以下の 3 観点 × 5 チェック項目で評価する。

### 観点 A: 記録の完全性（誰が・いつ・何を）

| # | チェック項目 | 制度根拠 | 理想状態 | 現状 | 判定 |
|---|-------------|---------|---------|------|:----:|
| A-1 | 作成者の記録 | 指定基準・運営基準 | `createdBy: string (UPN)` が全文書に存在 | ISP 三層型 `AuditTrail.createdBy` ✅（number）<br>ISP schema `baseAuditFieldsSchema.createdBy` ✅（string）<br>`PlanningSheetVersion.createdBy` ✅ | ⚠️ |
| A-2 | 承認者の記録 | サビ管承認の証跡 | `approvedBy: string (UPN)` | ISP 三層型 ❌<br>ISP schema ❌<br>`GuidelineVersion` ✅ optional<br>`PhysicalRestraintRecord` ✅ optional<br>`IndividualSupportStep` ✅ optional | ❌ |
| A-3 | 承認日の記録 | 承認タイムスタンプ | `approvedAt: string (ISO8601)` | ISP 三層型 ❌<br>ISP schema ❌<br>`GuidelineVersion` ✅ optional<br>`PhysicalRestraintRecord` ✅ optional | ❌ |
| A-4 | 最終更新者 | 改訂記録 | `changedBy: string (UPN)` | ISP 三層型 `AuditTrail.updatedBy` ✅（number）<br>ISP schema `baseAuditFieldsSchema.updatedBy` ✅（string）<br>`VersionHistoryEntry.changedBy` ✅ | ⚠️ |
| A-5 | 最終更新日 | 改訂記録 | `updatedAt: string (ISO8601)` | ISP 三層型 `AuditTrail.updatedAt` ✅<br>ISP schema `baseAuditFieldsSchema.updatedAt` ✅<br>SharePoint `Modified` ✅ | ✅ |

**凡例**: ✅ = 合格 / ⚠️ = 部分的（改善推奨） / ❌ = 未実装（要対応）

### 観点 B: 周期管理（期限遵守）

| # | チェック項目 | 制度根拠 | 理想状態 | 現状 | 判定 |
|---|-------------|---------|---------|------|:----:|
| B-1 | ISP 作成期限 | 利用開始後30日以内 | 計画開始 + 30日 → 警告 | `supportPlanDeadline.ts` L59-68: ✅ `start + 30日`、7日前 warning、超過 error | ✅ |
| B-2 | モニタリング周期 | 6か月以内 | 直近モニタ + 6か月 → 警告 | `supportPlanDeadline.ts` L70-80: ✅ `lastMon + 6か月`、14日前 warning、超過 error | ✅ |
| B-3 | 計画見直し周期 | 6か月 | `reviewCycleDays: 180` | `ispReviewControlSchema` L169: ✅ `default(180)` | ✅ |
| B-4 | 期限超過時の計画終了日クランプ | 計画期間内に制限 | `min(nextMonitoring, endDate)` | `supportPlanDeadline.ts` L73: ✅ `if (end < monitoring) monitoring = end` | ✅ |
| B-5 | 期限警告の UI 表示 | 現場への通知 | `/today` 等で色分け表示 | `RegulatorySummaryBand.tsx` ✅ Chip 色分け表示<br>`DeadlineInfo.color` ✅ success/warning/error | ✅ |

### 観点 C: 同意・交付の証跡

| # | チェック項目 | 制度根拠 | 理想状態 | 現状 | 判定 |
|---|-------------|---------|---------|------|:----:|
| C-1 | 同意取得日の記録 | 説明・同意義務 | `consentedAt` フィールド | `ispConsentDetailSchema.consentedAt` ✅<br>`useComplianceForm` で missingFields チェック ✅ | ✅ |
| C-2 | 同意者名の記録 | 同意者の特定 | `consentedBy` フィールド | `ispConsentDetailSchema.consentedBy` ✅<br>`useComplianceForm` で missingFields チェック ✅ | ✅ |
| C-3 | 説明実施日の記録 | 重要事項説明 | `explainedAt` フィールド | `ispConsentDetailSchema.explainedAt` ✅ | ✅ |
| C-4 | 交付記録 | 計画交付義務 | `deliveredAt`, `deliveredToUser` | `ispDeliveryDetailSchema` ✅ 交付日・本人交付・相談支援専門員交付 | ✅ |
| C-5 | 代理人情報 | 後見人等の同意 | `proxyName`, `proxyRelation` | `ispConsentDetailSchema.proxyName/proxyRelation` ✅ | ✅ |

---

## 3. 発見事項サマリ

### 🔴 Critical（監査で指摘される可能性が高い）

#### F-1: ISP に `approvedBy` / `approvedAt` が存在しない

**影響**: 個別支援計画はサービス管理責任者（サビ管）の承認が制度上必須。
現在の型定義・スキーマに承認者/承認日のフィールドがない。

**現状の回避策**: PrintView に署名欄（サビ管・管理者）が存在するが、電子的な記録がない。

**所在**:
- `src/domain/isp/types.ts` — `AuditTrail` interface に `approvedBy` / `approvedAt` がない
- `src/domain/isp/schema.ts` — `baseAuditFieldsSchema` に同上
- `src/domain/isp/schema.ts` — `individualSupportPlanSchema` に同上
- SharePoint `IspSpRow` — `ApprovedBy` / `ApprovedAt` 列がない

**対比**: 安全ドメインの `GuidelineVersion` や `PhysicalRestraintRecord` には `approvedBy` / `approvedAt` が既に optional で定義されている。ISP だけが欠落している。

**推奨対応**: P1（高優先度）
1. `AuditTrail` に `approvedBy?: number` / `approvedAt?: string` を追加
2. `baseAuditFieldsSchema` に optional フィールド追加
3. `individualSupportPlanSchema` / `supportPlanningSheetSchema` に追加
4. `IspSpRow` / `PlanningSheetSpRow` に `ApprovedBy` / `ApprovedAt` 列追加
5. ISP Editor UI に承認ワークフローの導線を追加（将来 Issue）

---

### 🟡 Warning（改善推奨・将来リスク）

#### F-2: `createdBy` の型が `number` と `string` で不統一

**影響**: `AuditTrail.createdBy` は `number`（SharePoint LookupId想定）、`baseAuditFieldsSchema.createdBy` は `string`。  
型の不一致はマッパー層でのバグリスクを生む。

**所在**:
- `src/domain/isp/types.ts` L22: `createdBy: number`
- `src/domain/isp/schema.ts` L35: `createdBy: z.string().min(1)`

**推奨対応**: P2（中優先度）
- `AuditTrail` を `string` に統一（UPN ベース）
- SharePoint LookupId は別途 `createdByLookupId?: number` として保持
- Handoff モジュールの `changedBy` リファクタリング（会話 ac3e5b38 参照）と同様のパターンを適用

#### F-3: モニタリング Evidence に作成者・承認者の証跡がない

**影響**: `monitoringEvidenceAdapter.ts` は日次記録を集約するが、誰がモニタリング会議を実施し、誰がレビューしたかの記録がない。

**現状**: `buildMonitoringEvidence()` は `userId` と `range` のみ受け取り、`performedBy` や `reviewedBy` を返さない。

**推奨対応**: P2（中優先度）
- `MonitoringEvidence` に `performedBy: string` / `reviewedAt: string` を追加
- 将来のモニタリング会議記録と紐づける

#### F-4: `supportPlanAdapter.ts` が localStorage 依存

**影響**: ISP のヒント情報が localStorage に保存されており、デバイス間で共有できない。
監査時に「どのデバイスで作成したか」が追跡不能。

**現状**: `getSupportPlanSourceInfo()` が `type: 'localStorage'` を返す。コメントに「将来 SharePoint/API に移行」と記載あり。

**推奨対応**: P3（低優先度 — 将来マイグレーションで解決予定）
- SharePoint への移行計画を Issue として明文化
- 移行時に `createdBy` / `createdAt` を自動付与するよう設計

#### F-5: PrintView の署名欄が電子的に紐づいていない

**影響**: `supportPlanPrintView.ts` に署名欄（本人・家族・サビ管・管理者）があるが、署名状態はシステムに記録されない。紙ベースの運用は現場で成立するが、電子化推進の観点では課題。

**推奨対応**: P3（低優先度）
- 電子署名の導入は事業所の段階的な DX 推進として計画
- 現時点では紙の署名 + スキャン保存で制度要件は充足可能

---

### ✅ 健全（制度要件を満たしている）

| 項目 | 評価 |
|------|------|
| ISP 作成期限計算（30日ルール） | ✅ 正確 |
| モニタリング周期計算（6か月ルール） | ✅ 正確・計画終了日クランプ付き |
| 見直し周期デフォルト（180日） | ✅ 制度準拠 |
| 同意・交付の UI / バリデーション | ✅ `ComplianceTab` + `useComplianceForm` で網羅 |
| 期限警告の色分け表示 | ✅ success / warning / error の 3 段階 |
| ISP 三層モデルの型安全性 | ✅ Zod スキーマ + TypeScript 型の二重防御 |
| ISP ステータス遷移の制約 | ✅ `ISP_STATUS_TRANSITIONS` / `ISP_TRANSITIONS` |
| 制度項目スナップショット | ✅ `regulatoryBasisSnapshotSchema` で作成時点を凍結 |
| コンプライアンスメタデータの生活介護対応 | ✅ `ispComplianceMetadataSchema` で一括管理 |

---

## 4. 改善ロードマップ

### Phase 1: 承認フロー基盤（P1 — 次スプリント推奨）

```
Issue: ISP 承認フロー基盤追加
目的: 監査証跡の最小要件を充足する

タスク:
  1. AuditTrail / baseAuditFieldsSchema に approvedBy / approvedAt 追加
  2. ISP / 支援計画シート / 実施記録のスキーマ更新
  3. SharePoint 列定義追加 (ApprovedBy, ApprovedAt)
  4. ISP Editor UI に「サビ管承認」ボタン追加
  5. 承認時にログイン UPN + timestamp を自動記録
  6. テスト追加（型 / バリデーション / 承認遷移）

工数見積: M (1日)
```

### Phase 2: 型統一 + モニタリング証跡（P2 — 次々スプリント）

```
Issue-A: createdBy 型統一 (number → string UPN)
Issue-B: MonitoringEvidence に実施者・レビュー者追加

工数見積: S (半日)
```

### Phase 3: データソース移行 + 電子署名（P3 — 中長期）

```
Issue-A: supportPlanAdapter の SharePoint 移行
Issue-B: 電子署名フロー検討

工数見積: L (複数日 — DX 推進計画に組み込み)
```

---

## 5. 制度根拠一覧

| 制度要件 | 根拠法令・通知 | 本システムでの対応箇所 |
|---------|--------------|---------------------|
| ISP 作成義務 | 障害者総合支援法 第58条 / 指定基準 | `ispFormSchema` / ISP Editor |
| 30日以内の作成 | 指定基準 第58条第2項 | `supportPlanDeadline.ts` L59 |
| 6か月モニタリング | 指定基準 | `supportPlanDeadline.ts` L70 |
| 説明・同意・交付 | 指定基準 第3条 | `EditableComplianceSection.tsx` |
| サビ管の関与 | 指定基準 第58条 | ⚠️ PrintView 署名欄のみ |
| 記録の保存 | 指定基準 第39条 | SharePoint + localStorage |

---

## 6. 結論

### 総合評価: **B**（概ね制度要件を満たすが、承認フローの電子的記録が未整備）

**強い点**:
- 期限計算ロジックが制度要件に正確に対応
- 同意・交付の記録 UI が充実（コンプライアンスタブ）
- ISP 三層モデルが型安全に設計されている
- 見直し周期・ステータス遷移が制度に準拠

**要改善点**:
- `approvedBy` / `approvedAt` の ISP への追加が最優先
- `createdBy` の型統一が中期的に必要
- モニタリング会議の実施者証跡が不足

> [!IMPORTANT]
> **最も重要な改善**: ISP に `approvedBy` / `approvedAt` を追加すること。
> これは現場運用では紙の署名で回避しているが、監査時に電子的な証跡がないと
> 指摘される可能性がある。Phase 1 として次スプリントで対応を推奨。
