import type { SuggestionAction } from '@/features/daily/domain/suggestionAction';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collectSuggestionActions, SUGGESTION_STORAGE_KEY_PATTERN } from '../useOpsMetrics';

const makeSuggestionAction = (overrides: Partial<SuggestionAction> = {}): SuggestionAction => ({
  action: overrides.action ?? 'accept',
  ruleId: overrides.ruleId ?? 'rule-1',
  category: overrides.category ?? 'co-occurrence',
  message: overrides.message ?? '提案メッセージ',
  evidence: overrides.evidence ?? '根拠',
  timestamp: overrides.timestamp ?? '2026-03-26T00:00:00.000Z',
  userId: overrides.userId ?? 'u1',
});

describe('collectSuggestionActions', () => {
  let localStorageStore: Record<string, string> = {};

  beforeEach(() => {
    localStorageStore = {};
    const mockStorage = {
      getItem: (key: string) => localStorageStore[key] ?? null,
      setItem: (key: string, value: string) => {
        localStorageStore[key] = String(value);
      },
      removeItem: (key: string) => {
        delete localStorageStore[key];
      },
      clear: () => {
        localStorageStore = {};
      },
      get length() {
        return Object.keys(localStorageStore).length;
      },
      key: (index: number) => Object.keys(localStorageStore)[index] ?? null,
    };
    Object.defineProperty(window, 'localStorage', { value: mockStorage, writable: true, configurable: true });
    Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, writable: true, configurable: true });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('collects actions from daily-record-* keys only', () => {
    const a1 = makeSuggestionAction({ ruleId: 'rule-1', userId: 'u1' });
    const a2 = makeSuggestionAction({ ruleId: 'rule-2', userId: 'u1' });
    const a3 = makeSuggestionAction({ ruleId: 'rule-3', userId: 'u2' });
    const ignored = makeSuggestionAction({ ruleId: 'rule-ignored', userId: 'u9' });

    localStorage.setItem(
      'daily-record-u1',
      JSON.stringify({
        rows: [
          { acceptedSuggestions: [a1] },
          { acceptedSuggestions: [a2] },
        ],
      }),
    );
    localStorage.setItem(
      'daily-record-u2',
      JSON.stringify({
        acceptedSuggestions: [a3],
      }),
    );
    localStorage.setItem(
      'another-key',
      JSON.stringify({
        acceptedSuggestions: [ignored],
      }),
    );

    const actions = collectSuggestionActions();

    expect(actions).toHaveLength(3);
    expect(actions).toEqual(expect.arrayContaining([a1, a2, a3]));
    expect(actions).not.toEqual(expect.arrayContaining([ignored]));
  });

  it('skips malformed or non-array payloads safely', () => {
    localStorage.setItem('daily-record-bad-json', '{invalid');
    localStorage.setItem(
      'daily-record-not-array',
      JSON.stringify({
        rows: [{ acceptedSuggestions: 'not-array' }],
        acceptedSuggestions: { action: 'accept' },
      }),
    );

    const actions = collectSuggestionActions();
    expect(actions).toEqual([]);
  });

  it('uses expected storage key pattern', () => {
    expect(SUGGESTION_STORAGE_KEY_PATTERN.test('daily-record-u1')).toBe(true);
    expect(SUGGESTION_STORAGE_KEY_PATTERN.test('daily-record-2026-03-26')).toBe(true);
    expect(SUGGESTION_STORAGE_KEY_PATTERN.test('daily-record')).toBe(false);
    expect(SUGGESTION_STORAGE_KEY_PATTERN.test('other-record-u1')).toBe(false);
  });
});
