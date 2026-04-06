/**
 * dailyOps — createDailyOpsSignalsPort (Factory) テスト
 *
 * 対象:
 *   - createDailyOpsSignalsPort  shouldSkipSharePoint による SP / demo 切替
 *
 * テスト設計書: docs/test-design/dailyOps.md
 */
import { describe, it, expect, vi } from 'vitest';

// shouldSkipSharePoint をモック（hoisting 対応: ファイル先頭で宣言）
vi.mock('@/lib/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/env')>()),
  shouldSkipSharePoint: vi.fn(),
}));

// SP クライアント初期化 (ensureConfig) を防ぐ
vi.mock('@/lib/spClient', () => ({
  createSpClient: vi.fn(),
  ensureConfig: vi.fn(() => ({ baseUrl: 'https://example.sharepoint.com/_api/web' })),
}));

import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { shouldSkipSharePoint } from '@/lib/env';
import { createDailyOpsSignalsPort } from '../dailyOpsSignalsFactory';

const dummyProvider = {} as IDataProvider;

describe('createDailyOpsSignalsPort', () => {
  it('should return a port that delegates to the provider', async () => {
    const mockProvider = {
      listItems: vi.fn().mockResolvedValue([]),
      updateItem: vi.fn().mockResolvedValue({}),
    } as unknown as IDataProvider;

    const port = createDailyOpsSignalsPort(mockProvider);
    
    await port.listByDate('2026-03-18');
    expect(mockProvider.listItems).toHaveBeenCalled();
    
    await port.setStatus(1, 'Resolved');
    expect(mockProvider.updateItem).toHaveBeenCalled();
  });

  it('should return SP-backed port when shouldSkipSharePoint is false', () => {
    vi.mocked(shouldSkipSharePoint).mockReturnValue(false);

    const port = createDailyOpsSignalsPort(dummyProvider);

    // SP port は listByDate / upsert / setStatus を持つ
    expect(typeof port.listByDate).toBe('function');
    expect(typeof port.upsert).toBe('function');
    expect(typeof port.setStatus).toBe('function');
  });
});
