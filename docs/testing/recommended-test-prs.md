# Recommended test-only PR candidates

## 方針
- 小さく安全に回すため、1 PR は単一責務
- まず検知価値が高い箇所から着手し、失敗時の切り戻しコストを最小化
- ここでは `test-only` を基本とし、必要に応じて docs-only を併記

## PR Candidate 1: Billing Coverage - Core hooks + repository
- 目標: Billing フローの最小リスク高の未カバー領域を埋める
- docs-only 追加: `docs/testing/missing-test-candidates.md` への更新
- test-only 追加候補:
  - `src/features/billing/hooks/useBillingOrderRepository.spec.ts`（新規）
  - `src/features/billing/infra/InMemoryBillingOrderRepository.spec.ts`（新規）
  - `src/features/billing/useBillingOrders.spec.ts`（新規）
- 期待: `repository / hook / use*` の境界欠損を1セットで補完

## PR Candidate 2: SharePoint Diagnostics Drift + Health
- 目標: Drift 監査境界（data access / drift orchestration）を再現
- test-only 追加候補:
  - `src/features/daily/repositories/sharepoint/modules/IntegrityScanner.spec.ts`（既存は存在するが、補強推奨）
  - `src/features/daily/repositories/sharepoint/activityDiary/modules/DataAccess.spec.ts`（新規）
  - `src/features/daily/repositories/sharepoint/modules/RowAggregateAccess.spec.ts`（新規）
  - `src/features/diagnostics/drift/domain/driftLogic.spec.ts`（新規）
- docs-only 追加: 失敗観測の再現手順追記

## PR Candidate 3: SharePoint Mapper Regression Set
- 目標: SharePoint 由来の Mapper（特に日報/行集約系）を網羅
- test-only 追加候補:
  - `src/features/daily/repositories/sharepoint/activityDiary/modules/Saver.spec.ts`（新規）
  - `src/sharepoint/fields/__tests__/billingFields.spec.ts`（既存補強）
  - `src/domain/today/__tests__/planPatchToTodayActionMapper.spec.ts` の連携ケース追加
- 期待: `map` の境界ズレ（field名差異、欠落値）を単体で検知

## PR Candidate 4: Validation Contract Matrix
- 目標: schema/guard/contract の「成功/失敗対比」テストを追加
- test-only 追加候補:
  - `src/lib/sp/spListSchema.spec.ts`（新規）
  - `src/domain/isp/schema/*` 既存ファイルに対する追加 fixture
  - `src/lib/envGuards.spec.ts`（新規）
- 期待: 設定変更時の不整合を早期検知

## PR Candidate 5: AI Safety + Telemetry Boundary
- 目標: safety 表示・集約の回帰を検知し、AI系の安全監査時点検を安定化
- test-only 追加候補:
  - `src/features/safety/components/SafetyOperationsSummaryCard.spec.tsx`（新規）
  - `src/domain/safety/__tests__` の境界ケースを 1–2 ケース追加
- 期待: 安全関連サマリ表示と監査ログ連鎖の見落とし防止

## 実施順の推奨
1. PR Candidate 1（Billing）
2. PR Candidate 5（AI Safety）
3. PR Candidate 4（Validation）
4. PR Candidate 2（SharePoint Diagnostics）
5. PR Candidate 3（SharePoint Mapper）

## 次アクション
- 各候補をレビュー前提の「1 PR 1 目的」で準備し、`docs/testing/coverage-gap-report.md` と `missing-test-candidates.md` の照合を継続

