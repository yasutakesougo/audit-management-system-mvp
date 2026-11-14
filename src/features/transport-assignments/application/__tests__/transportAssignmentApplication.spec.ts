import { describe, it, expect, vi } from 'vitest';
import { 
  getTransportAssignmentInsights,
  compareDraftWithPersistedAssignments,
  detectConcurrencyConflicts,
  validateSaveReadiness,
  orchestrateAssignmentSave,
  readAssignmentCoordinationReadiness,
  isRecoveryBlockedByCoordination,
  AssignmentCoordinationBlockedError,
  CoordinationInsight,
  ConcurrencyConflictInsight
} from '../transportAssignmentApplication';
import { TransportAssignmentDraft } from '../../domain/transportAssignmentDraft';
import { TransportAssignment } from '@/features/schedules/domain/assignment';
import { AssignmentRepository } from '@/features/schedules/domain/assignment';

describe('transportAssignmentApplication contract tests', () => {
  const dummyDraft: TransportAssignmentDraft = {
    date: '2026-04-23',
    direction: 'to',
    vehicles: [
      {
        vehicleId: '車両1',
        courseId: 'isogo',
        courseLabel: '磯子',
        driverStaffId: 'staff-1',
        driverName: 'ドライバー1',
        attendantStaffId: 'staff-2',
        attendantName: '添乗員1',
        riderUserIds: ['user-1', 'user-2'],
      }
    ],
    unassignedUserIds: ['user-3'],
    users: [],
  };

  const dummyPersisted: TransportAssignment[] = [
    {
      id: 'transport-2026-04-23-pickup-車両1',
      type: 'transport',
      start: '2026-04-23T08:00:00Z',
      end: '2026-04-23T10:00:00Z',
      title: '送迎: 車両1',
      status: 'planned',
      vehicleId: '車両1',
      driverId: 'staff-1',
      assistantStaffIds: [],
      userIds: ['user-1', 'user-2'],
      direction: 'to',
      etag: 'etag-1'
    }
  ];

  describe('getTransportAssignmentInsights', () => {
    it('should return no insights for a valid draft', () => {
      const insights = getTransportAssignmentInsights(dummyDraft, {});
      expect(insights).toEqual([]);
    });

    it('should return warning when driver is missing', () => {
      const draftWithMissingDriver: TransportAssignmentDraft = {
        ...dummyDraft,
        vehicles: [{ ...dummyDraft.vehicles[0], driverStaffId: '', driverName: '' }]
      };
      const insights = getTransportAssignmentInsights(draftWithMissingDriver, {});
      expect(insights).toContainEqual(expect.objectContaining({
        type: 'missing_driver',
        severity: 'warning'
      }));
    });
  });

  describe('compareDraftWithPersistedAssignments', () => {
    it('should detect no changes for identical state', () => {
      const diffs = compareDraftWithPersistedAssignments(dummyDraft, dummyPersisted);
      expect(diffs).toEqual([]);
    });

    it('should detect user additions and removals', () => {
      const modifiedDraft: TransportAssignmentDraft = {
        ...dummyDraft,
        vehicles: [
          {
            ...dummyDraft.vehicles[0],
            riderUserIds: ['user-1', 'user-4'], // user-2 removed, user-4 added
          }
        ]
      };
      const diffs = compareDraftWithPersistedAssignments(modifiedDraft, dummyPersisted);
      expect(diffs).toContainEqual(expect.objectContaining({
        vehicleId: '車両1',
        type: 'modified',
        userChanges: { added: ['user-4'], removed: ['user-2'] }
      }));
    });
  });

  describe('detectConcurrencyConflicts', () => {
    it('should detect conflicts when etags differ', () => {
      const latest: TransportAssignment[] = [
        { ...dummyPersisted[0], etag: 'etag-changed' }
      ];
      const conflicts = detectConcurrencyConflicts(dummyPersisted, latest, {});
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].reason).toBe('modified_externally');
    });

    it('should not detect conflicts when etags are identical', () => {
      const conflicts = detectConcurrencyConflicts(dummyPersisted, dummyPersisted, {});
      expect(conflicts).toEqual([]);
    });
  });

  describe('validateSaveReadiness', () => {
    it('should block save on coordination errors', () => {
      const insights: CoordinationInsight[] = [{ type: 'capacity', severity: 'error', message: 'Over capacity' }];
      const readiness = validateSaveReadiness(insights, []);
      expect(readiness.isBlocked).toBe(true);
      expect(readiness.blockReason).toBe('coordination_error');
    });

    it('should block save on concurrency conflicts', () => {
      const conflicts: ConcurrencyConflictInsight[] = [{ vehicleId: '車両1', vehicleName: '車両1', reason: 'modified_externally' }];
      const readiness = validateSaveReadiness([], conflicts);
      expect(readiness.isBlocked).toBe(true);
      expect(readiness.blockReason).toBe('concurrency_conflict');
    });

    it('should not block save on warnings only', () => {
      const insights: CoordinationInsight[] = [{ type: 'missing_driver', severity: 'warning', message: 'Warning' }];
      const readiness = validateSaveReadiness(insights, []);
      expect(readiness.isBlocked).toBe(false);
      expect(readiness.warnings).toHaveLength(1);
    });
  });

  describe('orchestrateAssignmentSave', () => {
    it('blocks recovery when 車両1 carries more riders than its capacity of 6', () => {
      const vehicle = dummyDraft.vehicles[0];
      const six = readAssignmentCoordinationReadiness({
        ...dummyDraft,
        vehicles: [{ ...vehicle, riderUserIds: ['rider-1', 'rider-2', 'rider-3', 'rider-4', 'rider-5', 'rider-6'] }],
        unassignedUserIds: [],
      });
      const seven = readAssignmentCoordinationReadiness({
        ...dummyDraft,
        vehicles: [{ ...vehicle, riderUserIds: ['rider-1', 'rider-2', 'rider-3', 'rider-4', 'rider-5', 'rider-6', 'rider-7'] }],
        unassignedUserIds: [],
      });

      expect(six.isBlocked).toBe(false);
      expect(isRecoveryBlockedByCoordination(seven)).toBe(true);
      expect(seven.blockReason).toBe('coordination_error');
    });

    it('refuses a recovery write that exceeds vehicle capacity', async () => {
      const mockRepo = {
        saveBulk: vi.fn().mockResolvedValue(undefined),
      } as unknown as AssignmentRepository;
      const overCapacity: TransportAssignmentDraft = {
        ...dummyDraft,
        vehicles: [{
          ...dummyDraft.vehicles[0],
          riderUserIds: ['rider-1', 'rider-2', 'rider-3', 'rider-4', 'rider-5', 'rider-6', 'rider-7'],
        }],
        unassignedUserIds: [],
      };

      await expect(orchestrateAssignmentSave(mockRepo, overCapacity, undefined, {
        recoveryTouchRowIds: ['row-synthetic'],
      })).rejects.toBeInstanceOf(AssignmentCoordinationBlockedError);
      expect(mockRepo.saveBulk).not.toHaveBeenCalled();
    });

    it('does not apply the recovery coordination gate to a normal save', async () => {
      const mockRepo = {
        saveBulk: vi.fn().mockResolvedValue(undefined),
      } as unknown as AssignmentRepository;
      const overCapacity: TransportAssignmentDraft = {
        ...dummyDraft,
        vehicles: [{
          ...dummyDraft.vehicles[0],
          riderUserIds: ['rider-1', 'rider-2', 'rider-3', 'rider-4', 'rider-5', 'rider-6', 'rider-7'],
        }],
        unassignedUserIds: [],
      };

      await orchestrateAssignmentSave(mockRepo, overCapacity);
      expect(mockRepo.saveBulk).toHaveBeenCalledTimes(1);
    });

    it('should call saveBulk on the repository', async () => {
      const mockRepo = {
        saveBulk: vi.fn().mockResolvedValue(undefined)
      } as unknown as AssignmentRepository;

      await orchestrateAssignmentSave(mockRepo, dummyDraft);
      
      expect(mockRepo.saveBulk).toHaveBeenCalled();
      const calledAssignments = vi.mocked(mockRepo.saveBulk).mock.calls[0][0];
      expect(calledAssignments[0].type).toBe('transport');
      expect((calledAssignments[0] as TransportAssignment).vehicleId).toBe('車両1');
    });

    it('passes unassigned user ids to saveBulk without a vehicle', async () => {
      const mockRepo = {
        saveBulk: vi.fn().mockResolvedValue(undefined)
      } as unknown as AssignmentRepository;

      await orchestrateAssignmentSave(mockRepo, {
        ...dummyDraft,
        vehicles: [
          { ...dummyDraft.vehicles[0], riderUserIds: ['U001'] },
        ],
        unassignedUserIds: ['U002', 'U001', '  '],
      });

      const calledAssignments = vi.mocked(mockRepo.saveBulk).mock.calls[0][0] as TransportAssignment[];
      const assigned = calledAssignments.find((assignment) => assignment.vehicleId === '車両1');
      const unassigned = calledAssignments.find((assignment) => assignment.userIds.includes('U002'));
      expect(assigned?.userIds).toEqual(['U001']);
      expect(unassigned?.vehicleId).toBeUndefined();
      expect(unassigned?.driverId).toBeUndefined();
      expect(unassigned?.assistantStaffIds).toEqual([]);
      expect(unassigned?.userIds).toEqual(['U002']);
      expect(unassigned?.direction).toBe('to');
    });

    it('passes every rider as unassigned when no vehicle still has riders', async () => {
      const mockRepo = {
        saveBulk: vi.fn().mockResolvedValue(undefined)
      } as unknown as AssignmentRepository;

      await orchestrateAssignmentSave(mockRepo, {
        ...dummyDraft,
        vehicles: [
          { ...dummyDraft.vehicles[0], riderUserIds: [] },
        ],
        unassignedUserIds: ['U001', 'U002'],
      });

      const calledAssignments = vi.mocked(mockRepo.saveBulk).mock.calls[0][0] as TransportAssignment[];
      const unassigned = calledAssignments.find((assignment) => assignment.userIds.includes('U001'));
      expect(unassigned?.userIds).toEqual(['U001', 'U002']);
      expect(unassigned?.vehicleId).toBeUndefined();
    });

    it('propagates a repository failure instead of completing the save', async () => {
      const mockRepo = {
        saveBulk: vi.fn().mockRejectedValue(new Error('boom'))
      } as unknown as AssignmentRepository;

      await expect(orchestrateAssignmentSave(mockRepo, dummyDraft)).rejects.toThrow('boom');
    });
  });
});
