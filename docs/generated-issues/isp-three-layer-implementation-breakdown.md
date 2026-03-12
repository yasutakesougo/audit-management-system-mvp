# ISP 三層モデル実装 — GitHub Issue 分解

> ADR-005 に基づく段階的実装。各 Issue は独立してマージ可能。

---

## Issue 1: docs — ADR と要件定義に三層原則を明文化する

**Labels**: `documentation`, `architecture`

### 概要
ISP / 支援計画シート / 支援手順記録の三層原則を、AIエージェント・開発者の双方が参照する設計ルールとして明文化する。

### 完了条件
- [x] `docs/adr/ADR-005-isp-three-layer-separation.md` 作成済み
- [x] `docs/ai-isp-three-layer-protocol.md` 作成済み
- [x] `docs/specs/support-plan-three-layer-requirements.md` 作成済み
- [x] `docs/sharepoint/support-plan-three-layer-lists.md` 作成済み
- [ ] README.md にドキュメントへのリンク追加

---

## Issue 2: feat(domain) — support plan 3-layer schema と型定義を追加する

**Labels**: `enhancement`, `domain`

### 概要
三層モデルのドメイン型（types.ts）と Zod バリデーションスキーマ（schema.ts）を `src/domain/isp/` に追加する。

### 対象ファイル
- [x] `src/domain/isp/types.ts` — 制度モデル寄りの型定義（作成済み）
- [x] `src/domain/isp/schema.ts` — Zod スキーマ + SP行パース + フォームバリデーション（作成済み）
- [ ] `src/domain/isp/index.ts` — barrel export
- [ ] `src/domain/isp/__tests__/schema.spec.ts` — スキーマのユニットテスト

### 完了条件
- [x] `tsc --noEmit` エラーなし
- [ ] barrel export 作成
- [ ] 状態遷移ガードのテスト
- [ ] Zod パーススキーマのテスト（正常系 + 異常系）

---

## Issue 3: feat(data) — SharePoint repository ports を追加する

**Labels**: `enhancement`, `data-layer`

### 概要
ISP / 支援計画シート / 支援手順記録の3リストに対する Repository Port と SharePoint Adapter を追加する。

### 対象ファイル
- [ ] `src/domain/isp/ports.ts` — Repository Port インターフェース
- [ ] `src/infra/sharepoint/repos/ispRepo.ts` — ISP_Master
- [ ] `src/infra/sharepoint/repos/planningSheetRepo.ts` — SupportPlanningSheet_Master
- [ ] `src/infra/sharepoint/repos/procedureRecordRepo.ts` — SupportProcedureRecord_Daily
- [ ] `src/sharepoint/fields/ispMasterFields.ts` — SP フィールド定義
- [ ] `src/sharepoint/fields/planningSheetFields.ts` — SP フィールド定義
- [ ] `src/sharepoint/fields/procedureRecordFields.ts` — SP フィールド定義

### 完了条件
- [ ] Ports & Adapters パターン準拠
- [ ] 既存 `supportPlanFields.ts` との互換性維持
- [ ] Zod スキーマによる SP 行パース
- [ ] テスト（mock SP レスポンスでのパース検証）

### 依存
- Issue 2 のスキーマが必要

---

## Issue 4: feat(ui) — 既存支援記録UIの三層責務マッピングを棚卸しする

**Labels**: `enhancement`, `ui`, `investigation`

### 概要
既存の支援記録系画面を三層モデルの各層にマッピングし、今後の UI 再配置計画を策定する。

### 対象画面

| 画面 | 現状の層 | 是正 |
|---|---|---|
| `SupportPlanGuidePage` | 第1層（ISP作成） | ✅ そのまま |
| `ISPComparisonEditorPage` | 第1層（ISP比較） | ✅ そのまま |
| `TimeFlowSupportRecordPage` | 第3層（時系列記録） | 要: PlanningSheet参照リンク追加 |
| `TimeBasedSupportRecordPage` | 第3層（時間帯別記録） | 要: PlanningSheet参照リンク追加 |
| `SupportRecordPage` | 第3層（19項目記録） | 要: PlanningSheet参照リンク追加 |
| `SupportStepMasterPage` | 第2層（テンプレート） | ✅ そのまま |
| `SupportActivityMasterPage` | 第2層（テンプレート） | ✅ そのまま |

### 完了条件
- [ ] 棚卸し結果を docs に記載
- [ ] 各画面への PlanningSheet 参照リンク追加の見積もり
- [ ] ibdTypes.ts ↔ 三層型の adapter 設計書

---

## 推奨作業順序

```
Issue 1 (docs) ← 完了済み
    ↓
Issue 2 (domain types + schema) ← 大半完了、テスト追加のみ
    ↓
Issue 3 (data layer) ← 次のターゲット
    ↓
Issue 4 (ui mapping) ← 最終
```
