import { describe, it, expect } from 'vitest';
import { resolveInternalNamesDetailed, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import {
  HANDOFF_CANDIDATES,
  HANDOFF_ESSENTIALS,
} from '../handoffFields';

describe('Handoff Drift Resistance', () => {
  const cands = HANDOFF_CANDIDATES as unknown as Record<string, string[]>;

  it('標準名 (Message, UserCode, Category) が解決される', () => {
    const available = new Set(['Id', 'Title', 'Message', 'UserCode', 'Category', 'Severity']);
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, cands);
    
    expect(resolved.message).toBe('Message');
    expect(fieldStatus.message.isDrifted).toBe(false);
    
    expect(resolved.userCode).toBe('UserCode');
    expect(fieldStatus.userCode.isDrifted).toBe(false);
    
    expect(resolved.category).toBe('Category');
    expect(fieldStatus.category.isDrifted).toBe(false);
  });

  it('cr013_message / cr013_userCode が解決される (drift)', () => {
    const available = new Set(['cr013_message', 'cr013_userCode', 'Category']);
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, cands);
    
    expect(resolved.message).toBe('cr013_message');
    expect(fieldStatus.message.isDrifted).toBe(true);
    
    expect(resolved.userCode).toBe('cr013_userCode');
    expect(fieldStatus.userCode.isDrifted).toBe(true);
  });

  it('代替名 Body / cr013_usercode が解決される (drift)', () => {
    const available = new Set(['Body', 'cr013_usercode', 'HandoffCategory']);
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, cands);
    
    expect(resolved.message).toBe('Body');
    expect(fieldStatus.message.isDrifted).toBe(true);
    
    expect(resolved.userCode).toBe('cr013_usercode');
    expect(fieldStatus.userCode.isDrifted).toBe(true);
    
    expect(resolved.category).toBe('HandoffCategory');
    expect(fieldStatus.category.isDrifted).toBe(true);
  });

  it('必須チェック（message, userCode, category）が機能する', () => {
    const available = new Set(['Message', 'UserCode', 'Category']);
    const { resolved } = resolveInternalNamesDetailed(available, cands);
    const essentials = HANDOFF_ESSENTIALS as unknown as string[];
    
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(true);
  });

  it('UserCode が欠落している場合に FAIL 判定', () => {
    const available = new Set(['Message', 'Category', 'Severity']);
    const { resolved } = resolveInternalNamesDetailed(available, cands);
    const essentials = HANDOFF_ESSENTIALS as unknown as string[];
    
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(false);
  });
});
