import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryAssignmentRepository } from '../infra/InMemoryAssignmentRepository';
import { TransportAssignment } from '../domain/assignment';

describe('InMemoryAssignmentRepository', () => {
  let repo: InMemoryAssignmentRepository;

  beforeEach(() => {
    repo = new InMemoryAssignmentRepository();
  });

  it('should create and list assignments', async () => {
    const data: Omit<TransportAssignment, 'id'> = {
      type: 'transport',
      title: 'Morning Route',
      start: '2026-04-23T08:00:00',
      end: '2026-04-23T09:00:00',
      status: 'planned',
      direction: 'to',
      userIds: ['u1'],
      assistantStaffIds: [],
    };

    const created = await repo.create(data);
    expect(created.id).toBeDefined();
    expect(created.title).toBe(data.title);

    const list = await repo.list({});
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(created.id);
  });

  it('should filter by date range', async () => {
    await repo.create({
      type: 'transport',
      title: 'Morning',
      start: '2026-04-23T08:00:00',
      end: '2026-04-23T09:00:00',
      status: 'planned',
      direction: 'to',
      userIds: [],
      assistantStaffIds: [],
    } as any);

    const results = await repo.list({
      range: {
        from: '2026-04-23T09:30:00',
        to: '2026-04-23T10:30:00',
      }
    });

    expect(results).toHaveLength(0);
  });

  it('should filter by resourceId', async () => {
    await repo.create({
      type: 'transport',
      title: 'Bus A',
      start: '2026-04-23T08:00:00',
      end: '2026-04-23T09:00:00',
      status: 'planned',
      direction: 'to',
      vehicleId: 'V1',
      userIds: [],
      assistantStaffIds: [],
    } as any);

    const results = await repo.list({ resourceId: 'V1' });
    expect(results).toHaveLength(1);

    const other = await repo.list({ resourceId: 'V2' });
    expect(other).toHaveLength(0);
  });
});
