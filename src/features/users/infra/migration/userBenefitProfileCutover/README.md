# UserBenefit_Profile Cutover — rename-migrate template (Lot1B PR #E)

> **Status**: Template / scaffold. 統合は PR #E でレビュー後に実施。
> **Scope**: UserBenefit_Profile の optional 6 列 rename-migrate

## 対応範囲 (6 列)

| domainKey | canonical (new) | legacy (old) | type |
|---|---|---|---|
| copayPaymentMethod | CopayPaymentMethod | Copay_x0020_Payment_x0020_Method | Text |
| grantMunicipality | GrantMunicipality | Grant_x0020_Municipality | Text |
| grantPeriodStart | GrantPeriodStart | Grant_x0020_Period_x0020_Start | DateTime |
| grantPeriodEnd | GrantPeriodEnd | Grant_x0020_Period_x0020_End | DateTime |
| mealAddition | MealAddition | Meal_x0020_Addition | Text |
| userCopayLimit | UserCopayLimit | User_x0020_Copay_x0020_Limit | Text |

横展開: `columns.ts` の `USER_BENEFIT_PROFILE_MIGRATING_COLUMNS` に追記するだけで mapper / tests に反映される。

## モジュール構成 (責務分離)

| file | 責務 | CUTOVER STEP |
|---|---|---|
| [columns.ts](./columns.ts) | 6 列の canonical / legacy / type SSOT | — |
| [stage.ts](./stage.ts) | cutover stage flag の読み取り / 順序判定 | 差し込み点 |
| [readMapper.ts](./readMapper.ts) | `mapMigratingFields(raw, stage)` と `getSelectFieldsForStage` | 2 (fallback) / 4 (read cutover) |
| [writeMapper.ts](./writeMapper.ts) | `buildMigratingFieldsPayload(patch, stage)` と `getWriteFieldsForStage` | 1 (dual-write) / 5 (write cutover) |
| [../../../../../../scripts/ops/migrate-user-benefit-profile-optional.mjs](../../../../../../scripts/ops/migrate-user-benefit-profile-optional.mjs) | backfill 実行（dry-run / execute） | 3 (backfill) |
| [__tests__/mappers.spec.ts](./__tests__/mappers.spec.ts) | 5 段の stage 遷移を全パターン検証 | 全段 |

## CUTOVER STEP 5 段 ↔ stage 対応

| stage | read 挙動 | write 挙動 | 使用タイミング |
|---|---|---|---|
| PRE_MIGRATION | canonical → legacy fallback | legacy のみ | 着手前 |
| DUAL_WRITE | canonical → legacy fallback | 二重書き | step 1 |
| BACKFILL_IN_PROGRESS | canonical → legacy fallback | 二重書き | step 2〜3 |
| READ_CUTOVER | canonical のみ | 二重書き | step 4 |
| WRITE_CUTOVER | canonical のみ | canonical のみ | step 5 |

## Feature flag 差し込み点

- **env**: `VITE_USER_BENEFIT_PROFILE_CUTOVER_STAGE`
- **localStorage**: `lot1b.userBenefitProfileCutoverStage`
- 共に `resolveUserBenefitProfileCutoverStage()` が読み取る
- 既存の `src/config/featureFlags.ts` への統合（本番配線）は PR #E レビュー確定後

## Rollback 設計

- **いつでも stage を下げれば fallback が復活**（legacy 列残置が前提）
- WRITE_CUTOVER → READ_CUTOVER: write のみ二重書きに戻る
- READ_CUTOVER → BACKFILL_IN_PROGRESS: read に legacy fallback が復活
- DUAL_WRITE → PRE_MIGRATION: 着手前状態に戻る（canonical 列は残るが無視）
- **legacy 列の drop は Lot2 送り** — Lot1B の期間中は常に rollback 可能

## 呼び出し側の統合イメージ（PR #E 内で実施）

```ts
// 例: SharePointUserRepository の benefit profile 読み取り部
import {
  resolveUserBenefitProfileCutoverStage,
  mapMigratingFields,
  getSelectFieldsForStage,
} from '@/features/users/infra/migration/userBenefitProfileCutover';

const stage = resolveUserBenefitProfileCutoverStage();
const selectFields = getSelectFieldsForStage(stage);
const raw = await spFetchItem(LIST_TITLE, id, { select: selectFields });
const domain = mapMigratingFields(raw, stage);
```

```ts
// 例: upsert
import {
  resolveUserBenefitProfileCutoverStage,
  buildMigratingFieldsPayload,
} from '@/features/users/infra/migration/userBenefitProfileCutover';

const stage = resolveUserBenefitProfileCutoverStage();
const payload = buildMigratingFieldsPayload(patch, stage);
await spUpdateItem(LIST_TITLE, id, payload);
```

## PR #E 内 TODO

- [ ] 既存の `USERS_BENEFIT_FIELD_MAP` / read path との配線
- [ ] backfill スクリプトに実 SP 接続を注入（`TODO(lot1b-pr-e-integration)` 箇所）
- [ ] `src/config/featureFlags.ts` へ stage 解決を統合
- [ ] staging 環境で 5 段フル通しリハーサル
- [ ] drift inventory 再実行で 6 列が `match` に遷移することを確認
