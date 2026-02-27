import type { Schedule } from '@/adapters/schedules/demo';
import { beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    isDemoModeEnabled: vi.fn(() => false),
    allowWriteFallback: vi.fn(() => true),
  };
});

vi.mock('@/lib/errors', async () => {
  const actual = await vi.importActual<typeof import('@/lib/errors')>('@/lib/errors');
  return {
    ...actual,
    toSafeError: (error: unknown) => {
      const asObject = (value: unknown): Record<string, unknown> | null =>
        typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
      const source = asObject(error);
      const code = typeof source?.code === 'string' ? source.code : undefined;
      const message = typeof source?.message === 'string' ? source.message : String(error);
      const userMessage = typeof source?.userMessage === 'string' ? source.userMessage : undefined;
      return { code, message, userMessage };
    },
  };
});

vi.mock('@/lib/notice', () => ({
  withUserMessage: (error: { message?: string; userMessage?: string }) => ({
    ...error,
    userMessage: error.userMessage ?? error.message,
  }),
}));

const demo = {
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  checkConflicts: vi.fn(),
};

const sharepoint = {
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  checkConflicts: vi.fn(),
};

vi.mock('@/adapters/schedules/demo', () => demo);
vi.mock('@/adapters/schedules/sharepoint', () => sharepoint);

const env = await import('@/lib/env');
const isDemoModeEnabled = env.isDemoModeEnabled as unknown as Mock;
const allowWriteFallback = env.allowWriteFallback as unknown as Mock;

let service: typeof import('@/adapters/schedules/index');

const asError = (message: string, code?: string) => Object.assign(new Error(message), { code });

const sampleSchedule: Schedule = {
  id: 'sched-1',
  assignee: 'staff-001',
  title: 'Visit',
  status: 'planned',
  note: 'note',
  start: '2025-01-10T09:00:00.000Z',
  end: '2025-01-10T10:00:00.000Z',
  createdAt: '2025-01-09T00:00:00.000Z',
  updatedAt: '2025-01-09T00:00:00.000Z',
};

describe('schedules service', () => {
  beforeAll(async () => {
    service = await import('@/adapters/schedules/index');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    service.__resetSchedulesWarningForTest();

    isDemoModeEnabled.mockReturnValue(false);
    allowWriteFallback.mockReturnValue(true);

    demo.list.mockResolvedValue([sampleSchedule]);
    demo.create.mockResolvedValue(sampleSchedule);
    demo.update.mockResolvedValue(sampleSchedule);
    demo.remove.mockResolvedValue(undefined);
    demo.checkConflicts.mockResolvedValue(false);

    sharepoint.list.mockResolvedValue([sampleSchedule]);
    sharepoint.create.mockResolvedValue(sampleSchedule);
    sharepoint.update.mockResolvedValue(sampleSchedule);
    sharepoint.remove.mockResolvedValue(undefined);
    sharepoint.checkConflicts.mockResolvedValue(false);

    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('routes all operations to demo adapter when demo mode is enabled', async () => {
    isDemoModeEnabled.mockReturnValue(true);

    const listResult = await service.list('2025-01-10');
    expect(listResult).toEqual({ items: [sampleSchedule], source: 'demo' });
    expect(sharepoint.list).not.toHaveBeenCalled();

    const createResult = await service.create(sampleSchedule);
    expect(createResult.source).toBe('demo');
    expect(sharepoint.create).not.toHaveBeenCalled();
  });

  it('throws on invalid day ISO before reaching SharePoint', async () => {
    await expect(service.list('2025-1-1')).rejects.toThrow(/invalid dayISO/);
    expect(sharepoint.list).not.toHaveBeenCalled();
    expect(demo.list).not.toHaveBeenCalled();
  });

  it('falls back to demo list when SharePoint fails and classifies timeout errors', async () => {
    sharepoint.list.mockRejectedValue(asError('timeout while fetch', 'ETIMEDOUT'));

    const result = await service.list('2025-01-10');

    expect(result.source).toBe('demo');
    expect(result.fallbackKind).toBe('timeout');
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('throws immediately when the abort signal is already cancelled', async () => {
    sharepoint.list.mockRejectedValue(asError('network down'));

    const controller = new AbortController();
    Object.defineProperty(controller.signal, 'aborted', { configurable: true, value: true });

    await expect(service.list('2025-01-10', { signal: controller.signal })).rejects.toMatchObject({ message: 'network down' });
    expect(demo.list).not.toHaveBeenCalled();
  });

  it('falls back to demo create when write fallback is allowed and classifies schema errors', async () => {
    sharepoint.create.mockRejectedValue(asError('Property Title does not exist on type', 'E_SCHEMA'));
    allowWriteFallback.mockReturnValue(true);

    const result = await service.create(sampleSchedule);

    expect(result.source).toBe('demo');
    expect(result.fallbackKind).toBe('schema');
    expect(demo.create).toHaveBeenCalled();
  });

  it('propagates SharePoint errors when write fallback is disabled', async () => {
    sharepoint.create.mockRejectedValue(asError('login_required', 'E_AUTH'));
    allowWriteFallback.mockReturnValue(false);

    await expect(service.create(sampleSchedule)).rejects.toMatchObject({ message: 'login_required' });
    expect(demo.create).not.toHaveBeenCalled();
  });

  it('falls back for update, remove, and conflict checks when SharePoint fails', async () => {
    sharepoint.update.mockRejectedValue(asError('503 Service Unavailable'));
    sharepoint.remove.mockRejectedValue(asError('504 Gateway Timeout'));
    sharepoint.checkConflicts.mockRejectedValue(asError('interaction_required'));

    const updated = await service.update('sched-1', { title: 'Updated' });
    expect(updated).toEqual(sampleSchedule);

    await expect(service.remove('sched-1')).resolves.toBeUndefined();

    const conflicts = await service.checkConflicts('staff-001', sampleSchedule.start, sampleSchedule.end);
    expect(conflicts).toBe(false);
  });

  it('returns appropriate fallbackKind classifications', async () => {
    sharepoint.list
      .mockRejectedValueOnce(asError('AADSTS70011 invalid scope'))
      .mockRejectedValueOnce(asError('503 retry later'))
      .mockRejectedValueOnce(asError('field is invalid'))
      .mockRejectedValueOnce(asError('totally weird'));

    const auth = await service.list('2025-01-10');
    expect(auth.fallbackKind).toBe('auth');

    const network = await service.list('2025-01-10');
    expect(network.fallbackKind).toBe('network');

    const schema = await service.list('2025-01-10');
    expect(schema.fallbackKind).toBe('schema');

    const unknown = await service.list('2025-01-10');
    expect(unknown.fallbackKind).toBe('unknown');
  });

  it('warns only once per message-classification pair and resets after clearing cache', async () => {
    sharepoint.list.mockRejectedValue(asError('timeout while fetch'));

    await service.list('2025-01-10');
    await service.list('2025-01-10');
    expect(console.warn).toHaveBeenCalledTimes(1);

    service.__resetSchedulesWarningForTest();

    await service.list('2025-01-10');
    expect(console.warn).toHaveBeenCalledTimes(2);
  });
});
