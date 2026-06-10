# Missing test candidates (SharePoint-aligned baseline)

## 1. High Priority（優先）

### H-1. SharePoint Drift / Diagnostics domain
- `src/features/daily/repositories/sharepoint/activityDiary/modules/DataAccess.ts`
- `src/features/daily/repositories/sharepoint/activityDiary/modules/Saver.ts`
- `src/features/daily/repositories/sharepoint/activityDiary/SharePointActivityDiaryRepository.ts`
- `src/features/daily/repositories/sharepoint/modules/RowAggregateAccess.ts`
- `src/features/diagnostics/drift/domain/DriftEventBus.ts`
- `src/features/diagnostics/drift/domain/driftLogic.ts`
- 根拠:
  - SharePoint 操作＋ドリフト監査の境界が厚い
  - 同名テストでの直接照合で `-by-name` では不一致（現時点）

### H-2. Billing
- `src/features/billing/hooks/useBillingOrderRepository.ts`
- `src/features/billing/infra/InMemoryBillingOrderRepository.ts`
- `src/features/billing/useBillingOrders.ts`
- 根拠:
  - 既存テストが薄く、リポジトリ分岐と表示ロジックの連携を持つ
  - フィールド階層が SharePoint 仕様変更に追従しやすい場所

### H-3. Domain core with low discoverability
- `src/domain/behavior/abc.ts`
- `src/domain/isp/dailyBridgeMapper.ts`
- `src/domain/isp/dailyBridge.ts`
- 根拠:
  - 名前ベースのテスト照合で未検出になりやすい
  - `src/domain/isp` は影響範囲が大きく、再現性ある単体テスト追加が必要

## 2. Medium Priority（中優先）

### M-1. AI Safety（UI + ドメイン連携境界)
- `src/features/safety/components/SafetyOperationsSummaryCard.tsx`
- `src/domain/safety/__tests__` 既存テストはあるが、UI表示層との結線を追加する価値あり
- 根拠:
  - 安全性関連のリスクが高く、観測不能領域が残ると監査時の追跡困難

### M-2. SharePoint mapper/validation 補助
- `src/features/planning-sheet/tokuseiFieldMap.ts`
- `src/features/callLogs/data/callLogFieldMap.ts`
- `src/features/users/infra/migration/userBenefitProfileCutover/readMapper.ts`
- `src/features/users/infra/migration/userBenefitProfileCutover/writeMapper.ts`

### M-3. Validation utility drift
- `src/domain/behavior/abc.schema.ts`
- `src/domain/isp/schema/*` 各種
- `src/features/schedules/data/spChildRowSchemas.ts`
- `src/lib/sp/spListSchema.ts`
- 根拠:
  - スキーマの微修正は runtime 側で広域影響しうるため

## 3. Low Priority（低優先）

### L-1. Index / 接続レイヤ
- `src/domain/*/index.ts`
- `src/features/*/index.ts`
- 明示的テスト化は価値が低いが、公開 API 変更時の監査ログとして追跡対象にする

## 4. 除外（今回は対象外）
- `*.spec.ts / *.test.ts` 自体
- 自動生成資産・型定義のみ
- UIの純粋なレイアウト差分のみ（監査対象ではないもの）

## 5. 追加観点
- ここでの未検出は「名前一致で見つからない」ものが混在する。
  - したがって PR 化時は、以下順で確度を上げる:
    1. 既存テストの呼び出し元を確認
    2. 事象再現シナリオの fixture を小さく追加
    3. エラーパス/境界値を1ケース以上含める

