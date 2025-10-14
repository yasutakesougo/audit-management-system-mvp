import { beforeEach, describe, expect, it } from 'vitest';
import * as demo from '@/adapters/schedules/demo';

const iso = (day: string, hour: number) => `${day}T${String(hour).padStart(2, '0')}:00:00.000Z`;

describe('schedules demo adapter', () => {
  beforeEach(() => {
    demo.__resetForTests();
  });

  it('lists schedules with optional day filtering without mutating store', async () => {
    const created = await demo.create({
      assignee: 'staff-002',
      title: 'Visit PM',
      start: iso('2025-01-11', 12),
      end: iso('2025-01-11', 14),
    });

    const all = await demo.list();
    expect(all.some((item) => item.id === created.id)).toBe(true);

    const filtered = await demo.list('2025-01-11');
    expect(filtered).toEqual(expect.arrayContaining([expect.objectContaining({ id: created.id })]));
    expect(filtered).not.toBe(all); // ensure returned copies
  });

  it('creates schedules with defaults, updates fields, and removes entries', async () => {
    const created = await demo.create({
      assignee: 'staff-003',
      title: 'Check-in',
      start: iso('2025-01-12', 9),
      end: iso('2025-01-12', 10),
    });
    expect(created.status).toBe('planned');
    expect(created.id).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);

    const updated = await demo.update(created.id, { title: 'Updated title' });
    expect(updated.title).toBe('Updated title');
    expect(updated.id).toBe(created.id);

    await demo.remove(created.id);
    const remaining = await demo.list();
    expect(remaining.some((item) => item.id === created.id)).toBe(false);
  });

  it('detects conflicts only for overlapping assignments', async () => {
    const base = await demo.create({
      assignee: 'staff-004',
      title: 'Morning shift',
      start: iso('2025-01-13', 9),
      end: iso('2025-01-13', 11),
    });

    const conflicts = await demo.checkConflicts(base.assignee, iso('2025-01-13', 10), iso('2025-01-13', 12));
    expect(conflicts).toBe(true);

    const otherAssignee = await demo.checkConflicts('staff-other', iso('2025-01-13', 10), iso('2025-01-13', 12));
    expect(otherAssignee).toBe(false);

    const invalidRange = await demo.checkConflicts(base.assignee, 'invalid-start', 'invalid-end');
    expect(invalidRange).toBe(false);
  });

  it('honors abort signals across operations', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(demo.list(undefined, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    await expect(demo.create({
      assignee: 'staff-005',
      title: 'Abort',
      start: iso('2025-01-14', 9),
      end: iso('2025-01-14', 10),
    }, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
});
