import { describe, expect, it, vi } from 'vitest';
import { SharePointDailyRecordRepository } from '../SharePointDailyRecordRepository';

const jsonResponse = (value: unknown): Response =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('SharePointDailyRecordRepository row-aggregate fallback', () => {
  it('aggregates row-based cr013 records into DailyRecordItem[] when canonical schema is absent', async () => {
    const spFetch = vi.fn(async (path: string) => {
      if (path.startsWith('lists?$select=Title&$top=5000')) {
        return jsonResponse({
          value: [{ Title: 'SupportRecord_Daily' }],
        });
      }

      if (path.includes("lists/getbytitle('SupportRecord_Daily')/fields")) {
        return jsonResponse({
          value: [
            { InternalName: 'Id' },
            { InternalName: 'Title' },
            { InternalName: 'cr013_personId' },
            { InternalName: 'cr013_date' },
            { InternalName: 'cr013_status' },
            { InternalName: 'cr013_reporterName' },
            { InternalName: 'cr013_payload' },
            { InternalName: 'Created' },
            { InternalName: 'Modified' },
          ],
        });
      }

      if (path.includes("lists/getbytitle('SupportRecord_Daily')/items?")) {
        return jsonResponse({
          value: [
            {
              Id: 3,
              Title: '利用者A',
              cr013_personId: 'U001',
              cr013_date: '2026-03-29',
              cr013_status: '完了',
              cr013_reporterName: '記録者1',
              cr013_payload: JSON.stringify({
                amActivities: ['散歩'],
                pmActivities: [],
                specialNotes: '午前記録',
                behaviorTags: [],
              }),
            },
            {
              Id: 2,
              Title: '利用者A',
              cr013_personId: 'U001',
              cr013_date: '2026-03-29',
              cr013_status: '完了',
              cr013_reporterName: '記録者1',
              cr013_payload: JSON.stringify({
                amActivities: [],
                pmActivities: ['創作'],
                specialNotes: '午後記録',
                behaviorTags: [],
              }),
            },
            {
              Id: 1,
              Title: '利用者B',
              cr013_personId: 'U002',
              cr013_date: '2026-03-29',
              cr013_status: '完了',
              cr013_reporterName: '記録者1',
              cr013_payload: JSON.stringify({
                specialNotes: '見守り',
                behaviorTags: [],
              }),
            },
          ],
        });
      }

      throw new Error(`Unexpected spFetch path: ${path}`);
    });

    const repo = new SharePointDailyRecordRepository({
      spFetch,
      listTitle: 'SupportRecord_Daily',
    });

    const records = await repo.list({
      range: { startDate: '2026-03-29', endDate: '2026-03-29' },
    });

    expect(records).toHaveLength(1);
    expect(records[0].date).toBe('2026-03-29');
    expect(records[0].userRows).toHaveLength(2);

    const userA = records[0].userRows.find((row) => row.userId === 'U001');
    expect(userA).toBeTruthy();
    expect(userA?.amActivity).toBe('散歩');
    expect(userA?.pmActivity).toBe('創作');
    expect(userA?.specialNotes).toContain('午前記録');
    expect(userA?.specialNotes).toContain('午後記録');
  });
});
