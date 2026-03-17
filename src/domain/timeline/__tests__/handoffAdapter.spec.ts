/**
 * handoffAdapter — ユニットテスト
 *
 * ResolveUserIdFromCode 注入パターンのテストを含む。
 */

import { describe, it, expect } from 'vitest';
import { handoffToTimelineEvent } from '../adapters/handoffAdapter';
import type { HandoffRecord, HandoffSeverity } from '@/features/handoff/handoffTypes';
import type { ResolveUserIdFromCode } from '../types';

const makeHandoff = (
  overrides: Partial<HandoffRecord> = {},
): HandoffRecord => ({
  id: 100,
  title: '水分摂取量の注意',
  message: '午前中に水分をあまり取れていません',
  userCode: 'UC001',
  userDisplayName: '田中太郎',
  category: '体調',
  severity: '要注意',
  status: '未対応',
  timeBand: '午前',
  createdAt: '2026-03-15T09:00:00Z',
  createdByName: '佐藤花子',
  isDraft: false,
  ...overrides,
});

/** identity resolver（userCode = userId の場合） */
const identityResolver: ResolveUserIdFromCode = (code) => code;

/** ルックアップ resolver */
const lookupResolver: ResolveUserIdFromCode = (code) => {
  const map: Record<string, string> = { UC001: 'U001', UC002: 'U002' };
  return map[code] ?? null;
};

/** 常に null を返す resolver */
const nullResolver: ResolveUserIdFromCode = () => null;

describe('handoffToTimelineEvent', () => {
  it('identity resolver: userCode がそのまま userId になる', () => {
    const result = handoffToTimelineEvent(makeHandoff(), identityResolver);
    expect(result).not.toBeNull();
    expect(result!.userId).toBe('UC001');
  });

  it('lookup resolver: userCode が userId に変換される', () => {
    const result = handoffToTimelineEvent(makeHandoff(), lookupResolver);
    expect(result).not.toBeNull();
    expect(result!.userId).toBe('U001');
  });

  it('null resolver: 解決不能なら null を返す', () => {
    const result = handoffToTimelineEvent(makeHandoff(), nullResolver);
    expect(result).toBeNull();
  });

  it('基本変換: id, source, title, sourceRef が正しい', () => {
    const result = handoffToTimelineEvent(makeHandoff(), identityResolver)!;
    expect(result.id).toBe('handoff-100');
    expect(result.source).toBe('handoff');
    expect(result.title).toBe('申し送り: 水分摂取量の注意');
    expect(result.sourceRef).toEqual({ id: 100 });
  });

  it('occurredAt に createdAt がそのまま使われる', () => {
    const result = handoffToTimelineEvent(makeHandoff(), identityResolver)!;
    expect(result.occurredAt).toBe('2026-03-15T09:00:00Z');
  });

  it.each<[HandoffSeverity, string]>([
    ['通常', 'info'],
    ['要注意', 'warning'],
    ['重要', 'critical'],
  ])('severity "%s" → "%s"', (input, expected) => {
    const result = handoffToTimelineEvent(
      makeHandoff({ severity: input }),
      identityResolver,
    )!;
    expect(result.severity).toBe(expected);
  });

  it('description に message が入る', () => {
    const result = handoffToTimelineEvent(makeHandoff(), identityResolver)!;
    expect(result.description).toBe('午前中に水分をあまり取れていません');
  });

  it('message が空なら description は undefined', () => {
    const result = handoffToTimelineEvent(
      makeHandoff({ message: '' }),
      identityResolver,
    )!;
    expect(result.description).toBeUndefined();
  });

  it('meta に category, severity, status が含まれる', () => {
    const result = handoffToTimelineEvent(makeHandoff(), identityResolver)!;
    expect(result.meta).toEqual({
      category: '体調',
      severity: '要注意',
      status: '未対応',
    });
  });
});
