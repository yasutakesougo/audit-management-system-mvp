import { describe, expect, it } from 'vitest';
import { buildSupportPlanGuidance } from '../guidanceEngine';
import type { SupportPlanTimelineSummary } from '../timeline.types';

describe('buildSupportPlanGuidance', () => {
  it('flags stagnation when structural change was more than 90 days ago', () => {
    const ninetyOneDaysAgo = new Date();
    ninetyOneDaysAgo.setDate(ninetyOneDaysAgo.getDate() - 91);

    const summary: SupportPlanTimelineSummary = {
      totalVersions: 2,
      structuralChanges: 1,
      criticalSafetyUpdates: 0,
      lastStructuralChangeAt: ninetyOneDaysAgo.toISOString(),
      lastCriticalSafetyUpdateAt: null,
      stagnantSince: ninetyOneDaysAgo.toISOString(),
    };

    const guidance = buildSupportPlanGuidance(summary);
    const stagnationRule = guidance.items.find(i => i.type === 'stagnation');
    
    expect(stagnationRule).toBeDefined();
    expect(stagnationRule?.severity).toBe('warn');
    expect(guidance.overallStatus).toBe('warn');
  });

  it('notifies about critical safety updates', () => {
    const summary: SupportPlanTimelineSummary = {
      totalVersions: 3,
      structuralChanges: 2,
      criticalSafetyUpdates: 1,
      lastStructuralChangeAt: new Date().toISOString(),
      lastCriticalSafetyUpdateAt: new Date().toISOString(),
      stagnantSince: new Date().toISOString(),
    };

    const guidance = buildSupportPlanGuidance(summary);
    const safetyRule = guidance.items.find(i => i.type === 'safety');
    
    expect(safetyRule).toBeDefined();
    expect(safetyRule?.title).toContain('重大な安全情報');
  });

  it('commends high velocity PDCA', () => {
    const summary: SupportPlanTimelineSummary = {
      totalVersions: 4,
      structuralChanges: 3,
      criticalSafetyUpdates: 0,
      lastStructuralChangeAt: new Date().toISOString(),
      lastCriticalSafetyUpdateAt: null,
      stagnantSince: new Date().toISOString(),
    };

    const guidance = buildSupportPlanGuidance(summary);
    const velocityRule = guidance.items.find(i => i.type === 'velocity');
    
    expect(velocityRule).toBeDefined();
    expect(velocityRule?.severity).toBe('success');
  });
});
