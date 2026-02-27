import { describe, expect, it } from 'vitest';

import { makeEntryKey } from '@/features/service-provision/domain/types';
import { upsertProvisionInputSchema } from '@/features/service-provision/domain/schema';

describe('makeEntryKey', () => {
  it('UserCode と recordDateISO を "|" で結合する', () => {
    expect(makeEntryKey('I022', '2026-02-27')).toBe('I022|2026-02-27');
  });

  it('空文字でも結合できる', () => {
    expect(makeEntryKey('', '')).toBe('|');
  });
});

describe('upsertProvisionInputSchema', () => {
  const validInput = {
    userCode: 'I022',
    recordDateISO: '2026-02-27',
    status: '提供' as const,
  };

  it('最小限の入力で parse 成功', () => {
    const result = upsertProvisionInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('全フィールド入力で parse 成功', () => {
    const result = upsertProvisionInputSchema.safeParse({
      ...validInput,
      startHHMM: 930,
      endHHMM: 1530,
      hasTransport: true,
      hasMeal: true,
      hasBath: false,
      hasExtended: false,
      hasAbsentSupport: false,
      note: 'テストメモ',
      source: 'Unified' as const,
      updatedByUPN: 'user@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('userCode 空文字 → エラー', () => {
    const result = upsertProvisionInputSchema.safeParse({
      ...validInput,
      userCode: '',
    });
    expect(result.success).toBe(false);
  });

  it('recordDateISO 不正フォーマット → エラー', () => {
    const result = upsertProvisionInputSchema.safeParse({
      ...validInput,
      recordDateISO: '2026/02/27',
    });
    expect(result.success).toBe(false);
  });

  it('recordDateISO 6桁年 → エラー', () => {
    const result = upsertProvisionInputSchema.safeParse({
      ...validInput,
      recordDateISO: '202602-27',
    });
    expect(result.success).toBe(false);
  });

  it('status 不正値 → エラー', () => {
    const result = upsertProvisionInputSchema.safeParse({
      ...validInput,
      status: '未定',
    });
    expect(result.success).toBe(false);
  });

  it('startHHMM 範囲外（負数） → エラー', () => {
    const result = upsertProvisionInputSchema.safeParse({
      ...validInput,
      startHHMM: -1,
    });
    expect(result.success).toBe(false);
  });

  it('endHHMM 範囲外（2360以上） → エラー', () => {
    const result = upsertProvisionInputSchema.safeParse({
      ...validInput,
      endHHMM: 2400,
    });
    expect(result.success).toBe(false);
  });

  it('startHHMM null は許容', () => {
    const result = upsertProvisionInputSchema.safeParse({
      ...validInput,
      startHHMM: null,
    });
    expect(result.success).toBe(true);
  });

  it('note 2000文字超 → エラー', () => {
    const result = upsertProvisionInputSchema.safeParse({
      ...validInput,
      note: 'a'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it('source 不正値 → エラー', () => {
    const result = upsertProvisionInputSchema.safeParse({
      ...validInput,
      source: 'Manual',
    });
    expect(result.success).toBe(false);
  });
});
