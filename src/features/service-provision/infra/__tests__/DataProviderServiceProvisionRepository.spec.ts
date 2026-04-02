import { describe, it, expect, vi, type Mock } from 'vitest';
import { DataProviderServiceProvisionRepository } from '../DataProviderServiceProvisionRepository';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import type { UpsertProvisionInput } from '../../domain/types';

describe('DataProviderServiceProvisionRepository (Dynamic Schema)', () => {
  const mockProvider = {
    getFieldInternalNames: vi.fn(),
    listItems: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
  } as unknown as IDataProvider;

  it('should resolve drifted field names and fetch items correctly', async () => {
    // 1. Setup Drift (RecordDate -> RecordDate0)
    (mockProvider.getFieldInternalNames as Mock).mockResolvedValue(new Set(['EntryKey', 'UserCode', 'RecordDate0', 'Status']));
    (mockProvider.listItems as Mock).mockResolvedValue([
      { Id: 1, EntryKey: 'U123_2026-04-01', UserCode: 'U123', 'RecordDate0': '2026-04-01T00:00:00Z', Status: '提供' }
    ]);

    const repo = new DataProviderServiceProvisionRepository({ provider: mockProvider });
    const result = await repo.getByEntryKey('U123_2026-04-01');

    // 2. Verify Mapping (Internal Key 'recordDate' should be mapped to 'RecordDate0')
    expect(result).not.toBeNull();
    expect(result?.recordDateISO).toBe('2026-04-01');
    
    // 3. Verify select contains drifted name
    const lastCall = (mockProvider.listItems as Mock).mock.calls[0][1];
    expect(lastCall.select).toContain('RecordDate0');
    expect(lastCall.filter).toContain('EntryKey eq \'U123_2026-04-01\'');
  });

  it('should use drifted field names during upsert (Update)', async () => {
    // Setup Drift
    (mockProvider.getFieldInternalNames as Mock).mockResolvedValue(new Set(['EntryKey', 'UserCode', 'RecordDate0', 'Status']));
    (mockProvider.listItems as Mock).mockResolvedValueOnce([
      { Id: 1, EntryKey: 'U123_2026-04-01', UserCode: 'U123', RecordDate0: '2026-04-01', Status: '提供' }
    ]);

    const repo = new DataProviderServiceProvisionRepository({ provider: mockProvider });
    await repo.upsertByEntryKey({
      userCode: 'U123',
      recordDateISO: '2026-04-01',
      status: '欠席',
    } as UpsertProvisionInput);

    // Verify key translation in update body (RecordDate -> RecordDate0)
    const updateBody = (mockProvider.updateItem as Mock).mock.calls[0][2];
    expect(updateBody.RecordDate0).toBe('2026-04-01');
    expect(updateBody.Status).toBe('欠席');
  });

  it('should handle missing essential fields by warning but continuing', async () => {
    // Setup Critical Failure (Missing EntryKey)
    (mockProvider.getFieldInternalNames as Mock).mockResolvedValue(new Set(['UserCode', 'RecordDate']));
    
    const repo = new DataProviderServiceProvisionRepository({ provider: mockProvider });
    const result = await repo.getByEntryKey('ABC');
    
    expect(result).toBeNull(); // Should safely return null
  });
});
