import type { Schedule, ScheduleDraft } from '@/adapters/schedules/demo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listSpy = vi.fn();
const createSpy = vi.fn();
const updateSpy = vi.fn();
const removeSpy = vi.fn();
const checkConflictsSpy = vi.fn();

vi.mock('@/adapters/schedules/demo', () => ({
  list: listSpy,
  create: createSpy,
  update: updateSpy,
  remove: removeSpy,
  checkConflicts: checkConflictsSpy,
}));

const importAdapter = () => import('@/adapters/schedules/sharepoint');

describe('adapters/schedules/sharepoint', () => {
  beforeEach(() => {
    listSpy.mockReset();
    createSpy.mockReset();
    updateSpy.mockReset();
    removeSpy.mockReset();
    checkConflictsSpy.mockReset();
  });

  it('delegates list calls to the demo adapter', async () => {
    const expected: Schedule[] = [
      {
        id: 'sched-1',
        assignee: 'staff-1',
        title: '訪問',
        status: 'planned',
        start: '2025-05-01T09:00:00.000Z',
        end: '2025-05-01T10:00:00.000Z',
        createdAt: '2025-04-30T23:59:59.000Z',
        updatedAt: '2025-04-30T23:59:59.000Z',
      },
    ];
    listSpy.mockResolvedValue(expected);
    const { list } = await importAdapter();

    const result = await list('2025-05-01', { signal: new AbortController().signal });

    expect(listSpy).toHaveBeenCalledWith('2025-05-01', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(result).toBe(expected);
  });

  it('delegates create calls', async () => {
    const scheduleDraft: ScheduleDraft = {
      assignee: 'staff-1',
      title: 'Demo',
      start: '2025-05-01T09:00:00.000Z',
      end: '2025-05-01T10:00:00.000Z',
    };
    const expected: Schedule = {
      id: '123',
      assignee: 'staff-1',
      title: 'Demo',
      status: 'planned',
      start: '2025-05-01T09:00:00.000Z',
      end: '2025-05-01T10:00:00.000Z',
      createdAt: '2025-05-01T08:00:00.000Z',
      updatedAt: '2025-05-01T08:00:00.000Z',
    };
    createSpy.mockResolvedValue(expected);
    const { create } = await importAdapter();

    const result = await create(scheduleDraft, { signal: undefined });

    expect(createSpy).toHaveBeenCalledWith(scheduleDraft, { signal: undefined });
    expect(result).toBe(expected);
  });

  it('delegates update calls', async () => {
  const patch: Partial<Schedule> = { title: 'Updated' };
    const expected: Schedule = {
      id: '456',
      assignee: 'staff-2',
      title: 'Updated',
      status: 'confirmed',
      start: '2025-05-01T09:00:00.000Z',
      end: '2025-05-01T10:00:00.000Z',
      createdAt: '2025-05-01T08:00:00.000Z',
      updatedAt: '2025-05-01T08:30:00.000Z',
    };
    updateSpy.mockResolvedValue(expected);
    const { update } = await importAdapter();

  const result = await update('item-1', patch, { signal: undefined });

    expect(updateSpy).toHaveBeenCalledWith('item-1', patch, { signal: undefined });
    expect(result).toBe(expected);
  });

  it('delegates remove calls', async () => {
    removeSpy.mockResolvedValue(undefined);
    const { remove } = await importAdapter();

    await remove('item-2', { signal: undefined });

    expect(removeSpy).toHaveBeenCalledWith('item-2', { signal: undefined });
  });

  it('delegates conflict checks', async () => {
  checkConflictsSpy.mockResolvedValue(true);
    const { checkConflicts } = await importAdapter();

    const result = await checkConflicts('user', '2025-05-01T09:00', '2025-05-01T10:00', { signal: undefined });

    expect(checkConflictsSpy).toHaveBeenCalledWith('user', '2025-05-01T09:00', '2025-05-01T10:00', { signal: undefined });
    expect(result).toBe(true);
  });
});
