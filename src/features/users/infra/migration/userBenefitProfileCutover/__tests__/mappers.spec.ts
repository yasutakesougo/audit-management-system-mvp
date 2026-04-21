import { describe, expect, it } from 'vitest';
import {
  buildMigratingFieldsPayload,
  CutoverStage,
  getSelectFieldsForStage,
  getWriteFieldsForStage,
  mapMigratingFields,
  USER_BENEFIT_PROFILE_MIGRATING_COLUMNS,
} from '..';

const rawWithBoth = {
  CopayPaymentMethod: 'direct-new',
  Copay_x0020_Payment_x0020_Method: 'direct-old',
  GrantMunicipality: null,
  Grant_x0020_Municipality: 'fallback-old',
  MealAddition: 'meal-new',
  Meal_x0020_Addition: 'meal-old',
} as const;

describe('userBenefitProfileCutover — read mapper', () => {
  it('PRE_MIGRATION / DUAL_WRITE で canonical を優先し、空のときに legacy fallback する', () => {
    for (const stage of [CutoverStage.PRE_MIGRATION, CutoverStage.DUAL_WRITE, CutoverStage.BACKFILL_IN_PROGRESS] as const) {
      const mapped = mapMigratingFields(rawWithBoth, stage);
      expect(mapped.copayPaymentMethod).toBe('direct-new');
      expect(mapped.grantMunicipality).toBe('fallback-old'); // canonical null → legacy
      expect(mapped.mealAddition).toBe('meal-new');
    }
  });

  it('READ_CUTOVER 以降は canonical のみ参照し、legacy は無視される', () => {
    for (const stage of [CutoverStage.READ_CUTOVER, CutoverStage.WRITE_CUTOVER] as const) {
      const mapped = mapMigratingFields(rawWithBoth, stage);
      expect(mapped.copayPaymentMethod).toBe('direct-new');
      expect(mapped.grantMunicipality).toBeNull(); // legacy fallback されない
      expect(mapped.mealAddition).toBe('meal-new');
    }
  });

  it('$select フィールドは stage に応じて切り替わる', () => {
    const early = getSelectFieldsForStage(CutoverStage.DUAL_WRITE);
    const late = getSelectFieldsForStage(CutoverStage.READ_CUTOVER);
    expect(early.length).toBe(USER_BENEFIT_PROFILE_MIGRATING_COLUMNS.length * 2);
    expect(late.length).toBe(USER_BENEFIT_PROFILE_MIGRATING_COLUMNS.length);
    expect(late).toEqual(USER_BENEFIT_PROFILE_MIGRATING_COLUMNS.map((c) => c.canonical));
  });
});

describe('userBenefitProfileCutover — write mapper', () => {
  const patch = { copayPaymentMethod: 'v1', grantMunicipality: 'v2', grantPeriodStart: '2026-05-01' };

  it('PRE_MIGRATION では legacy のみに書き込む', () => {
    const payload = buildMigratingFieldsPayload(patch, CutoverStage.PRE_MIGRATION);
    expect(payload).toEqual({
      Copay_x0020_Payment_x0020_Method: 'v1',
      Grant_x0020_Municipality: 'v2',
      Grant_x0020_Period_x0020_Start: '2026-05-01',
    });
  });

  it('DUAL_WRITE / BACKFILL_IN_PROGRESS / READ_CUTOVER では canonical + legacy に二重書きする', () => {
    for (const stage of [CutoverStage.DUAL_WRITE, CutoverStage.BACKFILL_IN_PROGRESS, CutoverStage.READ_CUTOVER] as const) {
      const payload = buildMigratingFieldsPayload(patch, stage);
      expect(payload).toEqual({
        CopayPaymentMethod: 'v1',
        Copay_x0020_Payment_x0020_Method: 'v1',
        GrantMunicipality: 'v2',
        Grant_x0020_Municipality: 'v2',
        GrantPeriodStart: '2026-05-01',
        Grant_x0020_Period_x0020_Start: '2026-05-01',
      });
    }
  });

  it('WRITE_CUTOVER では canonical のみに書き込む（legacy 停止）', () => {
    const payload = buildMigratingFieldsPayload(patch, CutoverStage.WRITE_CUTOVER);
    expect(payload).toEqual({
      CopayPaymentMethod: 'v1',
      GrantMunicipality: 'v2',
      GrantPeriodStart: '2026-05-01',
    });
  });

  it('不明 domainKey は黙殺する（横展開時の誤記で壊さない）', () => {
    const payload = buildMigratingFieldsPayload({ unknownColumn: 'x', copayPaymentMethod: 'y' }, CutoverStage.DUAL_WRITE);
    expect(payload).toEqual({
      CopayPaymentMethod: 'y',
      Copay_x0020_Payment_x0020_Method: 'y',
    });
  });

  it('rollback: WRITE_CUTOVER → DUAL_WRITE に戻すと二重書きが復活する', () => {
    const afterCutover = buildMigratingFieldsPayload(patch, CutoverStage.WRITE_CUTOVER);
    const afterRollback = buildMigratingFieldsPayload(patch, CutoverStage.DUAL_WRITE);
    expect(Object.keys(afterCutover).length).toBeLessThan(Object.keys(afterRollback).length);
  });

  it('getWriteFieldsForStage は lint/検証用に全対象 internal name を返す', () => {
    const cutover = getWriteFieldsForStage(CutoverStage.WRITE_CUTOVER);
    expect(cutover).toEqual(USER_BENEFIT_PROFILE_MIGRATING_COLUMNS.map((c) => c.canonical));
  });
});
