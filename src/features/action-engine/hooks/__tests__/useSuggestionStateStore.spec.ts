import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SUGGESTION_STATE_STORAGE_KEY,
  SUGGESTION_STATE_STORAGE_VERSION,
  loadSuggestionStatesFromStorage,
  saveSuggestionStatesToStorage,
  useSuggestionStateStore,
} from '../useSuggestionStateStore';

function readPersistedPayload() {
  return JSON.parse(
    localStorage.getItem(SUGGESTION_STATE_STORAGE_KEY) ?? '{}',
  ) as {
    version?: number;
    states?: Record<string, { status?: string; snoozedUntil?: string }>;
  };
}

describe('useSuggestionStateStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-21T10:00:00Z'));
    localStorage.clear();
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

    const persisted = readPersistedPayload();
    expect(persisted.version).toBe(SUGGESTION_STATE_STORAGE_VERSION);
    expect(persisted.states?.['rule:user:2026-W12']?.status).toBe('dismissed');
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

    const persisted = readPersistedPayload();
    expect(persisted.states?.['rule:user:2026-W12']?.status).toBe('snoozed');
    expect(
      persisted.states?.['rule:user:2026-W12']?.snoozedUntil,
    ).toBe('2026-03-24T00:00:00.000Z');
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

    const persisted = readPersistedPayload();
    expect(persisted.states?.['rule:user:2026-W12']?.status).toBe('open');
    expect(
      persisted.states?.['rule:user:2026-W12']?.snoozedUntil,
    ).toBeUndefined();
  });

  it('loadSuggestionStatesFromStorage は壊れたJSONを握りつぶして初期化できる', () => {
    localStorage.setItem(SUGGESTION_STATE_STORAGE_KEY, '{broken-json');

    const loaded = loadSuggestionStatesFromStorage();

    expect(loaded).toEqual({});
    expect(localStorage.getItem(SUGGESTION_STATE_STORAGE_KEY)).toBeNull();
  });

  it('loadSuggestionStatesFromStorage は invalid/unknown state を除外できる', () => {
    localStorage.setItem(
      SUGGESTION_STATE_STORAGE_KEY,
      JSON.stringify({
        version: SUGGESTION_STATE_STORAGE_VERSION,
        states: {
          'rule:user:valid': {
            stableId: 'rule:user:valid',
            status: 'dismissed',
            updatedAt: '2026-03-21T10:00:00.000Z',
          },
          'rule:user:unknown-status': {
            stableId: 'rule:user:unknown-status',
            status: 'archived',
            updatedAt: '2026-03-21T10:00:00.000Z',
          },
          'rule:user:missing-updatedAt': {
            stableId: 'rule:user:missing-updatedAt',
            status: 'open',
          },
        },
      }),
    );

    const loaded = loadSuggestionStatesFromStorage();

    expect(Object.keys(loaded)).toEqual(['rule:user:valid']);
    expect(loaded['rule:user:valid']?.status).toBe('dismissed');
  });

  it('saveSuggestionStatesToStorage は version 付きで保存できる', () => {
    saveSuggestionStatesToStorage({
      'rule:user:2026-W12': {
        stableId: 'rule:user:2026-W12',
        status: 'open',
        updatedAt: '2026-03-21T10:00:00.000Z',
      },
    });

    const persisted = readPersistedPayload();
    expect(persisted.version).toBe(SUGGESTION_STATE_STORAGE_VERSION);
    expect(persisted.states?.['rule:user:2026-W12']?.status).toBe('open');
  });

  it('store 初期化時に localStorage から hydrate できる', async () => {
    localStorage.setItem(
      SUGGESTION_STATE_STORAGE_KEY,
      JSON.stringify({
        version: SUGGESTION_STATE_STORAGE_VERSION,
        states: {
          'rule:user:hydrated': {
            stableId: 'rule:user:hydrated',
            status: 'dismissed',
            updatedAt: '2026-03-21T10:00:00.000Z',
          },
        },
      }),
    );

    vi.resetModules();
    const mod = await import('../useSuggestionStateStore');

    expect(mod.useSuggestionStateStore.getState().states['rule:user:hydrated']).toMatchObject({
      stableId: 'rule:user:hydrated',
      status: 'dismissed',
      updatedAt: '2026-03-21T10:00:00.000Z',
    });
  });
});
