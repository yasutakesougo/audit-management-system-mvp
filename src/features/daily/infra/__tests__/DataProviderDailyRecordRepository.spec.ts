import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DataProviderDailyRecordRepository } from '../DataProviderDailyRecordRepository';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';

describe('DataProviderDailyRecordRepository (Contract Tests)', () => {
  const mockProvider = {
    getFieldInternalNames: vi.fn().mockResolvedValue([
      'Title', 'RecordDate', 'ReporterName', 'ReporterRole', 'UserRowsJSON', 'UserCount'
    ]),
    createItem: vi.fn().mockImplementation((_list, payload) => Promise.resolve({ Id: '101', ...payload })),
    updateItem: vi.fn().mockImplementation((_list, id, payload) => Promise.resolve({ Id: id, ...payload })),
    listItems: vi.fn().mockResolvedValue([]),
  } as unknown as IDataProvider;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const repo = new DataProviderDailyRecordRepository({
    provider: mockProvider,
    listTitle: 'SupportRecord_Daily',
  });

  const sampleInput = {
    date: '2026-04-24',
    reporter: { name: 'Staff A', role: 'Leader' },
    userRows: [{ userId: 'user1', userName: 'User One', amActivity: 'Test' }],
    userCount: 1,
  };

  it('should call createItem when record does not exist', async () => {
    // Mock load to return null (no existing record)
    vi.mocked(mockProvider.listItems).mockResolvedValueOnce([]);

    await repo.save(sampleInput as any);

    expect(mockProvider.createItem).toHaveBeenCalled();
    expect(mockProvider.updateItem).not.toHaveBeenCalled();
    
    const payload = vi.mocked(mockProvider.createItem).mock.calls[0][1] as Record<string, any>;
    expect(payload.Title).toBe('2026-04-24');
    expect(payload.ReporterName).toBe('Staff A');
  });

  it('should call updateItem when record exists and has changes', async () => {
    // Mock load to return existing record
    vi.mocked(mockProvider.listItems).mockResolvedValueOnce([{
      Id: '101',
      Title: '2026-04-24',
      ReporterName: 'Old Staff',
      UserRowsJSON: JSON.stringify([]),
    }]);

    await repo.save(sampleInput as any);

    expect(mockProvider.updateItem).toHaveBeenCalledWith(expect.any(String), '101', expect.any(Object));
  });

  it('should skip updateItem (no-op) when no changes are detected', async () => {
    // Mock load to return EXACTLY the same data
    vi.mocked(mockProvider.listItems).mockResolvedValueOnce([{
      Id: '101',
      Title: sampleInput.date,
      ReporterName: sampleInput.reporter.name,
      ReporterRole: sampleInput.reporter.role,
      UserRowsJSON: JSON.stringify(sampleInput.userRows),
      UserCount: sampleInput.userCount,
    }]);

    await repo.save(sampleInput as any);

    // Should NOT call updateItem or createItem
    expect(mockProvider.updateItem).not.toHaveBeenCalled();
    expect(mockProvider.createItem).not.toHaveBeenCalled();
  });

  it('should normalize empty reporter name to null (clear)', async () => {
    // Mock load to return null
    vi.mocked(mockProvider.listItems).mockResolvedValueOnce([]);

    const inputWithClear = {
      ...sampleInput,
      reporter: { name: '  ', role: 'Leader' }, // Whitespace
    };

    await repo.save(inputWithClear as any);

    const payload = vi.mocked(mockProvider.createItem).mock.calls[0][1] as Record<string, any>;
    expect(payload.ReporterName).toBe(null);
  });
});
