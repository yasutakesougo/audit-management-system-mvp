/**
 * regulatoryResolution 純粋関数のユニットテスト
 *
 * P6 Phase 3: isRegulatoryHandoff / hasResolutionTrail /
 *             getRegulatoryResolutionStatus / buildResolutionPayload
 */
import { describe, expect, it, vi } from 'vitest';
import type { HandoffRecord } from '../handoffTypes';
import {
  isRegulatoryHandoff,
  hasResolutionTrail,
  getRegulatoryResolutionStatus,
  buildResolutionPayload,
} from '../regulatoryResolution';

// ── ヘルパー ──

function createRecord(overrides: Partial<HandoffRecord> = {}): HandoffRecord {
  return {
    id: 1,
    title: 'テスト',
    message: 'テスト内容',
    userCode: 'U001',
    userDisplayName: 'テスト太郎',
    category: 'その他',
    severity: '通常',
    status: '未対応',
    timeBand: '午前',
    createdAt: new Date().toISOString(),
    createdByName: 'テスト太郎',
    isDraft: false,
    ...overrides,
  };
}

// ── isRegulatoryHandoff ──

describe('isRegulatoryHandoff', () => {
  it('sourceType=regulatory-finding → true', () => {
    expect(isRegulatoryHandoff(createRecord({ sourceType: 'regulatory-finding' }))).toBe(true);
  });

  it('sourceType=severe-addon-finding → true', () => {
    expect(isRegulatoryHandoff(createRecord({ sourceType: 'severe-addon-finding' }))).toBe(true);
  });

  it('sourceType=meeting-minutes → false', () => {
    expect(isRegulatoryHandoff(createRecord({ sourceType: 'meeting-minutes' }))).toBe(false);
  });

  it('sourceType=undefined → false', () => {
    expect(isRegulatoryHandoff(createRecord({}))).toBe(false);
  });
});

// ── hasResolutionTrail ──

describe('hasResolutionTrail', () => {
  it('terminal + resolvedBy + resolvedAt → true', () => {
    const r = createRecord({
      status: '対応済',
      resolvedBy: '田中太郎',
      resolvedAt: '2026-03-14T08:00:00Z',
    });
    expect(hasResolutionTrail(r)).toBe(true);
  });

  it('terminal だが resolvedBy がない → false', () => {
    const r = createRecord({
      status: '完了',
      resolvedAt: '2026-03-14T08:00:00Z',
    });
    expect(hasResolutionTrail(r)).toBe(false);
  });

  it('terminal だが resolvedAt がない → false', () => {
    const r = createRecord({
      status: '対応済',
      resolvedBy: '田中太郎',
    });
    expect(hasResolutionTrail(r)).toBe(false);
  });

  it('resolvedBy が空文字 → false', () => {
    const r = createRecord({
      status: '対応済',
      resolvedBy: '',
      resolvedAt: '2026-03-14T08:00:00Z',
    });
    expect(hasResolutionTrail(r)).toBe(false);
  });

  it('非 terminal → false（resolvedBy/At があっても）', () => {
    const r = createRecord({
      status: '未対応',
      resolvedBy: '田中太郎',
      resolvedAt: '2026-03-14T08:00:00Z',
    });
    expect(hasResolutionTrail(r)).toBe(false);
  });
});

// ── getRegulatoryResolutionStatus ──

describe('getRegulatoryResolutionStatus', () => {
  it('未対応 → pending', () => {
    expect(getRegulatoryResolutionStatus(createRecord({ status: '未対応' }))).toBe('pending');
  });

  it('対応中 → pending', () => {
    expect(getRegulatoryResolutionStatus(createRecord({ status: '対応中' }))).toBe('pending');
  });

  it('対応済 + 証跡あり → resolved', () => {
    const r = createRecord({
      status: '対応済',
      resolvedBy: '田中太郎',
      resolvedAt: '2026-03-14T08:00:00Z',
    });
    expect(getRegulatoryResolutionStatus(r)).toBe('resolved');
  });

  it('完了 + 証跡なし → closed_no_trail', () => {
    expect(getRegulatoryResolutionStatus(createRecord({ status: '完了' }))).toBe('closed_no_trail');
  });

  it('明日へ持越 → pending', () => {
    expect(getRegulatoryResolutionStatus(createRecord({ status: '明日へ持越' }))).toBe('pending');
  });
});

// ── buildResolutionPayload ──

describe('buildResolutionPayload', () => {
  it('status=対応済, resolvedBy, resolvedAt, resolutionNote を含む', () => {
    const now = new Date();
    vi.setSystemTime(now);

    const result = buildResolutionPayload({
      resolvedBy: '田中太郎',
      resolutionNote: '基礎研修の受講を完了しました',
    });

    expect(result.status).toBe('対応済');
    expect(result.resolvedBy).toBe('田中太郎');
    expect(result.resolvedAt).toBe(now.toISOString());
    expect(result.resolutionNote).toBe('基礎研修の受講を完了しました');

    vi.useRealTimers();
  });

  it('resolutionNote 省略時は空文字', () => {
    const result = buildResolutionPayload({ resolvedBy: '佐藤花子' });
    expect(result.resolutionNote).toBe('');
  });
});
