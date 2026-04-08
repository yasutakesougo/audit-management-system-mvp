/**
 * Support Plans drift 耐性テスト
 *
 * SUPPORT_PLANS_CANDIDATES が resolveInternalNamesDetailed を通して
 * 各種 drift シナリオを正しく吸収できることを確認する。
 *
 * シナリオ:
 *  1. 標準名 (DraftId, UserCode, FormDataJson) が解決される
 *  2. draftId が cr013_draftid に drift した場合を吸収
 *  3. userCode が cr013_usercode / UserID に drift した場合を吸収
 *  4. formDataJson が cr013_formdatajson に drift した場合を吸収
 *  5. draftName が Title に drift した場合を吸収
 *  6. 必須3フィールド (draftId/userCode/formDataJson) が揃えば isHealthy=true
 *  7. 必須フィールド欠落で isHealthy=false（各ケース）
 *  8. optional フィールド欠落でも isHealthy=true（WARN 水準）
 *  9. unresolved キーが missing として検知される（silent drop しない）
 */
import { describe, it, expect } from 'vitest';
import { resolveInternalNamesDetailed, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import {
  SUPPORT_PLANS_CANDIDATES,
  SUPPORT_PLANS_ESSENTIALS,
} from '../supportPlanFields';

function resolve(available: Set<string>) {
  return resolveInternalNamesDetailed(
    available,
    SUPPORT_PLANS_CANDIDATES as unknown as Record<string, string[]>,
  );
}

function isHealthy(resolved: Record<string, string | undefined>) {
  const essentials = SUPPORT_PLANS_ESSENTIALS as unknown as string[];
  return areEssentialFieldsResolved(resolved, essentials);
}

// ── 1. 標準名 ────────────────────────────────────────────────────────────────

describe('SUPPORT_PLANS_CANDIDATES — 標準名', () => {
  const available = new Set([
    'Id', 'DraftId', 'UserCode', 'FormDataJson', 'DraftName', 'Status', 'SchemaVersion',
  ]);

  it('必須3フィールドがすべて解決される', () => {
    const { resolved, missing } = resolve(available);
    expect(resolved.draftId).toBe('DraftId');
    expect(resolved.userCode).toBe('UserCode');
    expect(resolved.formDataJson).toBe('FormDataJson');
    expect(missing).not.toContain('draftId');
    expect(missing).not.toContain('userCode');
    expect(missing).not.toContain('formDataJson');
  });

  it('drift フラグが false（完全一致）', () => {
    const { fieldStatus } = resolve(available);
    expect(fieldStatus.draftId.isDrifted).toBe(false);
    expect(fieldStatus.userCode.isDrifted).toBe(false);
    expect(fieldStatus.formDataJson.isDrifted).toBe(false);
  });

  it('isHealthy=true', () => {
    const { resolved } = resolve(available);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });
});

// ── 2. draftId の drift パターン ─────────────────────────────────────────────

describe('SUPPORT_PLANS_CANDIDATES — draftId drift', () => {
  it('cr013_draftid が draftId として解決される', () => {
    const available = new Set(['cr013_draftid', 'UserCode', 'FormDataJson']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.draftId).toBe('cr013_draftid');
    expect(fieldStatus.draftId.isDrifted).toBe(true);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });
});

// ── 3. userCode の drift パターン ────────────────────────────────────────────

describe('SUPPORT_PLANS_CANDIDATES — userCode drift', () => {
  it('cr013_usercode が userCode として解決される', () => {
    const available = new Set(['DraftId', 'cr013_usercode', 'FormDataJson']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.userCode).toBe('cr013_usercode');
    expect(fieldStatus.userCode.isDrifted).toBe(true);
  });

  it('UserID が userCode として解決される', () => {
    const available = new Set(['DraftId', 'UserID', 'FormDataJson']);
    const { resolved } = resolve(available);
    expect(resolved.userCode).toBe('UserID');
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });
});

// ── 4. formDataJson の drift パターン ───────────────────────────────────────

describe('SUPPORT_PLANS_CANDIDATES — formDataJson drift', () => {
  it('cr013_formdatajson が formDataJson として解決される', () => {
    const available = new Set(['DraftId', 'UserCode', 'cr013_formdatajson']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.formDataJson).toBe('cr013_formdatajson');
    expect(fieldStatus.formDataJson.isDrifted).toBe(true);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });
});

// ── 5. draftName の drift パターン ───────────────────────────────────────────

describe('SUPPORT_PLANS_CANDIDATES — draftName drift', () => {
  it('Title が draftName として解決される', () => {
    const available = new Set(['DraftId', 'UserCode', 'FormDataJson', 'Title']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.draftName).toBe('Title');
    expect(fieldStatus.draftName.isDrifted).toBe(true);
  });
});

// ── 6〜9. FAIL/WARN 境界 ──────────────────────────────────────────────────────

describe('SUPPORT_PLANS_ESSENTIALS FAIL/WARN 境界', () => {
  it('必須3点のみでも isHealthy=true（最小構成）', () => {
    const { resolved } = resolve(new Set(['DraftId', 'UserCode', 'FormDataJson']));
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('draftId が完全欠落すれば isHealthy=false（FAIL）', () => {
    const { resolved } = resolve(new Set(['UserCode', 'FormDataJson']));
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(false);
  });

  it('userCode が完全欠落すれば isHealthy=false（FAIL）', () => {
    const { resolved } = resolve(new Set(['DraftId', 'FormDataJson']));
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(false);
  });

  it('formDataJson が完全欠落すれば isHealthy=false（FAIL）', () => {
    const { resolved } = resolve(new Set(['DraftId', 'UserCode']));
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(false);
  });

  it('draftName / status / schemaVersion 欠落でも isHealthy=true（WARN 水準・optional）', () => {
    const { resolved, missing } = resolve(new Set(['DraftId', 'UserCode', 'FormDataJson']));
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
    expect(missing).toContain('draftName');
    expect(missing).toContain('status');
    expect(missing).toContain('schemaVersion');
  });

  it('drift 経由3点でも isHealthy=true', () => {
    const { resolved } = resolve(new Set(['cr013_draftid', 'cr013_usercode', 'cr013_formdatajson']));
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('unresolved フィールドは missing に残る（silent drop しない）', () => {
    const { missing } = resolve(new Set(['SomeUnknownFieldOnly']));
    expect(missing).toContain('draftId');
    expect(missing).toContain('userCode');
    expect(missing).toContain('formDataJson');
    expect(missing).toContain('draftName');
  });
});
