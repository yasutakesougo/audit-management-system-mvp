// ---------------------------------------------------------------------------
// isSuggestionVisible — Unit Tests
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { isSuggestionVisible } from '../types';
import type { ActionSuggestionState } from '../types';

describe('isSuggestionVisible', () => {
  const now = new Date('2026-03-21T12:00:00Z');

  it('state が undefined なら表示', () => {
    expect(isSuggestionVisible(undefined, now)).toBe(true);
  });

  it('status: open なら表示', () => {
    const state: ActionSuggestionState = {
      stableId: 'test:user:2026-W12',
      status: 'open',
      updatedAt: '2026-03-21T11:00:00Z',
    };
    expect(isSuggestionVisible(state, now)).toBe(true);
  });

  it('status: dismissed なら非表示', () => {
    const state: ActionSuggestionState = {
      stableId: 'test:user:2026-W12',
      status: 'dismissed',
      updatedAt: '2026-03-21T11:00:00Z',
      reason: '対応済み',
    };
    expect(isSuggestionVisible(state, now)).toBe(false);
  });

  it('status: snoozed で snoozedUntil が未来なら非表示', () => {
    const state: ActionSuggestionState = {
      stableId: 'test:user:2026-W12',
      status: 'snoozed',
      snoozedUntil: '2026-03-22T12:00:00Z', // 明日
      updatedAt: '2026-03-21T11:00:00Z',
    };
    expect(isSuggestionVisible(state, now)).toBe(false);
  });

  it('status: snoozed で snoozedUntil が過去なら再表示', () => {
    const state: ActionSuggestionState = {
      stableId: 'test:user:2026-W12',
      status: 'snoozed',
      snoozedUntil: '2026-03-20T12:00:00Z', // 昨日
      updatedAt: '2026-03-19T11:00:00Z',
    };
    expect(isSuggestionVisible(state, now)).toBe(true);
  });

  it('status: snoozed で snoozedUntil が now と同時刻なら再表示', () => {
    const state: ActionSuggestionState = {
      stableId: 'test:user:2026-W12',
      status: 'snoozed',
      snoozedUntil: '2026-03-21T12:00:00Z', // ちょうど now
      updatedAt: '2026-03-20T11:00:00Z',
    };
    expect(isSuggestionVisible(state, now)).toBe(true);
  });

  it('status: snoozed で snoozedUntil が省略なら非表示', () => {
    const state: ActionSuggestionState = {
      stableId: 'test:user:2026-W12',
      status: 'snoozed',
      updatedAt: '2026-03-21T11:00:00Z',
    };
    expect(isSuggestionVisible(state, now)).toBe(false);
  });
});
