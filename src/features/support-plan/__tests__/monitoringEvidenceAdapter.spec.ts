import * as repo from '@/features/daily/infra/dailyTableRepository';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMonitoringEvidence } from '../monitoringEvidenceAdapter';

describe('monitoringEvidenceAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockRecords: repo.DailyTableRecord[] = [
    {
      userId: 'U123',
      recordDate: '2026-02-01',
      activities: { am: 'Walk', pm: 'Craft' },
      lunchIntake: 'full',
      notes: 'Stable',
      submittedAt: '...',
    },
    {
      userId: 'U123',
      recordDate: '2026-02-02',
      activities: { am: 'Exercise' },
      problemBehaviors: ['shouting'],
      submittedAt: '...',
    }
  ];

  it('should format records into a human-readable summary', () => {
    // Mock repository
    vi.spyOn(repo, 'getDailyTableRecords').mockReturnValue(mockRecords);

    const result = buildMonitoringEvidence({
      userId: 'U123',
      range: { from: '2026-02-01', to: '2026-02-28' }
    });

    expect(result.count).toBe(2);
    expect(result.bullets[0]).toContain('[2026-02-01]');
    expect(result.bullets[0]).toContain('活動 AM:Walk / PM:Craft');
    expect(result.bullets[0]).toContain('昼食:完食');
    expect(result.bullets[0]).toContain('特記: Stable');

    expect(result.bullets[1]).toContain('[2026-02-02]');
    expect(result.bullets[1]).toContain('問題行動:大声');

    expect(result.text).toContain('--- Daily Evidence (user=U123, from=2026-02-01 to=2026-02-28) ---');
    expect(result.text).toContain('- [2026-02-01]');
    expect(result.text).toContain('- [2026-02-02]');
    expect(result.text).toContain('--- End of Evidence ---');
  });

  it('should handle empty or missing fields gracefully', () => {
    vi.spyOn(repo, 'getDailyTableRecords').mockReturnValue([
      {
        userId: 'U123',
        recordDate: '2026-02-03',
        activities: {},
        submittedAt: '...',
      }
    ]);

    const result = buildMonitoringEvidence({
      userId: 'U123',
      range: { from: '2026-02-01', to: '2026-02-28' }
    });

    expect(result.bullets[0]).toBe('[2026-02-03] 記録あり');
  });
});
