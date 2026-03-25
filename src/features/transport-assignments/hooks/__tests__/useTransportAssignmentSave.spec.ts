import type { UpdateScheduleEventInput } from '@/features/schedules/data/port';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTransportAssignmentSave } from '../useTransportAssignmentSave';

const mkPayload = (id: string): UpdateScheduleEventInput => ({
  id,
  etag: '"1"',
  title: '送迎',
  category: 'User',
  startLocal: '2026-03-25T09:00:00+09:00',
  endLocal: '2026-03-25T09:30:00+09:00',
  userId: 'U001',
  userName: '田中太郎',
});

describe('useTransportAssignmentSave', () => {
  it('updates schedules then refetches on save success', async () => {
    const updateSchedule = vi.fn(async () => undefined);
    const refetchSchedules = vi.fn();

    const { result } = renderHook(() =>
      useTransportAssignmentSave({ updateSchedule, refetchSchedules }),
    );

    await act(async () => {
      const saveResult = await result.current.save([mkPayload('row-1'), mkPayload('row-2')]);
      expect(saveResult).toEqual({ success: true, updatedCount: 2 });
    });

    expect(updateSchedule).toHaveBeenCalledTimes(2);
    expect(refetchSchedules).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('success');
    expect(result.current.lastSavedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.current.error).toBeNull();
  });

  it('sets error status when update fails', async () => {
    const updateSchedule = vi.fn(async () => {
      throw new Error('update failed');
    });
    const refetchSchedules = vi.fn();

    const { result } = renderHook(() =>
      useTransportAssignmentSave({ updateSchedule, refetchSchedules }),
    );

    await act(async () => {
      const saveResult = await result.current.save([mkPayload('row-1')]);
      expect(saveResult.success).toBe(false);
    });

    expect(refetchSchedules).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
    expect((result.current.error as Error).message).toBe('update failed');
  });

  it('returns success with no-op when payload is empty', async () => {
    const updateSchedule = vi.fn(async () => undefined);
    const refetchSchedules = vi.fn();

    const { result } = renderHook(() =>
      useTransportAssignmentSave({ updateSchedule, refetchSchedules }),
    );

    await act(async () => {
      const saveResult = await result.current.save([]);
      expect(saveResult).toEqual({ success: true, updatedCount: 0 });
    });

    expect(updateSchedule).not.toHaveBeenCalled();
    expect(refetchSchedules).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });
});
