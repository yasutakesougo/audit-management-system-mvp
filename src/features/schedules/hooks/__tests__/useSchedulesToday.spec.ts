import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ScheduleRepositoryListParams } from '../../domain/ScheduleRepository';

// vi.hoisted lets us define the spy BEFORE vi.mock hoisting
const { mockList, mockRepository } = vi.hoisted(() => {
  const list = vi.fn(async (_params: ScheduleRepositoryListParams) => [
    {
      id: '1',
      title: '朝のミーティング',
      start: '2026-03-01T09:00:00+09:00',
      end: '2026-03-01T10:00:00+09:00',
      allDay: false,
      status: 'Planned',
      etag: '',
    },
  ]);
  return {
    mockList: list,
    // Stable reference — returned by useScheduleRepository on every call
    mockRepository: {
      list,
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    },
  };
});

// ── Lightweight mocks ────────────────────────────────────────────────
// Mock env — must come before hook import
vi.mock('@/lib/env', () => ({
  isSchedulesFeatureEnabled: vi.fn(() => true),
  shouldSkipSharePoint: vi.fn(() => false),
  isDemoModeEnabled: vi.fn(() => true),
  getAppConfig: vi.fn(() => ({ isDev: true })),
  isForceDemoEnabled: vi.fn(() => true),
  isTestMode: vi.fn(() => true),
  shouldSkipLogin: vi.fn(() => true),
}));

vi.mock('@/hydration/features', () => ({
  HYDRATION_FEATURES: { schedules: { load: 'schedules.load' } },
  estimatePayloadSize: vi.fn(() => 0),
  startFeatureSpan: vi.fn(() => vi.fn()),
}));

vi.mock('@/features/dashboard/logic/syncGuardrails', () => ({
  calculateRetryAfterTimestamp: vi.fn(() => 0),
  getNextCooldownTimestamp: vi.fn(() => 0),
}));

vi.mock('@/lib/tz', () => ({
  formatInTimeZone: vi.fn((_date: Date, _tz: string, _fmt: string) => '09:00'),
}));

// ── KEY FIX: Mock repositoryFactory directly ─────────────────────────
// Previously, individual infra modules (SharePointScheduleRepository,
// InMemoryScheduleRepository) were mocked, but repositoryFactory itself
// was NOT mocked, causing Vitest to resolve the full transitive import
// chain: repositoryFactory → @/env → import.meta, and
// repositoryFactory → SharePointScheduleRepository → spClient
// → msal, which exhausted worker memory (OOM).
//
// By mocking the factory at the boundary, we cut off the entire heavy
// dependency graph. This matches the pattern used by useAttendance.spec.ts
// and useTableDailyRecordViewModel.spec.ts.
vi.mock('../../repositoryFactory', () => ({
  useScheduleRepository: vi.fn(() => mockRepository),
  getCurrentScheduleRepositoryKind: vi.fn(() => 'demo'),
}));

import { useSchedulesToday } from '../useSchedulesToday';

describe('useSchedulesToday (Repository integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls repository.list() with a DateRange', async () => {
    const { result } = renderHook(() => useSchedulesToday(5));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Verify repository.list was called (not the legacy adapter)
    expect(mockList).toHaveBeenCalledTimes(1);
    const callArgs = mockList.mock.calls[0][0];
    expect(callArgs).toHaveProperty('range');
    expect(callArgs.range).toHaveProperty('from');
    expect(callArgs.range).toHaveProperty('to');
    expect(callArgs.range.from).toContain('T00:00:00+09:00');
    expect(callArgs.range.to).toContain('T23:59:59+09:00');
  });

  it('maps ScheduleItem to MiniSchedule correctly', async () => {
    const { result } = renderHook(() => useSchedulesToday(5));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toHaveLength(1);
    const mini = result.current.data[0];
    expect(mini).toEqual({
      id: 1,
      title: '朝のミーティング',
      startText: '09:00',
      endText: '09:00',
      status: 'Planned',
      allDay: false,
    });
  });

  it('returns source from repositoryFactory kind', async () => {
    const { result } = renderHook(() => useSchedulesToday(5));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.source).toBe('demo');
  });

  it('returns null for deprecated fallbackKind/fallbackError', async () => {
    const { result } = renderHook(() => useSchedulesToday(5));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.fallbackKind).toBeNull();
    expect(result.current.fallbackError).toBeNull();
  });
});
