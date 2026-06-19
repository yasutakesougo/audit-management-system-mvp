import { describe, expect, it, vi } from 'vitest';
import { RowAggregateAccess } from './RowAggregateAccess';
import type { RowAggregateSource } from '../constants';
import type { SpFetchFn } from '@/lib/sp/spLists';

const jsonResponse = (value: unknown): Response =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('RowAggregateAccess', () => {
  it('aggregates rows by date and merges duplicate users', async () => {
    const source: RowAggregateSource = {
      listPath: 'lists/DailyRows',
      listTitle: 'DailyRows',
      dateField: 'cr013_date',
      selectFields: ['Id', 'cr013_personId', 'Title', 'cr013_date', 'cr013_payload', 'cr013_kind'],
    };

    const spFetch = vi.fn<SpFetchFn>(async (url) => {
      if (url.startsWith('lists/DailyRows/items?')) {
        return jsonResponse({
          value: [
            {
              Id: 1,
              cr013_personId: 'U-001',
              Title: 'Alice',
              cr013_date: '2026-06-10',
              cr013_kind: 'A',
              cr013_payload: JSON.stringify({
                amActivities: ['walk'],
                pmActivities: ['study'],
                specialNotes: 'first',
              }),
            },
            {
              Id: 2,
              cr013_personId: 'U-001',
              Title: 'Alice',
              cr013_date: '2026-06-10',
              cr013_kind: 'A',
              cr013_payload: JSON.stringify({
                pmActivities: ['rest'],
                specialNotes: 'second',
              }),
            },
            {
              Id: 3,
              cr013_personId: 'U-002',
              Title: 'Bob',
              cr013_date: '2026-06-11',
              cr013_kind: 'A',
              cr013_payload: JSON.stringify({
                amActivities: ['meal'],
                specialNotes: 'single',
              }),
            },
            {
              Id: 4,
              cr013_personId: 'U-003',
              Title: 'Carol',
              cr013_date: '2026-05-31',
              cr013_kind: 'A',
              cr013_payload: JSON.stringify({
                amActivities: ['skip'],
              }),
            },
          ],
        });
      }
      return jsonResponse({ value: [] });
    });

    const access = new RowAggregateAccess(spFetch);
    const result = await access.list(source, { range: { startDate: '2026-06-10', endDate: '2026-06-11' } });

    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2026-06-11');
    expect(result[0].userRows).toHaveLength(1);
    expect(result[0].userRows[0]).toMatchObject({ userId: 'U-002', userName: 'Bob', specialNotes: 'single' });

    expect(result[1].date).toBe('2026-06-10');
    expect(result[1].userRows).toHaveLength(1);
    expect(result[1].userRows[0]).toMatchObject({ userId: 'U-001', userName: 'Alice', amActivity: 'walk', pmActivity: 'study' });
    expect(result[1].userRows[0].specialNotes).toBe('first\nsecond');
  });

  it('respects SP top and date-range sorting order', async () => {
    const source: RowAggregateSource = {
      listPath: 'lists/DailyRows',
      listTitle: 'DailyRows',
      dateField: 'cr013_date',
      selectFields: ['Id', 'cr013_personId', 'Title', 'cr013_date', 'cr013_payload', 'cr013_kind'],
    };

    const spFetch = vi.fn<SpFetchFn>().mockResolvedValue(jsonResponse({ value: [] }));

    const access = new RowAggregateAccess(spFetch);
    await access.list(source, { range: { startDate: '2026-01-01', endDate: '2026-01-31' }, limit: 2 });

    const [url] = spFetch.mock.calls[0]!;
    const parsed = new URL(url as string, 'https://example.invalid');
    expect(parsed.pathname).toBe('/lists/DailyRows/items');
    expect(parsed.searchParams.get('$top')).toBe('2');
    expect(parsed.searchParams.get('$orderby')).toBe('Id desc');
  });
});
