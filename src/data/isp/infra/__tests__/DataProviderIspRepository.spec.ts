import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataProviderIspRepository } from '../DataProviderIspRepository';
import { emitDriftRecord } from '@/features/diagnostics/drift/domain/driftLogic';
import { AuthRequiredError } from '@/lib/errors';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { 
  ISP_MASTER_CANDIDATES,
  ISP_MASTER_ESSENTIALS 
} from '@/sharepoint/fields/ispThreeLayerFields';

vi.mock('@/features/diagnostics/drift/domain/driftLogic', () => ({
  emitDriftRecord: vi.fn(),
}));

describe('DataProviderIspRepository', () => {
  let mockProvider: any;
  let repository: DataProviderIspRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProvider = {
      getFieldInternalNames: vi.fn(),
      getItemById: vi.fn(),
      listItems: vi.fn(),
    };
    repository = new DataProviderIspRepository(mockProvider as unknown as IDataProvider, 'ISP_Master');
  });

  describe('drift resilience and error fallback', () => {
    it('should call emitDriftRecord when an essential field drifts', async () => {
      // Simulate that essential field 'planStartDate' drifts to 'planStartDate0'
      const essentialKey = 'planStartDate';
      const driftName = 'planStartDate0';
      
      const candidates = { ...(ISP_MASTER_CANDIDATES as unknown as Record<string, string[]>) };

      const availableSet = new Set<string>();
      Object.entries(candidates).forEach(([key, val]) => {
        if (key === essentialKey) {
          availableSet.add(driftName);
        } else {
          availableSet.add(val[0]);
        }
      });

      mockProvider.getFieldInternalNames.mockResolvedValue(availableSet);
      mockProvider.getItemById.mockResolvedValue({
        ID: 123,
        Title: 'ISP 123',
        UserCode: 'user-001',
        [driftName]: '2026-05-22T00:00:00Z',
        Status: 'active',
        VersionNo: 1,
        IsCurrent: true,
      });

      const result = await repository.getById('sp-123');

      expect(result).toBeDefined();
      
      // Verify emitDriftRecord is called for the essential field drift
      expect(emitDriftRecord).toHaveBeenCalledWith(
        'ISP_Master',
        essentialKey,
        'fuzzy_match',
        'suffix_mismatch',
        undefined,
        'warn'
      );
    });

    it('should NOT call emitDriftRecord when a non-essential field drifts', async () => {
      // Find a non-essential field candidate
      const essentials = new Set(ISP_MASTER_ESSENTIALS as unknown as string[]);
      const candidates = ISP_MASTER_CANDIDATES as unknown as Record<string, string[]>;
      const nonEssentialKey = Object.keys(candidates).find(key => !essentials.has(key));
      
      if (!nonEssentialKey) {
        throw new Error('Test setup error: No non-essential field found in ISP_MASTER_CANDIDATES');
      }

      const driftName = `${nonEssentialKey}0`;

      const availableSet = new Set<string>();
      Object.entries(candidates).forEach(([key, val]) => {
        if (key === nonEssentialKey) {
          availableSet.add(driftName);
        } else {
          availableSet.add(val[0]);
        }
      });

      mockProvider.getFieldInternalNames.mockResolvedValue(availableSet);
      mockProvider.getItemById.mockResolvedValue({
        ID: 123,
        Title: 'ISP 123',
        UserCode: 'user-001',
        PlanStartDate: '2026-05-22T00:00:00Z',
        Status: 'active',
        VersionNo: 1,
        IsCurrent: true,
        [driftName]: 'some-val',
      });

      const result = await repository.getById('sp-123');

      expect(result).toBeDefined();

      // Verify emitDriftRecord is NOT called for non-essential field drift
      expect(emitDriftRecord).not.toHaveBeenCalled();
    });

    it('should fall back to default behavior when getFieldInternalNames fails with generic error', async () => {
      mockProvider.getFieldInternalNames.mockRejectedValue(new Error('SharePoint request failed'));
      
      const result = await repository.getById('sp-123');
      
      expect(result).toBeNull();
    });

    it('should propagate AuthRequiredError when resolveSource throws it', async () => {
      const authError = new AuthRequiredError('Auth failed');
      mockProvider.getFieldInternalNames.mockRejectedValue(authError);
      
      await expect(
        repository.listByUser('user-001')
      ).rejects.toThrow(authError);
    });
  });
});
