import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDataProviderObservabilityStore, reportResourceResolution } from '../data/dataProviderObservabilityStore';

describe('DataProviderObservabilityStore Idempotency', () => {
  beforeEach(() => {
    useDataProviderObservabilityStore.getState().clearResolutions();
    useDataProviderObservabilityStore.setState({ currentProvider: null, currentUser: null });
  });

  it('setProvider should not trigger update if values are identical', () => {
    const store = useDataProviderObservabilityStore.getState();
    const subscribeMock = vi.fn();
    
    // ストアの変更を購読
    const unsubscribe = useDataProviderObservabilityStore.subscribe(subscribeMock);

    // 1回目の更新
    store.setProvider('sharepoint');
    expect(subscribeMock).toHaveBeenCalledTimes(1);
    expect(useDataProviderObservabilityStore.getState().currentProvider).toBe('sharepoint');

    // 2回目：同じ値での更新 -> 通知されないはず
    store.setProvider('sharepoint');
    expect(subscribeMock).toHaveBeenCalledTimes(1); // カウントが増えていないことを検証

    unsubscribe();
  });

  it('reportResourceResolution should skip update for identical reports', async () => {
    const report = {
      resourceName: 'Users_Master',
      resolvedTitle: '利用者マスタ',
      fieldStatus: {
        'ID': { resolvedName: 'ID', candidates: ['ID'] },
        'Title': { resolvedName: 'Title', candidates: ['Title'] }
      },
      essentials: ['ID']
    };

    const subscribeMock = vi.fn();
    const unsubscribe = useDataProviderObservabilityStore.subscribe(subscribeMock);

    // 💡 reportResourceResolution は非同期 (setTimeout 0) なので、
    // vitest の fakeTimers または await で待つ必要がある

    // 1回目の解決報告
    reportResourceResolution(report);
    
    // 非同期更新を待つ
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(subscribeMock).toHaveBeenCalledTimes(1);

    // 2回目の同じ解決報告 -> 既にガードで同値と判定され、setTimeout すら呼ばれないはず
    reportResourceResolution(report);
    
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(subscribeMock).toHaveBeenCalledTimes(1); // 1回目のままであることを検証

    unsubscribe();
  });

  it('reportResourceResolution should trigger update if status changes', async () => {
    const baseReport = {
      resourceName: 'Users_Master',
      resolvedTitle: '利用者マスタ',
      fieldStatus: { 'ID': { resolvedName: 'ID', candidates: ['ID'] } },
      essentials: ['ID']
    };

    reportResourceResolution(baseReport);
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const storeAfterFirst = useDataProviderObservabilityStore.getState().resolutions['Users_Master'];
    expect(storeAfterFirst?.status).toBe('resolved');

    // 状態が変化（必須フィールド欠損など）した場合は通知される
    const errorReport = {
      ...baseReport,
      fieldStatus: { 'ID': { resolvedName: undefined, candidates: ['ID'] } },
    };
    
    reportResourceResolution(errorReport);
    await new Promise(resolve => setTimeout(resolve, 10));

    const storeAfterSecond = useDataProviderObservabilityStore.getState().resolutions['Users_Master'];
    expect(storeAfterSecond?.status).toBe('missing_required');
  });

  it('reportResourceResolution should persist httpStatus on failures', async () => {
    reportResourceResolution({
      resourceName: 'ISP_Master',
      resolvedTitle: 'ISP_Master',
      fieldStatus: {},
      essentials: ['Title'],
      error: 'Forbidden',
      httpStatus: 403,
    });
    await new Promise(resolve => setTimeout(resolve, 10));

    const state = useDataProviderObservabilityStore.getState().resolutions['ISP_Master'];
    expect(state?.status).toBe('missing_required');
    expect(state?.httpStatus).toBe(403);
    expect(state?.error).toBe('Forbidden');
  });

  it('setCurrentUser should update currentUser and skip redundant updates', () => {
    const store = useDataProviderObservabilityStore.getState();
    const subscribeMock = vi.fn();
    const unsubscribe = useDataProviderObservabilityStore.subscribe(subscribeMock);

    store.setCurrentUser('kiosk@tenant.onmicrosoft.com');
    expect(useDataProviderObservabilityStore.getState().currentUser).toBe('kiosk@tenant.onmicrosoft.com');
    expect(subscribeMock).toHaveBeenCalledTimes(1);

    store.setCurrentUser('kiosk@tenant.onmicrosoft.com');
    expect(subscribeMock).toHaveBeenCalledTimes(1);

    unsubscribe();
  });
});
