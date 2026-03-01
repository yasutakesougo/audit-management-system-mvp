/**
 * Schedules — Direct SP regression guard
 *
 * Ensures that schedules feature hooks do NOT make direct spFetch / spClient
 * calls outside the Repository layer. If a future change reintroduces
 * direct SP access (bypassing Repository), these tests will catch it.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted runs BEFORE vi.mock hoisting
const { spClientSpy, mockList } = vi.hoisted(() => ({
  spClientSpy: {
    createSpClient: vi.fn(),
    ensureConfig: vi.fn(),
  },
  mockList: vi.fn(async () => []),
}));

vi.mock('@/lib/spClient', () => spClientSpy);

vi.mock('@/lib/env', () => ({
  getAppConfig: vi.fn(() => ({ isDev: true })),
  isDemoModeEnabled: vi.fn(() => true),
  isForceDemoEnabled: vi.fn(() => true),
  isTestMode: vi.fn(() => true),
  shouldSkipLogin: vi.fn(() => true),
}));

vi.mock('@/lib/runtime', () => ({
  hasSpfxContext: vi.fn(() => false),
}));

// Break transitive import chain
vi.mock('@/features/schedules/infra/SharePointScheduleRepository', () => ({
  SharePointScheduleRepository: vi.fn(),
}));

vi.mock('@/features/schedules/infra/InMemoryScheduleRepository', () => ({
  inMemoryScheduleRepository: {
    list: mockList,
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: vi.fn(() => ({ acquireToken: vi.fn(async () => null) })),
}));

import {
    getScheduleRepository,
    resetScheduleRepository,
} from '@/features/schedules/repositoryFactory';

describe('schedules: no direct SP access', () => {
  beforeEach(() => {
    resetScheduleRepository();
    spClientSpy.createSpClient.mockClear();
    spClientSpy.ensureConfig.mockClear();
  });

  it('getScheduleRepository() in demo mode does not call spClient', () => {
    const repo = getScheduleRepository();
    expect(repo).toBeTruthy();
    expect(spClientSpy.createSpClient).not.toHaveBeenCalled();
    expect(spClientSpy.ensureConfig).not.toHaveBeenCalled();
  });

  it('demo repo.list() does not call spClient', async () => {
    const repo = getScheduleRepository();
    const items = await repo.list({
      range: {
        from: '2026-01-01T00:00:00+09:00',
        to: '2026-01-07T00:00:00+09:00',
      },
    });

    expect(Array.isArray(items)).toBe(true);
    expect(spClientSpy.createSpClient).not.toHaveBeenCalled();
  });
});
