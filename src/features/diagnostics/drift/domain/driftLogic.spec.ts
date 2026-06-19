import { describe, expect, it, vi } from 'vitest';
import { emitDriftRecord, emitIndexRemediationRecord, getDriftEventDedupeKey } from './driftLogic';
import { driftEventBus } from './DriftEventBus';

describe('drift logic', () => {
  it('emits warn severity for action_required by default', () => {
    const emitSpy = vi.spyOn(driftEventBus, 'emit');
    emitDriftRecord('Daily_Attendance', 'Status', 'action_required', 'suffix_mismatch');
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'warn',
        resolutionType: 'action_required',
        driftType: 'suffix_mismatch',
        resolved: false,
      }),
    );
    expect(emitSpy.mock.calls[0]![0].detectedAt).toEqual(expect.stringContaining('T'));
    emitSpy.mockRestore();
  });

  it('emits info severity for explicit silent override on emitDriftRecord', () => {
    const emitSpy = vi.spyOn(driftEventBus, 'emit');

    emitDriftRecord(
      'SupportCase',
      'BillingField',
      'fuzzy_match',
      'fallback',
      'missing field fallback',
      'silent',
    );

    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'silent',
        resolutionType: 'fuzzy_match',
        driftType: 'fallback',
        resolved: false,
        description: 'missing field fallback',
      }),
    );

    emitSpy.mockRestore();
  });

  it('emits resolution info for index remediation', () => {
    const emitSpy = vi.spyOn(driftEventBus, 'emit');
    emitIndexRemediationRecord('SupportCase', 'BillingField', 'create', 'error');
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'warn',
        resolutionType: 'manual',
        driftType: 'unknown',
        resolved: false,
        remediationSource: 'ui',
      }),
    );
    emitSpy.mockRestore();
  });

  it('builds dedupe key from list/field/date', () => {
    const key = getDriftEventDedupeKey({
      listName: 'Daily',
      fieldName: 'Status',
      detectedAt: '2026-06-11T08:00:00.000Z',
      severity: 'info',
      resolutionType: 'fuzzy_match',
      resolved: true,
      driftType: 'fuzzy_match',
    });

    expect(key).toBe('Daily:Status:2026-06-11');
  });
});
