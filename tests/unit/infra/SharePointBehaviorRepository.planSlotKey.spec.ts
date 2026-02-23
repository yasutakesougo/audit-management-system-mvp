import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SharePointBehaviorRepository } from '@/features/daily/infra/SharePointBehaviorRepository';

const requiredFields = new Set([
  'Id',
  'UserCode',
  'RecordDate',
  'TimeSlot',
  'PlanSlotKey',
  'PlannedActivity',
  'RecordedAtText',
  'Observation',
  'Behavior',
  'version',
  'duration',
  'Order',
  'Created',
  'Modified',
]);

describe('SharePointBehaviorRepository planSlotKey mapping', () => {
  let mockSp: {
    getListFieldInternalNames: ReturnType<typeof vi.fn>;
    spFetch: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockSp = {
      getListFieldInternalNames: vi.fn().mockResolvedValue(requiredFields),
      spFetch: vi.fn(),
    };
  });

  it('parses Observation JSON meta into top-level domain fields on listByUser', async () => {
    mockSp.spFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          value: [
            {
              Id: 1,
              UserCode: 'I022',
              RecordDate: '2026-02-22T10:00:00.000Z',
              TimeSlot: '10:00',
              Behavior: '作業中断',
              version: 3,
              duration: 5,
              Observation: JSON.stringify({
                text: 'てst',
                meta: {
                  planSlotKey: '10:00|作業活動',
                  recordedAt: '19:23',
                  plannedActivity: '作業活動',
                },
              }),
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const repo = new SharePointBehaviorRepository({ sp: mockSp as never });
    const result = await repo.listByUser('I022');

    expect(result).toHaveLength(1);
    expect(result[0].actualObservation).toBe('てst');
    expect(result[0].planSlotKey).toBe('10:00|作業活動');
    expect(result[0].plannedActivity).toBe('作業活動');
    expect(result[0].recordedAt).toBe('19:23');
    expect(result[0].timeSlot).toBe('10:00');
  });

  it('prefers normalized columns over Observation meta on listByUser', async () => {
    mockSp.spFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          value: [
            {
              Id: 2,
              UserCode: 'I022',
              RecordDate: '2026-02-22T10:00:00.000Z',
              TimeSlot: '10:00',
              PlanSlotKey: '10:00|列優先',
              PlannedActivity: '列優先',
              RecordedAtText: '19:24',
              Behavior: '作業中断',
              version: 3,
              duration: 5,
              Observation: JSON.stringify({
                text: 'てst',
                meta: {
                  planSlotKey: '10:00|meta',
                  recordedAt: '19:23',
                  plannedActivity: 'meta',
                },
              }),
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const repo = new SharePointBehaviorRepository({ sp: mockSp as never });
    const result = await repo.listByUser('I022');

    expect(result).toHaveLength(1);
    expect(result[0].planSlotKey).toBe('10:00|列優先');
    expect(result[0].plannedActivity).toBe('列優先');
    expect(result[0].recordedAt).toBe('19:24');
    expect(result[0].actualObservation).toBe('てst');
  });

  it('preserves planSlotKey metadata after add even when create response is sparse', async () => {
    mockSp.spFetch.mockResolvedValue(
      new Response(JSON.stringify({ Id: 99 }), { status: 201 }),
    );

    const repo = new SharePointBehaviorRepository({ sp: mockSp as never });
    const saved = await repo.add({
      userId: 'I022',
      timestamp: '2026-02-22T10:00:00.000Z',
      antecedent: null,
      behavior: '作業中断',
      consequence: null,
      intensity: 3,
      timeSlot: '10:00',
      plannedActivity: '作業活動',
      planSlotKey: '10:00|作業活動',
      recordedAt: '19:23',
      actualObservation: 'てst',
    });

    expect(saved.id).toBe('99');
    expect(saved.timeSlot).toBe('10:00');
    expect(saved.planSlotKey).toBe('10:00|作業活動');
    expect(saved.plannedActivity).toBe('作業活動');
    expect(saved.recordedAt).toBe('19:23');
    expect(saved.actualObservation).toBe('てst');

    const called = mockSp.spFetch.mock.calls[0]?.[1];
    const body = JSON.parse(String(called?.body)) as Record<string, unknown>;
    expect(body.PlanSlotKey).toBe('10:00|作業活動');
    expect(body.PlannedActivity).toBe('作業活動');
    expect(body.RecordedAtText).toBe('19:23');
  });

  it('rejects add when timeSlot exists without planSlotKey', async () => {
    const repo = new SharePointBehaviorRepository({ sp: mockSp as never });

    await expect(
      repo.add({
        userId: 'I022',
        timestamp: '2026-02-22T10:00:00.000Z',
        antecedent: null,
        behavior: '作業中断',
        consequence: null,
        intensity: 3,
        timeSlot: '10:00',
        plannedActivity: '作業活動',
        recordedAt: '19:23',
        actualObservation: 'てst',
      }),
    ).rejects.toThrow(/planSlotKey is required/i);
  });
});
