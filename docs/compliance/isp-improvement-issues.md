# ISP 承認フロー基盤 — 改善 Issue 一覧

> **生成元**: `docs/compliance/isp-compliance-review-2026-03.md`
> **生成日**: 2026-03-14

---

## Issue A: ISP 承認フロー基盤追加（P1）

### 概要

ISP の `approvedBy` / `approvedAt` フィールドが未実装。
障害福祉サービスの制度要件として、サービス管理責任者の承認記録は必須。
現在は印刷時の署名欄でのみ対応しているが、電子的な証跡がない。

### 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/domain/isp/types.ts` | `AuditTrail` に `approvedBy?: number`, `approvedAt?: string` 追加 |
| `src/domain/isp/schema.ts` | `baseAuditFieldsSchema` に optional フィールド追加 |
| `src/domain/isp/schema.ts` | `individualSupportPlanSchema` / `supportPlanningSheetSchema` 更新 |
| `src/domain/isp/schema.ts` | `ispSpRowSchema` / `planningSheetSpRowSchema` に SP 列追加 |
| `src/sharepoint/fields/supportPlanFields.ts` | `ApprovedBy`, `ApprovedAt` 列定義追加 |
| ISP Editor UI (新規) | 「サビ管承認」ボタン + ステータス遷移 |
| テスト | 型 / バリデーション / 承認遷移テスト |

### 受け入れ条件

- [ ] `AuditTrail` に `approvedBy` / `approvedAt` が optional として追加されている
- [ ] ISP スキーマのバリデーションが承認フィールドを通す
- [ ] SharePoint 列定義に `ApprovedBy` / `ApprovedAt` が追加されている
- [ ] ISP Editor に「承認」アクション UI がある
- [ ] 承認時にログインユーザーの UPN と現在時刻が自動記録される
- [ ] 全テスト通過・型チェック通過

### 工数見積: M (1日)
### 優先度: P1（次スプリント）

---

## Issue B: `createdBy` 型統一（P2）

### 概要

`AuditTrail.createdBy` が `number`（SharePoint LookupId）、
`baseAuditFieldsSchema.createdBy` が `string`（UPN 想定）で型不一致。
マッパー層でのバグリスクを解消するため、UPN ベースの `string` に統一する。

### 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/domain/isp/types.ts` | `AuditTrail.createdBy` を `string` に変更 |
| `src/domain/isp/types.ts` | `updatedBy` を `string` に変更 |
| `src/data/isp/sharepoint/mapper.ts` | マッピングロジック更新 |
| 参照先コンポーネント | 型変更に伴う修正 |

### 受け入れ条件

- [ ] `AuditTrail` の `createdBy` / `updatedBy` が `string` に統一
- [ ] SharePoint LookupId は別途 `createdByLookupId?: number` で保持
- [ ] 全テスト通過・型チェック通過

### 工数見積: S (半日)
### 優先度: P2（次々スプリント）

---

## Issue C: モニタリング Evidence 実施者証跡追加（P2）

### 概要

`monitoringEvidenceAdapter.ts` が返す `MonitoringEvidence` に
モニタリング実施者・レビュー者の情報が含まれていない。
監査時に「誰がモニタリングを実施したか」を追跡できない。

### 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/features/ibd/plans/support-plan/monitoringEvidenceAdapter.ts` | `MonitoringEvidence` に `performedBy`, `reviewedAt` 追加 |
| `buildMonitoringEvidence()` | 引数に `performedBy` 追加 |
| 呼び出し元 | 実施者情報の受け渡し |

### 受け入れ条件

- [ ] `MonitoringEvidence` に `performedBy: string` が追加されている
- [ ] `MonitoringEvidence` に `reviewedAt?: string` が追加されている
- [ ] 全テスト通過

### 工数見積: S (半日)
### 優先度: P2（次々スプリント）
