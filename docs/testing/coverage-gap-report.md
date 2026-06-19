# Test Coverage Gap Analysis (Baseline)

日付: 2026-06-11
対象領域: SharePoint 関連・ドメイン周辺のテスト欠損棚卸し

## 1. 前提
- `spec` / `test` ファイルを `src` と `tests` 配下で全探索
- `docs-only` / `test-only` 小PR運用を前提に、まずは「未テスト候補」を高・中・低に分けて列挙
- ここでの「未テスト」は**厳密な網羅率計算ではなく、実行可能候補化のための高信頼推定**

## 2. 収集結果（サマリ）
- 総 `spec` / `test` 件数（探索時点）: 1,277
- 検索対象の主カテゴリ別（src側ファイル/テスト名一致推定）
  - Domain: 131中 63 が未テスト推定
  - SharePoint: 143中 98 が未テスト推定
  - Mapper: 49中 20 が未テスト推定
  - Validation: 46中 22 が未テスト推定
  - AI Safety: 3中 1 が未テスト推定
  - Billing: 7中 4 が未テスト推定

## 3. 根拠ファイル（カテゴリ別抜粋）

### SharePoint
- `src/sharepoint/**`
- `src/features/*/sharepoint/**`
- `src/features/*/sp/**`
- `src/infra/sharepoint/**`
- `src/features/diagnostics/drift/**`

代表的な既存テスト
- `src/sharepoint/__tests__/driftProbeRegistry.spec.ts`
- `src/sharepoint/__tests__/supportCaseDiagnosticsPreflight.spec.ts`
- `src/sharepoint/fields/__tests__/*`
- `src/features/daily/repositories/sharepoint/__tests__/DailyRecordSchemaDrift.spec.ts`
- `src/infra/sharepoint/repos/__tests__/SharePointAbcRecordRepository.spec.ts`
- `src/features/diagnostics/drift/infra/__tests__/SharePointDriftEventRepository.spec.ts`

### Mapper
- `src/domain/**/*Mapper*.ts`
- `src/features/**/*Mapper*.ts`
- `src/features/**/*Map*.ts`
- `src/sharepoint/**/*Mapper*.ts`

代表的な既存テスト
- `src/domain/supportCase/__tests__/sharePointMapper.spec.ts`
- `src/domain/today/__tests__/planPatchToTodayActionMapper.spec.ts`
- `src/features/daily/domain/__tests__/dailyTableMapper.spec.ts`
- `src/features/meeting-minutes/sp/__tests__/mapItemToMinutes.spec.ts`
- `src/sharepoint/__tests__/ispGoalMapper.spec.ts`
- `src/features/` 配下に `Map` 系実装とテストを横断的に確認

### Validation
- `schema`, `contract`, `guard`, `validate` 系の実装

代表的な既存テスト
- `tests/unit/env.coercion.spec.ts`
- `tests/unit/env.coercion.more.spec.ts`
- `src/lib/sp/__tests__/spListSchema.cooldown.spec.ts`
- `src/lib/sp/__tests__/spListSchema.fields-cache.spec.ts`
- `tests/unit/contract.spec.ts`
- `tests/unit/service-provision/schema.spec.ts`

### Billing
- `src/features/billing/**`
- `src/sharepoint/fields/**billing*`

代表的な既存テスト
- `src/features/billing/__tests__/repositoryFactory.spec.ts`
- `src/features/billing/domain/__tests__/billingLogic.spec.ts`
- `src/features/billing/hooks/__tests__/useBillingSummary.spec.ts`
- `src/features/billing/infra/__tests__/DataProviderBillingOrderRepository.spec.ts`

## 4. ドキュメント化対象（次の1セット）
- `docs/testing/coverage-gap-report.md`（本資料）
- `docs/testing/missing-test-candidates.md`（未テスト候補）
- `docs/testing/recommended-test-prs.md`（test-only PR候補）
- `docs/testing/index.md` へ横断リンク追記

## 5. 直近8時間での実行可能アクション
- `Coverage -> Candidate`: 各カテゴリで「未テスト推定」を `docs/testing/missing-test-candidates.md` に昇格
- `Candidate -> PR`: テスト追加/改善を `docs/testing/recommended-test-prs.md` の順で小PR化
- `PR -> 実行`: まず `Billing` と `AI Safety` から開始（影響範囲が限定的なため）


