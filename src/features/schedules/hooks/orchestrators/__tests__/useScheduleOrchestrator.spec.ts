import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CreateScheduleInput, ScheduleRepository } from '../../../domain/ScheduleRepository';
import { useScheduleOrchestrator } from '../useScheduleOrchestrator';

const saveAudit = vi.fn();

vi.mock('@/features/telemetry/repositories/FirestoreAuditRepository', () => ({
  auditRepository: {
    save: (...args: unknown[]) => saveAudit(...args),
    resolve: vi.fn(),
  },
}));

const input: CreateScheduleInput = {
  title: '永続化確認',
  category: 'Staff',
  startLocal: '2026-07-13T10:00:00',
  endLocal: '2026-07-13T11:00:00',
  assignedStaffId: '1',
};

describe('useScheduleOrchestrator', () => {
  beforeEach(() => {
    saveAudit.mockReset();
    saveAudit.mockResolvedValue(undefined);
  });

  it('delegates creation to the injected mutation callback', async () => {
    const repository = {
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      list: vi.fn(),
    } as unknown as ScheduleRepository;
    const createSchedule = vi.fn().mockResolvedValue({ id: 'created-1' });
    const showSnack = vi.fn();
    const onSuccess = vi.fn();

    const { result } = renderHook(() =>
      useScheduleOrchestrator({ repository, createSchedule, showSnack, onSuccess }),
    );

    await act(async () => {
      await result.current.handleCreateSchedule(input);
    });

    expect(createSchedule).toHaveBeenCalledWith(input);
    expect(repository.create).not.toHaveBeenCalled();
    expect(saveAudit).toHaveBeenCalledTimes(1);
    expect(showSnack).toHaveBeenCalledWith('success', 'スケジュールを作成しました');
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
