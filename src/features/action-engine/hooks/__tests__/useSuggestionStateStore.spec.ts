import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSuggestionStateStore } from '../useSuggestionStateStore';

describe('useSuggestionStateStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-21T10:00:00Z'));
    useSuggestionStateStore.setState({ states: {} });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('dismiss で dismissed 状態を保存できる', () => {
    useSuggestionStateStore.getState().dismiss('rule:user:2026-W12', {
      by: 'staff-a',
      reason: '対応済み',
    });

    const saved = useSuggestionStateStore.getState().states['rule:user:2026-W12'];
    expect(saved?.status).toBe('dismissed');
    expect(saved?.stableId).toBe('rule:user:2026-W12');
    expect(saved?.updatedBy).toBe('staff-a');
    expect(saved?.reason).toBe('対応済み');
    expect(saved?.updatedAt).toBe('2026-03-21T10:00:00.000Z');
  });

  it('snooze で snoozedUntil を保存できる', () => {
    useSuggestionStateStore.getState().snooze(
      'rule:user:2026-W12',
      '2026-03-24T00:00:00.000Z',
      { by: 'staff-b' },
    );

    const saved = useSuggestionStateStore.getState().states['rule:user:2026-W12'];
    expect(saved?.status).toBe('snoozed');
    expect(saved?.snoozedUntil).toBe('2026-03-24T00:00:00.000Z');
    expect(saved?.updatedBy).toBe('staff-b');
  });

  it('reopen で open 状態に戻せる', () => {
    const store = useSuggestionStateStore.getState();
    store.snooze('rule:user:2026-W12', '2026-03-24T00:00:00.000Z');

    vi.setSystemTime(new Date('2026-03-21T11:00:00Z'));
    useSuggestionStateStore.getState().reopen('rule:user:2026-W12');

    const saved = useSuggestionStateStore.getState().states['rule:user:2026-W12'];
    expect(saved?.status).toBe('open');
    expect(saved?.snoozedUntil).toBeUndefined();
    expect(saved?.updatedAt).toBe('2026-03-21T11:00:00.000Z');
  });
});
