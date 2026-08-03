import { describe, expect, it } from 'vitest';
import { createAddonPresentation } from '../addonPresentation';

const input = {
  users: [],
  totalLifeSupportStaff: 1,
  basicTrainingCompletedCount: 1,
  usersWithoutWeeklyObservation: [],
  lastReassessmentMap: new Map<string, string | null>(),
  today: '2026-08-03',
};

describe('createAddonPresentation', () => {
  it('keeps demo findings outside the live finding collection', () => {
    const result = createAddonPresentation({
      isDemoMode: true,
      input: null,
      buildLiveFindings: () => [{ id: 'live', type: 'basic_training_ratio_insufficient', severity: 'medium', domain: 'sheet', userId: '__facility__', message: 'live', detectedAt: '2026-08-03' }],
      buildDemoFindings: () => [{ id: 'demo', type: 'basic_training_ratio_insufficient', severity: 'medium', domain: 'sheet', userId: '__facility__', message: 'demo', detectedAt: '2026-08-03', dataOrigin: 'demo' }],
    });

    expect(result.source).toBe('demo');
    expect(result.liveFindings).toEqual([]);
    expect(result.demoFindings[0]?.dataOrigin).toBe('demo');
  });

  it('does not create findings when a non-demo input is unavailable', () => {
    const result = createAddonPresentation({
      isDemoMode: false,
      input: null,
      buildLiveFindings: () => [],
      buildDemoFindings: () => [{ id: 'demo', type: 'basic_training_ratio_insufficient', severity: 'medium', domain: 'sheet', userId: '__facility__', message: 'demo', detectedAt: '2026-08-03', dataOrigin: 'demo' }],
    });

    expect(result).toEqual({ liveFindings: [], demoFindings: [], source: 'indeterminate' });
  });

  it('uses live findings only when live input is available', () => {
    const result = createAddonPresentation({
      isDemoMode: false,
      input,
      buildLiveFindings: () => [{ id: 'live', type: 'basic_training_ratio_insufficient', severity: 'medium', domain: 'sheet', userId: '__facility__', message: 'live', detectedAt: '2026-08-03' }],
      buildDemoFindings: () => [],
    });

    expect(result.source).toBe('live');
    expect(result.liveFindings).toHaveLength(1);
    expect(result.demoFindings).toEqual([]);
  });
});
