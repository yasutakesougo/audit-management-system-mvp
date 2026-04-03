import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataProviderStaffRepository } from '../DataProviderStaffRepository';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import type { Staff } from '@/types';

/**
 * DataProviderStaffRepository - Unit Tests
 */
describe('DataProviderStaffRepository', () => {
  let repository: DataProviderStaffRepository;
  let mockProvider: {
    getFieldInternalNames: ReturnType<typeof vi.fn>;
    getFieldDetails: ReturnType<typeof vi.fn>;
    createItem: ReturnType<typeof vi.fn>;
    updateItem: ReturnType<typeof vi.fn>;
    getItemById: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    const fieldMap = new Map();
    ['Title', 'StaffID', 'FullName', 'WorkDays', 'Certifications', 'IsActive', 'BaseWorkingDays'].forEach(name => {
      // WorkDays and Certifications are MultiChoice in a healthy environment
      const type = (name === 'WorkDays' || name === 'Certifications') ? 'MultiChoice' : 'Text';
      fieldMap.set(name, { InternalName: name, TypeAsString: type });
    });

    mockProvider = {
      getFieldInternalNames: vi.fn().mockResolvedValue(new Set(fieldMap.keys())),
      getFieldDetails: vi.fn().mockResolvedValue(fieldMap),
      createItem: vi.fn().mockResolvedValue({ Id: 1, Title: 'STF001', FullName: 'Test Staff', StaffID: 'STF001' }),
      updateItem: vi.fn(),
      getItemById: vi.fn(),
    };
    repository = new DataProviderStaffRepository({ provider: mockProvider as unknown as IDataProvider });
  });

  describe('toRequest Mapping (MultiChoice Hardening)', () => {
    it('sends empty arrays for MultiChoice fields if they are missing/null in payload', async () => {
      const payload: Partial<Staff> = {
        name: 'Test Staff',
        workDays: undefined, 
        certifications: [], 
        baseWorkingDays: undefined
      };

      await repository.create(payload);

      // Verify createItem call payload
      const sentPayload = mockProvider.createItem.mock.calls[0][1];
      
      // Values should be [] instead of null
      expect(sentPayload['WorkDays']).toEqual([]);
      expect(sentPayload['Certifications']).toEqual([]);
      expect(sentPayload['BaseWorkingDays']).toEqual([]);
    });

    it('preserves existing arrays if provided', async () => {
      const payload: Partial<Staff> = {
        name: 'Test Staff',
        workDays: ['Mon', 'Tue'],
        certifications: ['社会福祉士']
      };

      await repository.create(payload);

      const sentPayload = mockProvider.createItem.mock.calls[0][1];
      expect(sentPayload['WorkDays']).toEqual(['Mon', 'Tue']);
      expect(sentPayload['Certifications']).toEqual(['社会福祉士']);
    });
  });

  describe('toDomain Mapping', () => {
    it('correctly parses various string formats into arrays', () => {
      const raw = {
        Id: 1,
        FullName: 'Test',
        WorkDays: 'Mon, Tue, Wed', // Comma-separated
        BaseWorkingDays: '["Mon", "Fri"]', // JSON string
        Certifications: '社会福祉士', // Single value
      };

      const domain = (repository as unknown as { toDomain: (raw: unknown) => Staff }).toDomain(raw);

      expect(domain.workDays).toEqual(['Mon', 'Tue', 'Wed']);
      expect(domain.baseWorkingDays).toEqual(['Mon', 'Fri']);
      expect(domain.certifications).toEqual(['社会福祉士']);
    });

    it('handles empty or null values', () => {
      const raw = {
        Id: 2,
        FullName: 'Test Empty',
        WorkDays: null,
        Certifications: '',
      };

      const domain = (repository as unknown as { toDomain: (raw: unknown) => Staff }).toDomain(raw);

      expect(domain.workDays).toEqual([]);
      expect(domain.certifications).toEqual([]);
    });
  });
});
