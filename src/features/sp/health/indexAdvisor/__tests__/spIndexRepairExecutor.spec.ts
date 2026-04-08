import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeRepairAction } from '../spIndexRepairExecutor';
import { type SpListOperations } from '@/lib/sp/spLists';
import { emitIndexRemediationRecord } from '@/features/diagnostics/drift/domain/driftLogic';
import { type SpIndexRepairAction } from '../spIndexRepairPlanner';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/features/diagnostics/drift/domain/driftLogic', () => ({
  emitIndexRemediationRecord: vi.fn(),
}));

describe('spIndexRepairExecutor: executeRepairAction', () => {
  const mockSpClient = {
    updateField: vi.fn(),
  } as unknown as Pick<SpListOperations, 'updateField'>;

  const action: SpIndexRepairAction = {
    type: 'create',
    listName: 'ListX',
    internalName: 'FieldA',
    displayName: '列A',
    reason: 'R',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call spClient.updateField and emit success telemetry', async () => {
    vi.mocked(mockSpClient.updateField).mockResolvedValue('success');

    const result = await executeRepairAction(mockSpClient, action);

    expect(mockSpClient.updateField).toHaveBeenCalledWith('ListX', 'FieldA', { Indexed: true });
    expect(emitIndexRemediationRecord).toHaveBeenCalledWith('ListX', 'FieldA', 'create', 'success');
    expect(result.status).toBe('success');
  });

  it('should call spClient.updateField with false for deletion', async () => {
    vi.mocked(mockSpClient.updateField).mockResolvedValue('success');
    const deleteAction = { ...action, type: 'delete' as const };

    const result = await executeRepairAction(mockSpClient, deleteAction);

    expect(mockSpClient.updateField).toHaveBeenCalledWith('ListX', 'FieldA', { Indexed: false });
    expect(emitIndexRemediationRecord).toHaveBeenCalledWith('ListX', 'FieldA', 'delete', 'success');
    expect(result.status).toBe('success');
  });

  it('should handle API errors and emit failure telemetry', async () => {
    vi.mocked(mockSpClient.updateField).mockRejectedValue(new Error('SP Busy'));

    const result = await executeRepairAction(mockSpClient, action);

    expect(emitIndexRemediationRecord).toHaveBeenCalledWith('ListX', 'FieldA', 'create', 'error', 'SP Busy');
    expect(result.status).toBe('error');
    expect(result.errorDetail).toBe('SP Busy');
  });

  it('should treat "error" return from spClient as failure', async () => {
    vi.mocked(mockSpClient.updateField).mockResolvedValue('error');

    const result = await executeRepairAction(mockSpClient, action);

    expect(emitIndexRemediationRecord).toHaveBeenCalledWith('ListX', 'FieldA', 'create', 'error', expect.any(String));
    expect(result.status).toBe('error');
  });
});
