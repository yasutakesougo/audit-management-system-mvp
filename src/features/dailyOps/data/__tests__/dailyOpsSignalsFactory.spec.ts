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
vi.mock('@/lib/env', () => ({
  shouldSkipSharePoint: vi.fn(),
}));

// SP クライアント初期化 (ensureConfig) を防ぐ
vi.mock('@/lib/spClient', () => ({
  createSpClient: vi.fn(),
  ensureConfig: vi.fn(() => ({ baseUrl: 'https://example.sharepoint.com/_api/web' })),
}));

import { shouldSkipSharePoint } from '@/lib/env';
import { createDailyOpsSignalsPort } from '../dailyOpsSignalsFactory';

const dummyAcquireToken = async (): Promise<string | null> => null;

describe('createDailyOpsSignalsPort', () => {
  it('should return demo port (listByDate → []) when shouldSkipSharePoint is true', async () => {
    vi.mocked(shouldSkipSharePoint).mockReturnValue(true);

    const port = createDailyOpsSignalsPort(dummyAcquireToken);
    const result = await port.listByDate('2026-03-18');

    expect(result).toEqual([]);
  });

  it('should return demo port (setStatus → void) when shouldSkipSharePoint is true', async () => {
    vi.mocked(shouldSkipSharePoint).mockReturnValue(true);

    const port = createDailyOpsSignalsPort(dummyAcquireToken);
    // demo port は何も投げない
    await expect(port.setStatus(1, 'Resolved')).resolves.toBeUndefined();
  });

  it('should return SP-backed port when shouldSkipSharePoint is false', () => {
    vi.mocked(shouldSkipSharePoint).mockReturnValue(false);

    const port = createDailyOpsSignalsPort(dummyAcquireToken);

    // SP port は listByDate / upsert / setStatus を持つ
    expect(typeof port.listByDate).toBe('function');
    expect(typeof port.upsert).toBe('function');
    expect(typeof port.setStatus).toBe('function');
  });
});
