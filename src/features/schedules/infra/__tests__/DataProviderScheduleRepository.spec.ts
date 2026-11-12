import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DataProviderScheduleRepository } from '../DataProviderScheduleRepository';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';

describe('DataProviderScheduleRepository (Stability Tests)', () => {
  const mockProvider = {
    getFieldInternalNames: vi.fn().mockResolvedValue([
      'Title', 'EventDate', 'EndDate', 'Status', 'Category', 'TargetUserId', 'Note', 'RowKey'
    ]),
    createItem: vi.fn().mockImplementation((_list, payload) => Promise.resolve({ Id: '101', ...payload })),
    updateItem: vi.fn().mockImplementation((_list, id, payload) => Promise.resolve({ Id: id, ...payload })),
    getItemById: vi.fn().mockResolvedValue({ Id: '1', Title: 'Old' }),
  } as unknown as IDataProvider;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const repo = new DataProviderScheduleRepository({
    provider: mockProvider,
    listTitle: 'TestSchedules',
  });

  it('should treat empty string as null (clear) and skip undefined fields in update', async () => {
    const input = {
      id: '1',
      title: 'New Title',
      notes: '', // Should be normalized to null
      status: undefined, // Should be skipped from payload
      category: 'User', // Should be mapped to Category
      startLocal: '2026-04-24T10:00:00Z',
      endLocal: '2026-04-24T11:00:00Z',
      etag: 'W/"1"',
    };

    await repo.update(input as any);

    const updateCalls = vi.mocked(mockProvider.updateItem).mock.calls;
    expect(updateCalls.length).toBe(1);
    const payload = updateCalls[0][2] as Record<string, any>;

    // 1. Empty string -> null conversion
    expect(payload).toHaveProperty('Note', null);
    
    // 2. undefined -> skipped
    expect(payload).not.toHaveProperty('Status');

    // 3. Category mapping
    expect(payload).toHaveProperty('Category', 'User');

    // 4. Essential fields correctly passed
    expect(payload).toHaveProperty('Title', 'New Title');
  });

  it('should support partial updates by skipping undefined essential fields', async () => {
    const input = {
      id: '1',
      // title is missing (undefined)
      notes: 'Just updating notes',
      startLocal: '2026-04-24T10:00:00Z', // Provide to satisfy mapper
      endLocal: '2026-04-24T11:00:00Z',   // Provide to satisfy mapper
      etag: 'W/"1"',
    };

    // Improve mock to return mandatory fields for mapping
    vi.mocked(mockProvider.updateItem).mockImplementationOnce((_list, id, p) => Promise.resolve({
      Id: id,
      EventDate: '2026-04-24T10:00:00Z',
      EndDate: '2026-04-24T11:00:00Z',
      ...p
    }));

    await repo.update(input as any);

    const payload = vi.mocked(mockProvider.updateItem).mock.calls[0][2] as Record<string, any>;

    expect(payload).toHaveProperty('Note', 'Just updating notes');
    expect(payload).not.toHaveProperty('Title'); // Should not be in payload if undefined
  });

  it('should include category in create operation', async () => {
    const input = {
      title: 'New Event',
      category: 'Staff',
      startLocal: '2026-04-24T10:00:00Z',
      endLocal: '2026-04-24T11:00:00Z',
    };

    await repo.create(input as any);

    const createCalls = vi.mocked(mockProvider.createItem).mock.calls;
    const payload = createCalls[0][1] as Record<string, any>;

    expect(payload).toHaveProperty('Category', 'Staff');
    expect(payload).toHaveProperty('Title', 'New Event');
  });

  it('should treat whitespace-only strings as null in normalizeClearableValue', async () => {
    const input = {
      id: '1',
      locationName: '   ', // Whitespace only
      etag: 'W/"1"',
    };

    // Need to mock LocationName candidate resolution for this test
    vi.mocked(mockProvider.getFieldInternalNames).mockResolvedValueOnce(new Set([
      'Title', 'EventDate', 'EndDate', 'LocationName'
    ]));

    // Force re-resolution for this specific test case if needed, 
    // but the repo instance might have cached fields.
    // We create a fresh repo to be sure.
    const freshRepo = new DataProviderScheduleRepository({ provider: mockProvider, listTitle: 'Fresh' });

    // Improve mock for the final test
    vi.mocked(mockProvider.updateItem).mockImplementationOnce((_list, id, p) => Promise.resolve({
      Id: id,
      EventDate: '2026-04-24T10:00:00Z',
      EndDate: '2026-04-24T11:00:00Z',
      ...p
    }));

    await freshRepo.update(input as any);

    const payload = vi.mocked(mockProvider.updateItem).mock.calls[0][2] as Record<string, any>;
    
    // 1. Whitespace only -> null
    expect(payload).toHaveProperty('LocationName', null);
  });

  it('should skip API call (no-op) when update payload is empty', async () => {
    const input = {
      id: '1',
      // No actual changes (only etag and undefined fields)
      etag: 'W/"1"',
    };

    const existingItem = { id: '1', title: 'Existing' };
    // getById is called by no-op guard
    vi.spyOn(repo, 'getById').mockResolvedValueOnce(existingItem as any);

    const result = await repo.update(input as any);

    // updateItem should NOT be called
    expect(mockProvider.updateItem).not.toHaveBeenCalled();
    // result should be the existing item
    expect(result).toEqual(existingItem);
  });

  it('forwards an abort signal and leaves a call without one unchanged', async () => {
    const controller = new AbortController();
    const input = {
      id: '1',
      title: 'Signalled update',
      startLocal: '2026-04-24T10:00:00Z',
      endLocal: '2026-04-24T11:00:00Z',
      etag: 'W/"1"',
    };
    vi.mocked(mockProvider.updateItem).mockImplementation((_list, id, payload) => Promise.resolve({
      Id: id,
      EventDate: '2026-04-24T10:00:00Z',
      EndDate: '2026-04-24T11:00:00Z',
      ...payload,
    }));

    await repo.update(input as never, { signal: controller.signal });
    const signalled = vi.mocked(mockProvider.updateItem).mock.calls.at(-1)?.[3] as { etag?: string; signal?: AbortSignal };
    expect(signalled).toMatchObject({ etag: 'W/"1"', signal: controller.signal });

    await repo.update(input as never);
    const plain = vi.mocked(mockProvider.updateItem).mock.calls.at(-1)?.[3] as { signal?: AbortSignal };
    expect(plain.etag).toBe('W/"1"');
    expect(plain.signal).toBeUndefined();
  });

  it('limits an assignment write to vehicle, staff, and notes and refuses a non-real ETag', async () => {
    const provider = {
      getFieldInternalNames: vi.fn().mockResolvedValue([
        'Title', 'EventDate', 'EndDate', 'VehicleId', 'AssignedStaffId', 'Note', 'TargetUserId',
      ]),
      updateItem: vi.fn().mockImplementation((_list, id, payload) => Promise.resolve({
        Id: id,
        Title: '送迎',
        EventDate: '2026-11-11T08:00:00Z',
        EndDate: '2026-11-11T09:00:00Z',
        ...payload,
      })),
      readItemEtag: vi.fn().mockResolvedValue({
        item: {
          Id: 7,
          Title: '送迎',
          EventDate: '2026-11-11T08:00:00Z',
          EndDate: '2026-11-11T09:00:00Z',
          TargetUserId: 'U001',
          '@odata.etag': '"sp-7"',
        },
        etag: '"8,1"',
      }),
    };
    const local = new DataProviderScheduleRepository({ provider: provider as never, listTitle: 'Schedules' });
    const read = await local.readTransportRowEtag('7');
    expect(read?.etag).toBe('"8,1"');

    await local.update({
      id: '7',
      etag: '"8,1"',
      vehicleId: '車両1',
      assignedStaffId: 'S001',
      notes: '玄関',
    }, { assignmentWrite: { conflictRetry: 'none' } });

    const payload = provider.updateItem.mock.calls[0][2] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(['AssignedStaffId', 'Note', 'VehicleId']);
    expect(payload).not.toHaveProperty('EventDate');
    expect(payload).not.toHaveProperty('TargetUserId');
    expect(provider.updateItem.mock.calls[0][3]).toMatchObject({ etag: '"8,1"', conflictRetry: 'none' });

    await expect(local.update(
      { id: '7', etag: '*', vehicleId: '車両2' },
      { assignmentWrite: { conflictRetry: 'none' } },
    )).rejects.toThrow(/real SharePoint ETag/);
    await expect(local.update(
      { id: '7', etag: '"sp-7"', vehicleId: '車両2' },
      { assignmentWrite: { conflictRetry: 'none' } },
    )).rejects.toThrow(/real SharePoint ETag/);
    expect(provider.updateItem).toHaveBeenCalledTimes(1);
  });
});
