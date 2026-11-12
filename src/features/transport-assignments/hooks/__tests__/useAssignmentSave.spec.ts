import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssignmentRepository, TransportAssignment } from '@/features/schedules/domain/assignment';
import type { TransportAssignmentDraft } from '../../domain/transportAssignmentDraft';
import {
  AssignmentPartialSaveError,
  loadUnresolvedAssignmentSaves,
  type AssignmentSaveReport,
} from '@/features/schedules/infra/assignmentSaveReport';
import { AssignmentSaveBlockedError, useAssignmentSave } from '../useAssignmentSave';

const draft: TransportAssignmentDraft = {
  date: '2026-11-11',
  direction: 'to',
  vehicles: [
    {
      vehicleId: '車両1',
      courseId: null,
      courseLabel: null,
      driverStaffId: 'S001',
      driverName: '佐藤 運転',
      attendantStaffId: 'S002',
      attendantName: '鈴木 添乗',
      riderUserIds: [],
    },
  ],
  unassignedUserIds: ['U002'],
  users: [],
};

function repositoryWith(saveBulk: AssignmentRepository['saveBulk']): AssignmentRepository {
  return {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    saveBulk,
  } as unknown as AssignmentRepository;
}

function transportAssignment(userId: string, start: string, direction: 'to' | 'from'): TransportAssignment {
  return {
    id: `transport-${userId}-${start}`,
    type: 'transport',
    start,
    end: start,
    title: '送迎',
    status: 'planned',
    vehicleId: '車両1',
    driverId: 'S001',
    assistantStaffIds: [],
    userIds: [userId],
    direction,
  };
}

describe('useAssignmentSave', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not report success when the unassign update fails', async () => {
    const repository = {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      saveBulk: vi.fn().mockRejectedValue(new Error('boom')),
    } as unknown as AssignmentRepository;

    const { result } = renderHook(() => useAssignmentSave(repository));

    let saved: { success: boolean } | undefined;
    await act(async () => {
      saved = await result.current.saveAssignments(draft);
    });

    expect(saved?.success).toBe(false);
    expect(result.current.status).toBe('error');
    const kept = loadUnresolvedAssignmentSaves();
    expect(kept).not.toEqual([]);
    expect(kept.every((record) => record.reconciliation === 'pending')).toBe(true);
    expect(kept.some((record) => record.targets.some((target) => target.outcome === 'IN_FLIGHT'))).toBe(true);
  });

  it('clears a previous success when an unsaved change resets the status', async () => {
    const repository = {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      saveBulk: vi.fn().mockResolvedValue(undefined),
    } as unknown as AssignmentRepository;

    const { result } = renderHook(() => useAssignmentSave(repository));

    await act(async () => {
      await result.current.saveAssignments(draft);
    });
    expect(result.current.status).toBe('success');

    act(() => {
      result.current.clearError();
    });

    expect(result.current.status).toBe('idle');
  });

  it('does not restore success after a later save fails', async () => {
    const repository = {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      saveBulk: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('boom')),
    } as unknown as AssignmentRepository;

    const { result } = renderHook(() => useAssignmentSave(repository));

    await act(async () => {
      await result.current.saveAssignments(draft);
    });
    expect(result.current.status).toBe('success');

    let saved: { success: boolean } | undefined;
    await act(async () => {
      saved = await result.current.saveAssignments(draft);
    });

    expect(saved?.success).toBe(false);
    expect(result.current.status).toBe('error');
  });

  it('keeps a partial result visible and does not send the same request again', async () => {
    const report: AssignmentSaveReport = {
      reconciliation: 'complete',
      targets: [
        {
          dateKey: '2026-11-11',
          direction: 'to',
          userId: 'U002',
          scheduleRowId: 'row-1',
          outcome: 'CONFIRMED_APPLIED',
          conflict: false,
          writeStarted: true,
        },
        {
          dateKey: '2026-11-11',
          direction: 'to',
          userId: 'U001',
          scheduleRowId: 'row-2',
          outcome: 'CONFIRMED_NOT_APPLIED',
          conflict: false,
          writeStarted: false,
        },
      ],
    };
    const saveBulk = vi.fn().mockRejectedValue(new AssignmentPartialSaveError('partial', report));
    const repository = {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      saveBulk,
    } as unknown as AssignmentRepository;
    const { result } = renderHook(() => useAssignmentSave(repository));

    await act(async () => {
      await result.current.saveAssignments(draft);
    });

    expect(saveBulk).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('partial');
    act(() => {
      result.current.clearError();
    });
    expect(result.current.status).toBe('partial');
  });

  it('shows reconciliation separately and stays failed when the read-back is unknown', async () => {
    const report: AssignmentSaveReport = {
      reconciliation: 'incomplete',
      targets: [
        {
          dateKey: '2026-11-11',
          direction: 'to',
          userId: 'U002',
          scheduleRowId: 'row-1',
          outcome: 'UNKNOWN',
          conflict: false,
          writeStarted: true,
        },
      ],
    };
    let release: (() => void) | undefined;
    const repository = {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      saveBulk: vi.fn(async function (this: { onSavePhase?: (phase: string) => void }) {
        this.onSavePhase?.('reconciling');
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        throw new AssignmentPartialSaveError('unknown', report);
      }),
    } as unknown as AssignmentRepository;
    const { result } = renderHook(() => useAssignmentSave(repository));

    let pending: Promise<unknown> | undefined;
    act(() => {
      pending = result.current.saveAssignments(draft);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.status).toBe('reconciling');

    await act(async () => {
      release?.();
      await pending;
    });
    expect(result.current.status).toBe('reconcile_failed');
    expect(repository.saveBulk).toHaveBeenCalledTimes(1);
  });

  it('keeps the unresolved save blocked after feedback is cleared and the date changes', async () => {
    const report: AssignmentSaveReport = {
      reconciliation: 'incomplete',
      targets: [
        {
          dateKey: '2026-11-11',
          direction: 'to',
          userId: 'U002',
          scheduleRowId: 'row-1',
          outcome: 'UNKNOWN',
          conflict: false,
          writeStarted: true,
        },
        {
          dateKey: '2026-11-12',
          direction: 'to',
          userId: 'U001',
          scheduleRowId: 'row-2',
          outcome: 'NOT_ATTEMPTED',
          conflict: false,
          writeStarted: false,
        },
      ],
    };
    const saveBulk = vi.fn().mockRejectedValue(new AssignmentPartialSaveError('partial', report));
    const repository = {
      ...repositoryWith(saveBulk),
      previewTransportSave: async (assignments: TransportAssignment[]) => assignments.flatMap((assignment) =>
        (assignment.userIds ?? []).map((userId) => ({
          dateKey: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date(assignment.start)),
          direction: assignment.direction ?? 'to',
          userId,
          scheduleRowId: `row-${userId}-${assignment.direction}`,
          before: { vehicleId: '', driverId: '', notes: '' },
          intent: { vehicleId: assignment.vehicleId, driverId: assignment.driverId, notes: '' },
        })),
      ),
    } as AssignmentRepository;
    const { result } = renderHook(() => useAssignmentSave(repository));

    await act(async () => {
      await result.current.saveBulkAssignments([
        transportAssignment('U002', '2026-11-11T08:00:00+09:00', 'to'),
        transportAssignment('U001', '2026-11-12T08:00:00+09:00', 'to'),
      ]);
    });

    act(() => {
      result.current.clearError();
      result.current.resetSaveFeedback();
    });

    await act(async () => {
      const returned = await result.current.saveBulkAssignments([
        transportAssignment('U002', '2026-11-11T08:00:00+09:00', 'to'),
      ]);
      expect(returned.success).toBe(false);
      expect(returned.error).toBeInstanceOf(AssignmentSaveBlockedError);
    });
    await act(async () => {
      const otherDirection = await result.current.saveBulkAssignments([
        transportAssignment('U002', '2026-11-11T08:00:00+09:00', 'from'),
      ]);
      expect(otherDirection.error).not.toBeInstanceOf(AssignmentSaveBlockedError);
    });
    await act(async () => {
      const sameWeekDay = await result.current.saveBulkAssignments([
        transportAssignment('U001', '2026-11-12T08:00:00+09:00', 'to'),
      ]);
      expect(sameWeekDay.error).toBeInstanceOf(AssignmentSaveBlockedError);
    });
    await act(async () => {
      const outside = await result.current.saveBulkAssignments([
        transportAssignment('U009', '2026-11-13T08:00:00+09:00', 'to'),
      ]);
      expect(outside.error).not.toBeInstanceOf(AssignmentSaveBlockedError);
    });

    expect(saveBulk).toHaveBeenCalledTimes(3);
    expect(loadUnresolvedAssignmentSaves()[0]?.targets).toEqual(expect.arrayContaining([
      expect.objectContaining({ dateKey: '2026-11-11', userId: 'U002', outcome: 'UNKNOWN' }),
      expect.objectContaining({ dateKey: '2026-11-12', userId: 'U001', outcome: 'NOT_ATTEMPTED' }),
    ]));
  });

  it('rejects a direct hook call for an unresolved target before the repository writes', async () => {
    const report: AssignmentSaveReport = {
      reconciliation: 'complete',
      targets: [
        {
          dateKey: '2026-11-11',
          direction: 'to',
          userId: 'U002',
          scheduleRowId: 'row-1',
          outcome: 'UNKNOWN',
          conflict: true,
          writeStarted: true,
          reason: 'target_mismatch',
        },
      ],
    };
    const saveBulk = vi.fn().mockRejectedValue(new AssignmentPartialSaveError('conflict', report));
    const repository = repositoryWith(saveBulk);
    const { result } = renderHook(() => useAssignmentSave(repository));

    await act(async () => {
      await result.current.saveAssignments(draft);
    });
    await act(async () => {
      await result.current.saveAssignments(draft);
    });

    expect(saveBulk).toHaveBeenCalledTimes(1);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('restores the unresolved lock after the screen is remounted', async () => {
    const report: AssignmentSaveReport = {
      reconciliation: 'incomplete',
      targets: [
        {
          dateKey: '2026-11-11',
          direction: 'to',
          userId: 'U002',
          scheduleRowId: null,
          outcome: 'UNKNOWN',
          conflict: false,
          writeStarted: true,
        },
      ],
    };
    const saveBulk = vi.fn().mockRejectedValue(new AssignmentPartialSaveError('unknown', report));
    const repository = repositoryWith(saveBulk);
    const first = renderHook(() => useAssignmentSave(repository));
    await act(async () => {
      await first.result.current.saveAssignments(draft);
    });
    first.unmount();

    const second = renderHook(() => useAssignmentSave(repository));
    await act(async () => {
      const saved = await second.result.current.saveAssignments(draft);
      expect(saved.success).toBe(false);
      expect(saved.error).toBeInstanceOf(AssignmentSaveBlockedError);
    });

    expect(saveBulk).toHaveBeenCalledTimes(1);
  });

  it('keeps the ledger when a sent write fails and the read-back matches the intent', async () => {
    const report: AssignmentSaveReport = {
      reconciliation: 'complete',
      targets: [
        {
          dateKey: '2026-11-11',
          direction: 'to',
          userId: 'U002',
          scheduleRowId: 'row-1',
          outcome: 'CONFIRMED_APPLIED',
          conflict: false,
          writeStarted: true,
        },
      ],
    };
    const saveBulk = vi.fn().mockRejectedValue(Object.assign(new Error('Failed to fetch'), { saveReport: report }));
    const repository = repositoryWith(saveBulk);
    const { result } = renderHook(() => useAssignmentSave(repository));

    await act(async () => {
      await result.current.saveAssignments(draft);
    });
    act(() => {
      result.current.resetSaveFeedback();
    });
    await act(async () => {
      const saved = await result.current.saveAssignments(draft);
      expect(saved.success).toBe(false);
      expect(saved.error).toBeInstanceOf(AssignmentSaveBlockedError);
    });

    expect(saveBulk).toHaveBeenCalledTimes(1);
    expect(repository.update).not.toHaveBeenCalled();
    expect(loadUnresolvedAssignmentSaves()).toHaveLength(1);
  });

  it('keeps the ledger when a sent write fails and the read-back still matches the previous row', async () => {
    const report: AssignmentSaveReport = {
      reconciliation: 'complete',
      targets: [
        {
          dateKey: '2026-11-11',
          direction: 'to',
          userId: 'U002',
          scheduleRowId: 'row-1',
          outcome: 'CONFIRMED_NOT_APPLIED',
          conflict: false,
          writeStarted: true,
        },
      ],
    };
    const saveBulk = vi.fn().mockRejectedValue(Object.assign(new Error('Failed to fetch'), { saveReport: report }));
    const repository = repositoryWith(saveBulk);
    const first = renderHook(() => useAssignmentSave(repository));

    await act(async () => {
      const saved = await first.result.current.saveAssignments(draft);
      expect(saved.success).toBe(false);
    });
    expect(loadUnresolvedAssignmentSaves()[0]?.targets).toEqual([
      expect.objectContaining({
        dateKey: '2026-11-11',
        direction: 'to',
        userId: 'U002',
        outcome: 'CONFIRMED_NOT_APPLIED',
        writeStarted: true,
      }),
    ]);
    act(() => {
      first.result.current.resetSaveFeedback();
    });
    first.unmount();

    const second = renderHook(() => useAssignmentSave(repository));
    await act(async () => {
      const saved = await second.result.current.saveAssignments(draft);
      expect(saved.error).toBeInstanceOf(AssignmentSaveBlockedError);
    });

    expect(saveBulk).toHaveBeenCalledTimes(1);
    expect(repository.update).not.toHaveBeenCalled();
    expect(loadUnresolvedAssignmentSaves().some((record) =>
      record.targets.some((target) => target.userId === 'U002' && target.direction === 'to' && target.writeStarted),
    )).toBe(true);
  });

  it('keeps the whole request locked when one sent row fails', async () => {
    const report: AssignmentSaveReport = {
      reconciliation: 'complete',
      targets: [
        {
          dateKey: '2026-11-11',
          direction: 'to',
          userId: 'U001',
          scheduleRowId: 'u1',
          outcome: 'CONFIRMED_APPLIED',
          conflict: false,
          writeStarted: true,
        },
        {
          dateKey: '2026-11-11',
          direction: 'to',
          userId: 'U002',
          scheduleRowId: 'u2',
          outcome: 'CONFIRMED_NOT_APPLIED',
          conflict: false,
          writeStarted: true,
        },
      ],
    };
    const saveBulk = vi.fn().mockRejectedValue(new AssignmentPartialSaveError('partial', report));
    const repository = {
      ...repositoryWith(saveBulk),
      previewTransportSave: async () => [
        {
          dateKey: '2026-11-11',
          direction: 'to' as const,
          userId: 'U001',
          scheduleRowId: 'u1',
          before: { vehicleId: '', driverId: '', notes: '' },
          intent: { vehicleId: '車両1', driverId: 'S001', notes: '' },
        },
        {
          dateKey: '2026-11-11',
          direction: 'to' as const,
          userId: 'U002',
          scheduleRowId: 'u2',
          before: { vehicleId: '', driverId: '', notes: '' },
          intent: { vehicleId: '車両1', driverId: 'S001', notes: '' },
        },
      ],
    } as AssignmentRepository;
    const { result } = renderHook(() => useAssignmentSave(repository));
    await act(async () => {
      await result.current.saveBulkAssignments([
        transportAssignment('U001', '2026-11-11T08:00:00+09:00', 'to'),
        transportAssignment('U002', '2026-11-11T08:00:00+09:00', 'to'),
      ]);
    });
    await act(async () => {
      const first = await result.current.saveBulkAssignments([
        transportAssignment('U001', '2026-11-11T08:00:00+09:00', 'to'),
      ]);
      const second = await result.current.saveBulkAssignments([
        transportAssignment('U002', '2026-11-11T08:00:00+09:00', 'to'),
      ]);
      expect(first.error).toBeInstanceOf(AssignmentSaveBlockedError);
      expect(second.error).toBeInstanceOf(AssignmentSaveBlockedError);
    });
    expect(saveBulk).toHaveBeenCalledTimes(1);
    expect(repository.update).not.toHaveBeenCalled();
    expect(loadUnresolvedAssignmentSaves()[0]?.targets).toHaveLength(2);
  });

  it('releases a request only when every target is confirmed unsent', async () => {
    const report: AssignmentSaveReport = {
      reconciliation: 'complete',
      targets: [
        {
          dateKey: '2026-11-11',
          direction: 'to',
          userId: 'U002',
          scheduleRowId: null,
          outcome: 'NOT_ATTEMPTED',
          conflict: false,
          writeStarted: false,
        },
      ],
    };
    const saveBulk = vi.fn()
      .mockRejectedValueOnce(new AssignmentPartialSaveError('missing row', report))
      .mockResolvedValueOnce(undefined);
    const repository = repositoryWith(saveBulk);
    const { result } = renderHook(() => useAssignmentSave(repository));

    await act(async () => {
      const failed = await result.current.saveAssignments(draft);
      expect(failed.success).toBe(false);
    });
    expect(loadUnresolvedAssignmentSaves()).toEqual([]);
    await act(async () => {
      const saved = await result.current.saveAssignments(draft);
      expect(saved.success).toBe(true);
    });
    expect(saveBulk).toHaveBeenCalledTimes(2);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('records an in-flight save before the repository returns and blocks a second entry', async () => {
    let release: (() => void) | undefined;
    const saveBulk = vi.fn(() => new Promise<void>((resolve) => {
      release = resolve;
    }));
    const { result } = renderHook(() => useAssignmentSave(repositoryWith(saveBulk as AssignmentRepository['saveBulk'])));

    let pending: Promise<unknown> | undefined;
    act(() => {
      pending = result.current.saveAssignments(draft);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(loadUnresolvedAssignmentSaves()[0]?.reconciliation).toBe('pending');
    await act(async () => {
      const overlapping = await result.current.saveAssignments(draft);
      expect(overlapping.error).toBeInstanceOf(AssignmentSaveBlockedError);
    });
    expect(saveBulk).toHaveBeenCalledTimes(1);

    await act(async () => {
      release?.();
      await pending;
    });
  });

  it('seals the plan before writing and keeps it when a later read cannot prove the write finished', async () => {
    let release: (() => void) | undefined;
    const saveBulk = vi.fn(() => new Promise<void>((resolve) => {
      release = resolve;
    }));
    let releasePreview: ((value: unknown) => void) | undefined;
    const previewTransportSave = vi.fn(() => new Promise((resolve) => {
      releasePreview = resolve;
    }));
    const planned = [{
      dateKey: '2026-11-11',
      direction: 'to' as const,
      userId: 'U002',
      scheduleRowId: 'row-1',
      before: { vehicleId: '', driverId: '', notes: '' },
      intent: { vehicleId: '車両1', driverId: 'S001', notes: '' },
    }];
    const rereadUnresolvedSave = vi.fn(async (record: unknown) => record);
    const repository = {
      ...repositoryWith(saveBulk as AssignmentRepository['saveBulk']),
      previewTransportSave,
      rereadUnresolvedSave,
    } as AssignmentRepository;
    const { result } = renderHook(() => useAssignmentSave(repository));

    let pending: Promise<unknown> | undefined;
    act(() => {
      pending = result.current.saveAssignments(draft);
    });
    releasePreview?.(planned);
    await vi.waitFor(() => {
      expect(loadUnresolvedAssignmentSaves()[0]?.schemaVersion).toBe(2);
    });

    const stored = loadUnresolvedAssignmentSaves()[0];
    expect(stored?.schemaVersion).toBe(2);
    expect(stored?.targets[0]).toMatchObject({ scheduleRowId: 'row-1', outcome: 'IN_FLIGHT', userId: 'U002' });
    expect(JSON.stringify(stored)).not.toContain('notes');
    expect(JSON.stringify(stored)).not.toContain('FullName');
    expect(saveBulk).toHaveBeenCalledTimes(1);

    await act(async () => {
      const overlapping = await result.current.saveAssignments(draft);
      expect(overlapping.error).toBeInstanceOf(AssignmentSaveBlockedError);
    });
    expect(saveBulk).toHaveBeenCalledTimes(1);

    await act(async () => {
      release?.();
      await pending;
    });
    await act(async () => {
      await result.current.reconcileUnresolved();
    });
    expect(rereadUnresolvedSave).not.toHaveBeenCalled();
    expect(loadUnresolvedAssignmentSaves()).toEqual([]);

    localStorage.setItem('iceberg.transportAssignment.unresolvedSave.v1', JSON.stringify([stored]));
    const reloaded = renderHook(() => useAssignmentSave(repository));
    await act(async () => {
      await reloaded.result.current.reconcileUnresolved();
    });
    expect(rereadUnresolvedSave).toHaveBeenCalledTimes(1);
    expect(repository.update).not.toHaveBeenCalled();
    expect(loadUnresolvedAssignmentSaves()[0]?.requestId).toBe(stored?.requestId);
    previewTransportSave.mockResolvedValue(planned);
    saveBulk.mockResolvedValue(undefined);
    await act(async () => {
      const blocked = await reloaded.result.current.saveAssignments(draft);
      expect(blocked.error).toBeInstanceOf(AssignmentSaveBlockedError);
    });
    expect(saveBulk).toHaveBeenCalledTimes(1);
  });

  it('does not start a write when the ledger is damaged or cannot be recorded', async () => {
    const saveBulk = vi.fn().mockResolvedValue(undefined);
    const repository = repositoryWith(saveBulk);
    localStorage.setItem('iceberg.transportAssignment.unresolvedSave.v1', '{');
    const damaged = renderHook(() => useAssignmentSave(repository));
    await act(async () => {
      const saved = await damaged.result.current.saveAssignments(draft);
      expect(saved.error).toBeInstanceOf(AssignmentSaveBlockedError);
    });
    expect(saveBulk).not.toHaveBeenCalled();
    expect(localStorage.getItem('iceberg.transportAssignment.unresolvedSave.v1')).toBe('{');
    expect(damaged.result.current.ledgerState).toMatchObject({ kind: 'corrupt', reason: 'json' });

    localStorage.clear();
    const original = localStorage.setItem.bind(localStorage);
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
      if (key === 'iceberg.transportAssignment.unresolvedSave.v1') throw new Error('quota');
      original(key, value);
    });
    try {
      const blockedWrite = renderHook(() => useAssignmentSave(repository));
      await act(async () => {
        const saved = await blockedWrite.result.current.saveAssignments(draft);
        expect(saved.success).toBe(false);
      });
      expect(saveBulk).not.toHaveBeenCalled();
      expect(blockedWrite.result.current.ledgerState).toEqual({ kind: 'write-failed' });
    } finally {
      setItem.mockRestore();
    }
  });

  it('keeps another request when this save completes', async () => {
    const key = 'iceberg.transportAssignment.unresolvedSave.v1';
    const other = {
      requestId: 'other',
      reconciliation: 'pending',
      targets: [{
        dateKey: '2026-11-18',
        direction: 'from',
        userId: 'U009',
        scheduleRowId: 'row-9',
        outcome: 'IN_FLIGHT',
        conflict: true,
        writeStarted: false,
        reason: 'write_still_possible',
      }],
    };
    localStorage.setItem(key, JSON.stringify([other]));
    const saveBulk = vi.fn(async () => {
      const current = JSON.parse(localStorage.getItem(key) ?? '[]') as Array<{ requestId: string }>;
      current.push({ ...other, requestId: 'third' });
      localStorage.setItem(key, JSON.stringify(current));
    });
    const repository = repositoryWith(saveBulk as AssignmentRepository['saveBulk']);
    const { result } = renderHook(() => useAssignmentSave(repository));
    await act(async () => {
      const saved = await result.current.saveAssignments(draft);
      expect(saved.success).toBe(true);
    });
    const ids = loadUnresolvedAssignmentSaves().map((record) => record.requestId).sort();
    expect(ids).toEqual(['other', 'third']);
  });

  it('does not start a write when another tab recorded an overlapping save', async () => {
    const key = 'iceberg.transportAssignment.unresolvedSave.v1';
    const saveBulk = vi.fn().mockResolvedValue(undefined);
    const repository = repositoryWith(saveBulk);
    const setItem = vi.mocked(localStorage.setItem);
    const originalImpl = setItem.getMockImplementation();
    let injected = false;
    setItem.mockImplementation((keyName: string, value: string) => {
      if (!injected && keyName === key && value.includes('U002') && originalImpl) {
        injected = true;
        const parsed = JSON.parse(value) as unknown[];
        parsed.push({
          requestId: 'tab-b',
          reconciliation: 'pending',
          targets: [{
            dateKey: '2026-11-11',
            direction: 'to',
            userId: 'U002',
            scheduleRowId: 'row-b',
            outcome: 'IN_FLIGHT',
            conflict: false,
            writeStarted: false,
          }],
        });
        return originalImpl(keyName, JSON.stringify(parsed));
      }
      return originalImpl?.(keyName, value);
    });
    try {
      const { result } = renderHook(() => useAssignmentSave(repository));
      await act(async () => {
        const saved = await result.current.saveAssignments(draft);
        expect(saved.error).toBeInstanceOf(AssignmentSaveBlockedError);
      });
      expect(saveBulk).not.toHaveBeenCalled();
      const stored = JSON.parse(localStorage.getItem(key) ?? '[]') as Array<{ requestId: string }>;
      expect(stored.map((record) => record.requestId)).toEqual(['tab-b']);
    } finally {
      if (originalImpl) setItem.mockImplementation(originalImpl);
    }
  });

  it('keeps the unresolved save when the page unmount aborts the write', async () => {
    const key = 'iceberg.transportAssignment.unresolvedSave.v1';
    const saveBulk = vi.fn((_assignments: unknown, options?: { signal?: AbortSignal }) => new Promise<void>((_resolve, reject) => {
      const signal = options?.signal;
      if (!signal) {
        reject(new Error('missing signal'));
        return;
      }
      signal.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      }, { once: true });
    }));
    const repository = repositoryWith(saveBulk as AssignmentRepository['saveBulk']);
    const { result, unmount } = renderHook(() => useAssignmentSave(repository));
    let pending: Promise<unknown> | undefined;
    act(() => {
      pending = result.current.saveAssignments(draft);
    });
    await vi.waitFor(() => {
      expect(localStorage.getItem(key)).toContain('U002');
    });
    unmount();
    await act(async () => {
      await pending;
    });
    expect(saveBulk).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(key)).toContain('U002');
    expect(loadUnresolvedAssignmentSaves()).toHaveLength(1);
  });

  it('treats an empty ledger string as damaged and does not overwrite it', async () => {
    const key = 'iceberg.transportAssignment.unresolvedSave.v1';
    const saveBulk = vi.fn().mockResolvedValue(undefined);
    const repository = repositoryWith(saveBulk);
    const getItem = vi.mocked(localStorage.getItem);
    const originalGet = getItem.getMockImplementation();
    getItem.mockImplementation((storageKey: string) => (
      storageKey === key ? '' : originalGet?.(storageKey) ?? null
    ));
    try {
      const { result } = renderHook(() => useAssignmentSave(repository));
      await act(async () => {
        const saved = await result.current.saveAssignments(draft);
        expect(saved.error).toBeInstanceOf(AssignmentSaveBlockedError);
      });
      expect(saveBulk).not.toHaveBeenCalled();
      expect(vi.mocked(localStorage.setItem).mock.calls.some((call) => call[0] === key)).toBe(false);
      expect(result.current.ledgerState).toMatchObject({ kind: 'corrupt', reason: 'json' });
    } finally {
      if (originalGet) getItem.mockImplementation(originalGet);
    }
  });
});

describe('assignment recovery', () => {
  const key = 'iceberg.transportAssignment.unresolvedSave.v1';

  function stored(requestId: string, version?: 1) {
    return {
      schemaVersion: 2,
      ...(version ? { saveContractVersion: version } : {}),
      requestId,
      reconciliation: 'pending',
      targets: [{
        dateKey: '2026-11-11',
        direction: 'to',
        userId: 'U002',
        scheduleRowId: 'row-2',
        outcome: 'IN_FLIGHT',
        conflict: true,
        writeStarted: false,
        before: { vehicleId: '', driverId: '', mark: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
        intent: { vehicleId: '車両1', driverId: 'S001', mark: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
      }],
    };
  }

  function installLock(available: boolean) {
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: async (_name: string, _options: unknown, callback: (lock: object | null) => Promise<unknown>) =>
          callback(available ? { name: 'held' } : null),
      },
    });
  }

  beforeEach(() => {
    localStorage.clear();
    Reflect.deleteProperty(navigator, 'locks');
  });

  it('replaces a new-contract in-flight save and releases both ids only after success', async () => {
    localStorage.setItem(key, JSON.stringify([stored('old', 1), stored('other-row', 1)]));
    const other = JSON.parse(localStorage.getItem(key) ?? '[]');
    other[1].targets[0] = {
      ...other[1].targets[0],
      dateKey: '2026-11-18',
      userId: 'U009',
      scheduleRowId: 'row-9',
    };
    localStorage.setItem(key, JSON.stringify(other));
    installLock(true);
    const saveBulk = vi.fn().mockResolvedValue(undefined);
    const repository = Object.assign(repositoryWith(saveBulk), {
      consumeRecoveryMerges: () => [{ scheduleRowId: 'row-2', beforeEtag: '"8,1"', afterEtag: '"9,1"' }],
    });
    const { result } = renderHook(() => useAssignmentSave(repository));

    await act(async () => {
      const saved = await result.current.recoverAssignments(draft);
      expect(saved.success).toBe(true);
    });

    expect(saveBulk).toHaveBeenCalledTimes(1);
    const remaining = loadUnresolvedAssignmentSaves();
    expect(remaining.map((record) => record.requestId)).toEqual(['other-row']);
  });

  it('keeps the ledger when recovery hits 412 or a network error', async () => {
    localStorage.setItem(key, JSON.stringify([stored('old', 1)]));
    installLock(true);
    const conflict = Object.assign(new Error('conflict'), { status: 412, name: 'ScheduleConflictError' });
    const saveBulk = vi.fn().mockRejectedValueOnce(conflict).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const repository = {
      ...repositoryWith(saveBulk),
      previewTransportSave: async (assignments: TransportAssignment[]) => assignments.flatMap((assignment) =>
        (assignment.userIds ?? []).map((userId) => ({
          dateKey: '2026-11-11',
          direction: assignment.direction ?? 'to',
          userId,
          scheduleRowId: 'row-2',
          before: { vehicleId: '', driverId: '', notes: '' },
          intent: { vehicleId: assignment.vehicleId ?? '', driverId: assignment.driverId ?? '', notes: '' },
        })),
      ),
    } as AssignmentRepository;
    const { result } = renderHook(() => useAssignmentSave(repository));

    await act(async () => {
      const first = await result.current.recoverAssignments(draft);
      expect(first.success).toBe(false);
    });
    expect(loadUnresolvedAssignmentSaves().map((record) => record.requestId)).toEqual(expect.arrayContaining(['old']));
    expect(saveBulk).toHaveBeenCalledTimes(1);

    await act(async () => {
      const second = await result.current.recoverAssignments(draft);
      expect(second.success).toBe(false);
    });
    expect(loadUnresolvedAssignmentSaves().some((record) => record.requestId === 'old')).toBe(true);
    expect(saveBulk).toHaveBeenCalledTimes(2);
  });

  it('keeps both requests when recovery reports a partial result', async () => {
    localStorage.setItem(key, JSON.stringify([stored('old', 1)]));
    installLock(true);
    const report: AssignmentSaveReport = {
      reconciliation: 'complete',
      targets: [{
        dateKey: '2026-11-11',
        direction: 'to',
        userId: 'U002',
        scheduleRowId: 'row-2',
        outcome: 'UNKNOWN',
        conflict: false,
        writeStarted: true,
      }],
    };
    const saveBulk = vi.fn().mockRejectedValue(new AssignmentPartialSaveError('partial', report));
    const { result } = renderHook(() => useAssignmentSave(repositoryWith(saveBulk)));

    await act(async () => {
      const saved = await result.current.recoverAssignments(draft);
      expect(saved.success).toBe(false);
    });

    const ids = loadUnresolvedAssignmentSaves().map((record) => record.requestId);
    expect(ids).toContain('old');
    expect(ids.length).toBeGreaterThan(1);
  });

  it('does not recover or delete an old-contract request', async () => {
    localStorage.setItem(key, JSON.stringify([stored('legacy')]));
    installLock(true);
    const saveBulk = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAssignmentSave(repositoryWith(saveBulk)));

    await act(async () => {
      const saved = await result.current.recoverAssignments(draft);
      expect(saved.success).toBe(false);
    });

    expect(saveBulk).not.toHaveBeenCalled();
    expect(loadUnresolvedAssignmentSaves().map((record) => record.requestId)).toEqual(['legacy']);
    expect(loadUnresolvedAssignmentSaves()[0]?.saveContractVersion).toBeUndefined();
  });

  it('stops when another tab already holds the write lock', async () => {
    localStorage.setItem(key, JSON.stringify([stored('old', 1)]));
    installLock(false);
    const saveBulk = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAssignmentSave(repositoryWith(saveBulk)));

    await act(async () => {
      const saved = await result.current.recoverAssignments(draft);
      expect(saved.success).toBe(false);
    });

    expect(saveBulk).not.toHaveBeenCalled();
    expect(loadUnresolvedAssignmentSaves()).toHaveLength(1);
  });

  it('keeps the ledger when recovery does not advance an ETag', async () => {
    localStorage.setItem(key, JSON.stringify([stored('old', 1)]));
    installLock(true);
    const saveBulk = vi.fn().mockResolvedValue(undefined);
    const repository = Object.assign(repositoryWith(saveBulk), {
      consumeRecoveryMerges: () => [{ scheduleRowId: 'row-2', beforeEtag: '"8,1"', afterEtag: '"8,1"' }],
    });
    const { result } = renderHook(() => useAssignmentSave(repository));

    await act(async () => {
      const saved = await result.current.recoverAssignments(draft);
      expect(saved.success).toBe(false);
    });

    expect(saveBulk).toHaveBeenCalledTimes(1);
    expect(loadUnresolvedAssignmentSaves().map((record) => record.requestId)).toContain('old');
    expect(result.current.status).toBe('reconcile_failed');
  });

  it('keeps a two-day request when only one row advanced', async () => {
    const record = stored('week', 1);
    record.targets.push({
      ...record.targets[0],
      dateKey: '2026-11-12',
      scheduleRowId: 'row-12',
    });
    const legacy = stored('legacy');
    legacy.targets[0] = {
      ...legacy.targets[0],
      dateKey: '2026-11-20',
      userId: 'U008',
      scheduleRowId: 'row-legacy',
    };
    localStorage.setItem(key, JSON.stringify([
      record,
      {
        ...stored('other-row', 1),
        targets: [{
          ...stored('other-row', 1).targets[0],
          dateKey: '2026-11-18',
          userId: 'U009',
          scheduleRowId: 'row-9',
        }],
      },
      legacy,
    ]));
    installLock(true);
    const saveBulk = vi.fn().mockResolvedValue(undefined);
    const repository = Object.assign(repositoryWith(saveBulk), {
      consumeRecoveryMerges: () => [{ scheduleRowId: 'row-2', beforeEtag: '"8,1"', afterEtag: '"9,1"' }],
    });
    const { result } = renderHook(() => useAssignmentSave(repository));

    await act(async () => {
      const saved = await result.current.recoverAssignments(draft);
      expect(saved.success).toBe(false);
    });

    const ids = loadUnresolvedAssignmentSaves().map((recordItem) => recordItem.requestId);
    expect(ids).toEqual(expect.arrayContaining(['week', 'other-row', 'legacy']));
    expect(loadUnresolvedAssignmentSaves().find((item) => item.requestId === 'legacy')?.saveContractVersion).toBeUndefined();
  });

  it('does not write a recovery when the browser cannot exclude another tab', async () => {
    localStorage.setItem(key, JSON.stringify([stored('old', 1)]));
    const saveBulk = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAssignmentSave(repositoryWith(saveBulk)));

    await act(async () => {
      const saved = await result.current.recoverAssignments(draft);
      expect(saved.success).toBe(false);
    });

    expect(saveBulk).not.toHaveBeenCalled();
    expect(loadUnresolvedAssignmentSaves()).toHaveLength(1);
  });
});
