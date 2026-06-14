import { describe, expect, it, vi } from 'vitest';
import { ActivityDiaryDataAccess } from './DataAccess';
import type { ADMapping } from '../constants';
import type { SpFetchFn } from '@/lib/sp/spLists';

const jsonResponse = (value: unknown): Response =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('ActivityDiaryDataAccess', () => {
  const defaultMapping: ADMapping = {
    userId: 'UserID',
    date: 'Date',
    shift: 'Shift',
    category: 'Category',
    lunchAmount: 'LunchAmount',
    mealMain: 'MealMain',
    mealSide: 'MealSide',
    problemBehavior: 'ProblemBehavior',
    behaviorType: 'BehaviorType',
    behaviorNote: 'BehaviorNote',
    seizure: 'Seizure',
    seizureAt: 'SeizureAt',
    goals: 'Goals',
    notes: 'Notes',
  };

  it('loads a date with field mapping and normalized filters', async () => {
    const response = {
      value: [
        { Id: 101, Title: 'entry-101' },
        { Id: 102, Title: 'entry-102' },
      ],
    };
    const spFetch = vi.fn<SpFetchFn>().mockResolvedValue(jsonResponse(response));
    const access = new ActivityDiaryDataAccess(spFetch);

    const result = await access.loadByDate(
      '2026-06-10',
      "OU''Neil",
      'lists/ActivityDiary',
      defaultMapping,
    );

    expect(result).toEqual(response.value);
    const [url] = spFetch.mock.calls[0]!;
    const parsed = new URL(url as string, 'https://example.invalid');
    expect(parsed.pathname).toBe('/lists/ActivityDiary/items');
    const filter = parsed.searchParams.get('$filter');
    expect(filter).toContain("Date eq '2026-06-10'");
    expect(filter).toContain("UserID eq 'OU''''Neil'");
    expect(parsed.searchParams.get('$orderby')).toBe('Id desc');
    expect(parsed.searchParams.get('$select')).toContain('LunchAmount');
    expect(parsed.searchParams.get('$orderby')).toBe('Id desc');
    expect(parsed.searchParams.get('$top')).toBeNull();
  });

  it('lists with date range and default top', async () => {
    const spFetch = vi.fn<SpFetchFn>().mockResolvedValue(jsonResponse({ value: [{ Id: 1 }, { Id: 2 }] }));
    const access = new ActivityDiaryDataAccess(spFetch);

    await access.list('2026-06-01', '2026-06-30', 'lists/ActivityDiary', defaultMapping);

    const [url] = spFetch.mock.calls[0]!;
    const parsed = new URL(url as string, 'https://example.invalid');
    expect(parsed.pathname).toBe('/lists/ActivityDiary/items');
    expect(parsed.searchParams.get('$top')).toBe('5000');
    expect(parsed.searchParams.get('$filter')).toContain("Date ge '2026-06-01'");
    expect(parsed.searchParams.get('$filter')).toContain("Date le '2026-06-30'");
  });
});
