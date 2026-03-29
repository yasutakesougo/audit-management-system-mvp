/**
 * Daily no-direct-sp — regression guard
 *
 * Ensures Daily feature does NOT bypass Repository pattern by calling
 * spClient or @pnp/sp directly.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSpClient = vi.hoisted(() => ({
  getSp: vi.fn(),
  getSpClient: vi.fn(),
}));

vi.mock('@/lib/spClient', () => mockSpClient);

import {
    getDailyRecordRepository,
    resetDailyRecordRepository,
} from '@/features/daily/repositoryFactory';

describe('Daily no-direct-sp guard', () => {
  beforeEach(() => {
    resetDailyRecordRepository();
    vi.clearAllMocks();
  });

  it('demo init does not call spClient', () => {
    getDailyRecordRepository();
    expect(mockSpClient.getSp).not.toHaveBeenCalled();
    expect(mockSpClient.getSpClient).not.toHaveBeenCalled();
  });

  it('demo load() does not call spClient', async () => {
    const repo = getDailyRecordRepository();
    await repo.load('2026-03-01');
    expect(mockSpClient.getSp).not.toHaveBeenCalled();
    expect(mockSpClient.getSpClient).not.toHaveBeenCalled();
  });
});
