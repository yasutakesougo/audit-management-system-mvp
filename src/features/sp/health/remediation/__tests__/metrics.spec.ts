import { describe, it, expect } from 'vitest';
import { calculateRemediationMetrics } from '../metrics';
import { RemediationAuditEntry } from '../audit';

describe('Remediation Metrics Logic', () => {
  it('counts lifecycle KPIs by unique correlationId', () => {
    const entries: Partial<RemediationAuditEntry>[] = [
      { correlationId: 'task-1', phase: 'planned', timestamp: '2026-04-18T00:00:00Z' },
      { correlationId: 'task-1', phase: 'planned', timestamp: '2026-04-18T00:00:05Z' }, // Duplicate log
      { correlationId: 'task-2', phase: 'planned', timestamp: '2026-04-18T00:00:10Z' },
    ];
    
    const metrics = calculateRemediationMetrics(entries as RemediationAuditEntry[]);
    
    expect(metrics.totalPlanned).toBe(2); // Unique IDs: task-1, task-2
  });

  it('excludes entries without correlationId from lifecycle metrics', () => {
    const entries: Partial<RemediationAuditEntry>[] = [
      { correlationId: 'task-1', phase: 'planned', timestamp: '2026-04-18T00:00:00Z' },
      { correlationId: undefined, phase: 'planned', timestamp: '2026-04-18T00:00:10Z' }, // Orphan log
    ];
    
    const metrics = calculateRemediationMetrics(entries as RemediationAuditEntry[]);
    
    expect(metrics.totalPlanned).toBe(1); // Only task-1 is counted
  });

  it('calculates successRate and executionRate correctly based on lifecycles', () => {
    const entries: Partial<RemediationAuditEntry>[] = [
      { correlationId: 'task-1', phase: 'planned', timestamp: '2026-04-18T00:00:00Z' },
      { correlationId: 'task-1', phase: 'executed', executionStatus: 'success', timestamp: '2026-04-18T00:01:00Z' },
      { correlationId: 'task-2', phase: 'planned', timestamp: '2026-04-18T00:00:10Z' },
      { correlationId: 'task-2', phase: 'executed', executionStatus: 'error', timestamp: '2026-04-18T00:01:10Z' },
    ];
    
    const metrics = calculateRemediationMetrics(entries as RemediationAuditEntry[]);
    
    expect(metrics.totalExecuted).toBe(2);
    expect(metrics.totalSuccess).toBe(1);
    expect(metrics.successRate).toBe(0.5);
    expect(metrics.executionRate).toBe(1.0);
  });

  it('calculates meanTimeToRemediateMs accurately', () => {
    const entries: Partial<RemediationAuditEntry>[] = [
      { correlationId: 'task-1', phase: 'planned', timestamp: '2026-04-18T00:00:00Z' },
      { correlationId: 'task-1', phase: 'executed', executionStatus: 'success', timestamp: '2026-04-18T00:01:00Z' }, // 60s
    ];
    
    const metrics = calculateRemediationMetrics(entries as RemediationAuditEntry[]);
    
    expect(metrics.meanTimeToRemediateMs).toBe(60000);
  });

  it('manages backlogCount correctly by excluding executed and skipped tasks', () => {
    const entries: Partial<RemediationAuditEntry>[] = [
      { correlationId: 'task-active', phase: 'planned', timestamp: '2026-04-18T00:00:00Z' },
      { correlationId: 'task-done', phase: 'planned', timestamp: '2026-04-18T00:00:10Z' },
      { correlationId: 'task-done', phase: 'executed', executionStatus: 'success', timestamp: '2026-04-18T00:01:10Z' },
      { correlationId: 'task-skipped', phase: 'planned', timestamp: '2026-04-18T00:00:20Z' },
      { correlationId: 'task-skipped', phase: 'skipped', reason: 'Policy limit', timestamp: '2026-04-18T00:01:20Z' },
    ];
    
    const metrics = calculateRemediationMetrics(entries as RemediationAuditEntry[]);
    
    expect(metrics.backlogCount).toBe(1); // Only task-active
  });
});
