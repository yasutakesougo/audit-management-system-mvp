/**
 * Handoff drift 耐性テスト
 *
 * HANDOFF_CANDIDATES が resolveInternalNamesDetailed を通して
 * 各種 drift シナリオを正しく吸収できることを確認する。
 *
 * シナリオ:
 *  1. 標準名 (Message, UserCode, Category) が解決される
 *  2. message が Body / cr013_message に drift した場合を吸収
 *  3. userCode が cr013_userCode / cr013_usercode / UserID に drift した場合を吸収
 *  4. category が HandoffCategory / cr013_category に drift した場合を吸収
 *  5. 必須3フィールド (message/userCode/category) が揃えば isHealthy=true
 *  6. 必須フィールド欠落で isHealthy=false（各ケース）
 *  7. optional フィールド欠落でも isHealthy=true（WARN 水準）
 *  8. unresolved キーが missing として検知される（silent drop しない）
 */
import { describe, it, expect } from 'vitest';
import { resolveInternalNamesDetailed, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import {
  HANDOFF_CANDIDATES,
  HANDOFF_ESSENTIALS,
} from '../handoffFields';

function resolve(available: Set<string>) {
  return resolveInternalNamesDetailed(
    available,
    HANDOFF_CANDIDATES as unknown as Record<string, string[]>,
  );
}

function isHealthy(resolved: Record<string, string | undefined>) {
  const essentials = HANDOFF_ESSENTIALS as unknown as string[];
  return areEssentialFieldsResolved(resolved, essentials);
}

// ── 1. 標準名 ────────────────────────────────────────────────────────────────

describe('HANDOFF_CANDIDATES — 標準名', () => {
  const available = new Set([
    'Id', 'Title', 'Message', 'UserCode', 'Category', 'Severity', 'Status',
  ]);

  it('必須3フィールドがすべて解決される', () => {
    const { resolved, missing } = resolve(available);
    expect(resolved.message).toBe('Message');
    expect(resolved.userCode).toBe('UserCode');
    expect(resolved.category).toBe('Category');
    expect(missing).not.toContain('message');
    expect(missing).not.toContain('userCode');
    expect(missing).not.toContain('category');
  });

  it('drift フラグが false（完全一致）', () => {
    const { fieldStatus } = resolve(available);
    expect(fieldStatus.message.isDrifted).toBe(false);
    expect(fieldStatus.userCode.isDrifted).toBe(false);
    expect(fieldStatus.category.isDrifted).toBe(false);
  });

  it('isHealthy=true', () => {
    const { resolved } = resolve(available);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });
});

// ── 2. message の drift パターン ─────────────────────────────────────────────

describe('HANDOFF_CANDIDATES — message drift', () => {
  it('Body が message として解決される', () => {
    const available = new Set(['Body', 'UserCode', 'Category']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.message).toBe('Body');
    expect(fieldStatus.message.isDrifted).toBe(true);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('cr013_message が message として解決される', () => {
    const available = new Set(['cr013_message', 'UserCode', 'Category']);
    const { resolved } = resolve(available);
    expect(resolved.message).toBe('cr013_message');
  });
});

// ── 3. userCode の drift パターン ────────────────────────────────────────────

describe('HANDOFF_CANDIDATES — userCode drift', () => {
  it('cr013_userCode が userCode として解決される', () => {
    const available = new Set(['Message', 'cr013_userCode', 'Category']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.userCode).toBe('cr013_userCode');
    expect(fieldStatus.userCode.isDrifted).toBe(true);
  });

  it('cr013_usercode が userCode として解決される', () => {
    const available = new Set(['Message', 'cr013_usercode', 'Category']);
    const { resolved } = resolve(available);
    expect(resolved.userCode).toBe('cr013_usercode');
  });

  it('UserID が userCode として解決される', () => {
    const available = new Set(['Message', 'UserID', 'Category']);
    const { resolved } = resolve(available);
    expect(resolved.userCode).toBe('UserID');
  });
});

// ── 4. category の drift パターン ────────────────────────────────────────────

describe('HANDOFF_CANDIDATES — category drift', () => {
  it('HandoffCategory が category として解決される', () => {
    const available = new Set(['Message', 'UserCode', 'HandoffCategory']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.category).toBe('HandoffCategory');
    expect(fieldStatus.category.isDrifted).toBe(true);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('cr013_category が category として解決される', () => {
    const available = new Set(['Message', 'UserCode', 'cr013_category']);
    const { resolved } = resolve(available);
    expect(resolved.category).toBe('cr013_category');
  });
});

// ── 5〜8. FAIL/WARN 境界 ──────────────────────────────────────────────────────

describe('HANDOFF_ESSENTIALS FAIL/WARN 境界', () => {
  it('必須3点のみでも isHealthy=true（最小構成）', () => {
    const { resolved } = resolve(new Set(['Message', 'UserCode', 'Category']));
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('message が完全欠落すれば isHealthy=false（FAIL）', () => {
    const { resolved } = resolve(new Set(['UserCode', 'Category']));
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(false);
  });

  it('userCode が完全欠落すれば isHealthy=false（FAIL）', () => {
    const { resolved } = resolve(new Set(['Message', 'Category']));
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(false);
  });

  it('category が完全欠落すれば isHealthy=false（FAIL）', () => {
    const { resolved } = resolve(new Set(['Message', 'UserCode']));
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(false);
  });

  it('severity / status / timeBand 欠落でも isHealthy=true（WARN 水準・optional）', () => {
    const { resolved, missing } = resolve(new Set(['Message', 'UserCode', 'Category']));
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
    expect(missing).toContain('severity');
    expect(missing).toContain('status');
    expect(missing).toContain('timeBand');
  });

  it('drift 経由3点でも isHealthy=true', () => {
    const { resolved } = resolve(new Set(['Body', 'cr013_usercode', 'HandoffCategory']));
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('unresolved フィールドは missing に残る（silent drop しない）', () => {
    const { missing } = resolve(new Set(['SomeUnknownFieldOnly']));
    expect(missing).toContain('message');
    expect(missing).toContain('userCode');
    expect(missing).toContain('category');
    expect(missing).toContain('severity');
  });
});
