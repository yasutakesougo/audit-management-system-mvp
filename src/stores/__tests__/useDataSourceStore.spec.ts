import { describe, it, expect, beforeEach } from 'vitest';
import {
  useDataSourceStore,
  selectHasFallback,
  selectFallbackSources,
  selectSummary,
} from '../useDataSourceStore';

describe('useDataSourceStore', () => {
  beforeEach(() => {
    useDataSourceStore.getState().clearAll();
  });

  it('starts with empty sources', () => {
    const state = useDataSourceStore.getState();
    expect(state.sources).toEqual({});
    expect(selectHasFallback(state)).toBe(false);
  });

  it('report() adds a data source entry with timestamp', () => {
    const { report } = useDataSourceStore.getState();

    report('holidays', { label: '祝日マスタ', status: 'live' });

    const state = useDataSourceStore.getState();
    expect(state.sources.holidays).toBeDefined();
    expect(state.sources.holidays.label).toBe('祝日マスタ');
    expect(state.sources.holidays.status).toBe('live');
    expect(state.sources.holidays.updatedAt).toBeTruthy();
  });

  it('report() updates existing entry', () => {
    const { report } = useDataSourceStore.getState();

    report('holidays', { label: '祝日マスタ', status: 'live' });
    report('holidays', { label: '祝日マスタ', status: 'fallback', reason: '通信エラー' });

    const state = useDataSourceStore.getState();
    expect(state.sources.holidays.status).toBe('fallback');
    expect(state.sources.holidays.reason).toBe('通信エラー');
  });

  it('selectHasFallback returns true when any source is fallback', () => {
    const { report } = useDataSourceStore.getState();

    report('holidays', { label: '祝日マスタ', status: 'live' });
    report('schedules', { label: 'スケジュール', status: 'fallback' });

    expect(selectHasFallback(useDataSourceStore.getState())).toBe(true);
  });

  it('selectHasFallback returns false when all sources are live', () => {
    const { report } = useDataSourceStore.getState();

    report('holidays', { label: '祝日マスタ', status: 'live' });
    report('schedules', { label: 'スケジュール', status: 'live' });

    expect(selectHasFallback(useDataSourceStore.getState())).toBe(false);
  });

  it('selectFallbackSources returns only fallback entries', () => {
    const { report } = useDataSourceStore.getState();

    report('holidays', { label: '祝日マスタ', status: 'live' });
    report('schedules', { label: 'スケジュール', status: 'fallback' });
    report('users', { label: '利用者マスタ', status: 'fallback', reason: 'デモデータ' });

    const fallbacks = selectFallbackSources(useDataSourceStore.getState());
    expect(fallbacks).toHaveLength(2);
    expect(fallbacks.map((f) => f.label)).toEqual(
      expect.arrayContaining(['スケジュール', '利用者マスタ']),
    );
  });

  it('selectSummary provides correct counts', () => {
    const { report } = useDataSourceStore.getState();

    report('holidays', { label: '祝日マスタ', status: 'live' });
    report('schedules', { label: 'スケジュール', status: 'fallback' });
    report('users', { label: '利用者マスタ', status: 'loading' });
    report('staff', { label: '職員', status: 'error' });

    const summary = selectSummary(useDataSourceStore.getState());
    expect(summary).toEqual({
      total: 4,
      live: 1,
      fallback: 1,
      loading: 1,
      error: 1,
    });
  });

  it('clear() removes a specific source', () => {
    const { report, clear } = useDataSourceStore.getState();

    report('holidays', { label: '祝日マスタ', status: 'live' });
    report('schedules', { label: 'スケジュール', status: 'fallback' });

    clear('holidays');

    const state = useDataSourceStore.getState();
    expect(state.sources.holidays).toBeUndefined();
    expect(state.sources.schedules).toBeDefined();
  });

  it('clearAll() removes all sources', () => {
    const { report, clearAll } = useDataSourceStore.getState();

    report('holidays', { label: '祝日マスタ', status: 'live' });
    report('schedules', { label: 'スケジュール', status: 'fallback' });

    clearAll();

    const state = useDataSourceStore.getState();
    expect(state.sources).toEqual({});
  });
});
