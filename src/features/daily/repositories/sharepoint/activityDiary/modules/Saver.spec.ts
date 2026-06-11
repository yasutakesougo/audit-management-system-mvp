import { describe, expect, it, vi } from 'vitest';
import { ActivityDiarySaver } from './Saver';
import { AD_FIELDS, type ADMapping } from '../constants';
import { spWriteResilient } from '@/lib/spWrite';

vi.mock('@/lib/spWrite', () => ({
  spWriteResilient: vi.fn(),
}));

describe('ActivityDiarySaver mapper boundaries', () => {
  const defaultMapping: ADMapping = {
    userId: AD_FIELDS.userId,
    date: AD_FIELDS.date,
    shift: AD_FIELDS.shift,
    category: AD_FIELDS.category,
    lunchAmount: AD_FIELDS.lunchAmount,
    mealMain: AD_FIELDS.mealMain,
    mealSide: AD_FIELDS.mealSide,
    problemBehavior: AD_FIELDS.problemBehavior,
    behaviorType: AD_FIELDS.behaviorType,
    behaviorNote: AD_FIELDS.behaviorNote,
    seizure: AD_FIELDS.seizure,
    seizureAt: AD_FIELDS.seizureAt,
    goals: AD_FIELDS.goals,
    notes: AD_FIELDS.notes,
  };

  const createResponse = () =>
    ({
      ok: true,
      status: 201,
      data: { id: 1 },
      etag: undefined,
      raw: new Response(),
    }) as const;

  it('maps mealMain "多め" to SharePoint lunch amount "8割"', async () => {
    vi.mocked(spWriteResilient).mockResolvedValue(createResponse());

    const saver = new ActivityDiarySaver(vi.fn());
    await saver.save(
      {
        userId: 'U001',
        dateISO: '2026-06-10',
        period: 'am',
        category: '日常',
        mealMain: '多め',
        mealSide: null,
        behavior: { has: false, kinds: [] },
        seizure: { has: false, at: null },
        goalIds: [],
        notes: null,
      },
      'lists/ActivityDiary',
      'ActivityDiary',
      defaultMapping,
    );

    const [options] = vi.mocked(spWriteResilient).mock.calls[0]!;
    const payload = options.body as Record<string, unknown>;

    expect(payload[AD_FIELDS.lunchAmount]).toBe('8割');
  });

  it('maps behavior.has=false to false/null fields for problem behavior payload', async () => {
    vi.mocked(spWriteResilient).mockResolvedValue(createResponse());

    const saver = new ActivityDiarySaver(vi.fn());
    await saver.save(
      {
        userId: 'U001',
        dateISO: '2026-06-10',
        period: 'pm',
        category: '日常',
        mealMain: null,
        mealSide: null,
        behavior: { has: false, kinds: ['離席'] },
        seizure: { has: false, at: null },
        goalIds: [],
        notes: null,
      },
      'lists/ActivityDiary',
      'ActivityDiary',
      defaultMapping,
    );

    const [options] = vi.mocked(spWriteResilient).mock.calls[0]!;
    const payload = options.body as Record<string, unknown>;

    expect(payload[AD_FIELDS.problemBehavior]).toBe(false);
    expect(payload[AD_FIELDS.behaviorType]).toBeNull();
    expect(payload[AD_FIELDS.behaviorNote]).toBeNull();
  });
});
