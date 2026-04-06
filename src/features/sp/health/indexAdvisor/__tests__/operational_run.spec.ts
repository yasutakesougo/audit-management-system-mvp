
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeIndexRemediation } from '../spIndexRemediationService';
import { driftEventBus } from '@/features/diagnostics/drift/domain/DriftEventBus';
import type { UseSP } from '@/lib/spClient';

// Mock driftEventBus
vi.mock('@/features/diagnostics/drift/domain/DriftEventBus', () => ({
  driftEventBus: {
    emit: vi.fn(),
  },
}));

describe('Stage 5.0 Operational Run: AttendanceDaily', () => {
  let mockSp: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSp = {
      updateField: vi.fn().mockResolvedValue('success'),
    };
  });

  it('should successfully create an index for RecordDate in AttendanceDaily', async () => {
    // 1. Preparation (Same as Step 1 & 2 of the procedure)
    const params = {
      listTitle: 'AttendanceDaily',
      internalName: 'RecordDate',
      action: 'create' as const,
    };

    // 2. Execution (Remediation Service)
    const result = await executeIndexRemediation(mockSp as unknown as UseSP, params);

    // 3. Verification of Results
    expect(result.success).toBe(true);
    expect(result.message).toContain('RecordDate');
    
    // 4. Verification of SharePoint Mutation
    expect(mockSp.updateField).toHaveBeenCalledWith(
      'AttendanceDaily',
      'RecordDate',
      { Indexed: true }
    );

    // 5. Verification of Audit Log (DriftEventsLog via Bus)
    expect(driftEventBus.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        listName: 'AttendanceDaily',
        fieldName: 'INDEX_CREATE',
        message: expect.stringContaining('RecordDate'),
        resolved: true,
        severity: 'info',
      })
    );
  });

  it('should log a failure when SharePoint mutation fails', async () => {
    // 1. Force failure
    mockSp.updateField.mockResolvedValue('error');

    const params = {
      listTitle: 'AttendanceDaily',
      internalName: 'RecordDate',
      action: 'create' as const,
    };

    // 2. Execution
    const result = await executeIndexRemediation(mockSp as unknown as UseSP, params);

    // 3. Verification of Failure Results
    expect(result.success).toBe(false);
    expect(result.message).toContain('失敗');

    // 4. Verification of Audit Log (Failure details)
    expect(driftEventBus.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        listName: 'AttendanceDaily',
        fieldName: 'INDEX_CREATE',
        message: expect.stringContaining('失敗'),
        resolved: false,
        severity: 'warn',
      })
    );
  });

  it('should block execution for lists not in the registry (Safety Guardrail)', async () => {
    const params = {
      listTitle: 'UnknownList',
      internalName: 'SomeField',
      action: 'create' as const,
    };

    const result = await executeIndexRemediation(mockSp as unknown as UseSP, params);

    expect(result.success).toBe(false);
    expect(result.message).toContain('見つかりません');
    expect(mockSp.updateField).not.toHaveBeenCalled();
    
    // Safety check should ALSO be logged
    expect(driftEventBus.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        listName: 'UnknownList',
        severity: 'warn',
        resolved: false,
      })
    );
  });
});
