import type { SafeError } from '@/lib/errors';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type ListResult = {
  items: Array<Record<string, unknown>>;
  source: 'demo' | 'sharepoint';
  fallbackKind?: 'network' | 'auth' | 'schema' | 'unknown';
  fallbackError?: SafeError | null;
};

const listMock = vi.fn<
  (dayISO?: string, options?: { signal?: AbortSignal }) => Promise<ListResult | Array<Record<string, unknown>>>
>();
const featureFlagMock = vi.fn<() => boolean>();
const formatInTimeZoneMock = vi.fn<(value: Date | string, tz: string, pattern: string) => string>();

vi.mock('@/adapters/schedules', () => ({
  list: listMock,
}));

vi.mock('@/lib/env', () => ({
  isSchedulesFeatureEnabled: featureFlagMock,
}));

vi.mock('@/lib/tz', () => ({
  formatInTimeZone: formatInTimeZoneMock,
}));

const importHook = async () => {
  vi.resetModules();
  const mod = await import('@/features/schedule/useSchedulesToday');
  return mod.useSchedulesToday;
};

const flushAsync = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

beforeEach(() => {
  listMock.mockReset();
  featureFlagMock.mockReset();
  formatInTimeZoneMock.mockReset();
  featureFlagMock.mockReturnValue(true);
  formatInTimeZoneMock.mockImplementation((value: Date | string, _tz: string, pattern: string) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error('invalid date');
    }
    if (pattern === 'HH:mm') {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    return date.toISOString();
  });
});

describe('useSchedulesToday', () => {
  it('returns empty data when schedules feature is disabled', async () => {
    featureFlagMock.mockReturnValue(false);
    const useSchedulesToday = await importHook();
    const { result } = renderHook(() => useSchedulesToday());

    await flushAsync();

    expect(listMock).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual([]);
  });

  it('maps schedule rows into mini schedules with fallback metadata', async () => {
  const fallbackError: SafeError = { name: 'SafeError', message: 'network', code: '503' };
    listMock.mockResolvedValue({
      items: [
        {
          id: 30,
          title: '全日イベント',
          allDay: true,
          startUtc: '2025-05-03T00:00:00.000Z',
          statusLabel: '承認済み',
        },
        {
          Id: 31,
          startLocal: '2025-05-03T09:30:00+09:00',
          title: '  ',
          status: 'pending',
        },
        {
          id: 'invalid',
          start: 'not-a-date',
          title: '',
        },
        {
          id: '32',
          startLocal: '2025-05-03T10:45:00+09:00',
          statusLabel: '進行中',
        },
      ],
      source: 'sharepoint',
      fallbackKind: 'network',
      fallbackError,
    });

    formatInTimeZoneMock.mockImplementationOnce(() => {
      throw new Error('tz failure');
    });

  const useSchedulesToday = await importHook();
  const { result } = renderHook(() => useSchedulesToday(4));

    await flushAsync();

    expect(listMock).toHaveBeenCalledWith(result.current.dateISO, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(result.current.source).toBe('sharepoint');
    expect(result.current.fallbackKind).toBe('network');
    expect(result.current.fallbackError).toBe(fallbackError);
    expect(result.current.data).toEqual([
      {
        id: 30,
        title: '全日イベント',
        startText: '終日',
        status: '承認済み',
        allDay: true,
      },
      {
        id: 31,
        title: '予定',
        startText: '09:30',
        status: 'pending',
        allDay: false,
      },
      {
        id: 32,
        title: '予定',
        startText: '10:45',
        status: '進行中',
        allDay: false,
      },
      {
        id: 4,
        title: '予定',
        startText: '—',
        status: undefined,
        allDay: false,
      },
    ]);
  });

  it('falls back to Asia/Tokyo time formatting when formatter throws', async () => {
    listMock.mockResolvedValue({
      items: [
        {
          id: 40,
          startLocal: '2025-05-03T09:30:00+09:00',
          title: 'フォールバック確認',
        },
      ],
      source: 'sharepoint',
    });

    formatInTimeZoneMock.mockImplementation(() => {
      throw new Error('formatter unavailable');
    });

    const useSchedulesToday = await importHook();
    const { result } = renderHook(() => useSchedulesToday());

    await flushAsync();

    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual([
      expect.objectContaining({
        id: 40,
        title: 'フォールバック確認',
        startText: '09:30',
      }),
    ]);
  });

  it('defaults to demo source when adapter returns raw array', async () => {
    const rows = [
      { id: 1, startLocal: '2025-05-04T08:00:00+09:00', title: 'デモ予定' },
    ];
    listMock.mockResolvedValue(rows);

    const useSchedulesToday = await importHook();
    const { result } = renderHook(() => useSchedulesToday());

    await flushAsync();

    expect(result.current.source).toBe('demo');
    expect(result.current.data[0]).toMatchObject({ id: 1, title: 'デモ予定' });
  });

  it('captures errors from schedule adapter', async () => {
    listMock.mockRejectedValue(new Error('adapter failed'));

    const useSchedulesToday = await importHook();
    const { result } = renderHook(() => useSchedulesToday());

    await flushAsync();

    expect(result.current.loading).toBe(false);
    expect(result.current.error?.message).toBe('adapter failed');
  });

  it('ignores abort errors and stops loading', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    listMock.mockRejectedValue(abortError);

    const useSchedulesToday = await importHook();
    const { result } = renderHook(() => useSchedulesToday());

    await flushAsync();

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
