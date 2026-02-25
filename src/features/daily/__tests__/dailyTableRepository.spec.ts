import { beforeEach, describe, expect, it } from 'vitest';
import { getDailyTableRecords, upsertDailyTableRecords, type DailyTableRecord } from '../infra/dailyTableRepository';

describe('dailyTableRepository', () => {
  beforeEach(() => {
    // Mock localStorage
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    });
  });

  const mockRecords: DailyTableRecord[] = [
    {
      userId: 'U123',
      recordDate: '2026-02-10',
      activities: { am: 'Activity A' },
      submittedAt: '2026-02-10T10:00:00Z',
    },
    {
      userId: 'U123',
      recordDate: '2026-02-15',
      activities: { pm: 'Activity B' },
      submittedAt: '2026-02-15T15:00:00Z',
    },
    {
      userId: 'U999',
      recordDate: '2026-02-12',
      activities: { am: 'Other' },
      submittedAt: '2026-02-12T09:00:00Z',
    }
  ];

  it('should save and retrieve records for a specific user within range', () => {
    upsertDailyTableRecords(mockRecords);

    const results = getDailyTableRecords('U123', {
      from: '2026-02-01',
      to: '2026-02-28'
    });

    expect(results).toHaveLength(2);
    expect(results[0].recordDate).toBe('2026-02-10');
    expect(results[1].recordDate).toBe('2026-02-15');
  });

  it('should filter records outside the date range', () => {
    upsertDailyTableRecords(mockRecords);

    const results = getDailyTableRecords('U123', {
      from: '2026-02-12',
      to: '2026-02-28'
    });

    expect(results).toHaveLength(1);
    expect(results[0].recordDate).toBe('2026-02-15');
  });

  it('should overwrite records with the same userId and date', () => {
    upsertDailyTableRecords([mockRecords[0]]);
    const updated = { ...mockRecords[0], notes: 'Updated notes' };
    upsertDailyTableRecords([updated]);

    const results = getDailyTableRecords('U123', { from: '2026-02-01', to: '2026-02-28' });
    expect(results).toHaveLength(1);
    expect(results[0].notes).toBe('Updated notes');
  });

  it('should handle numeric userId by normalizing to string', () => {
    const record = { ...mockRecords[0], userId: 123 } as unknown as DailyTableRecord;
    upsertDailyTableRecords([record]);

    const results = getDailyTableRecords('123', { from: '2026-02-01', to: '2026-02-28' });
    expect(results).toHaveLength(1);
    expect(results[0].userId).toBe('123');
  });

  it('should prune old records when exceeding PRUNE_LIMIT', () => {
    const records: DailyTableRecord[] = [];
    // Create 510 records (PRUNE_LIMIT is 500)
    for (let i = 0; i < 510; i++) {
      // Use simple increment for stable dates (offset from a base date)
      const d = new Date(2024, 0, 1, 12, 0, 0); // Noon to avoid TZ shifts
      d.setDate(d.getDate() + i);
      const date = d.toISOString().split('T')[0];
      records.push({
        userId: 'prune-user',
        recordDate: date,
        activities: { am: `Activity ${i}` },
        submittedAt: new Date().toISOString(),
      });
    }

    upsertDailyTableRecords(records);

    const range = { from: '2024-01-01', to: '2026-01-01' };
    const all = getDailyTableRecords('prune-user', range);

    // Should be capped at 500
    expect(all.length).toBe(500);
    // The first 10 should be gone.
    // i=0 is 2024-01-01, so i=10 is 2024-01-11.
    // If we remove 10, the new index 0 should be the old index 10.
    expect(all[0].recordDate).toMatch(/2024-01-11/);
  });
});
