import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataProviderProcedureRecordRepository } from '../DataProviderProcedureRecordRepository';
import { emitDriftRecord } from '@/features/diagnostics/drift/domain/driftLogic';
import { AuthRequiredError } from '@/lib/errors';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { 
  PROCEDURE_RECORD_CANDIDATES,
  PROCEDURE_RECORD_ESSENTIALS 
} from '@/sharepoint/fields/ispThreeLayerFields';

vi.mock('@/features/diagnostics/drift/domain/driftLogic', () => ({
  emitDriftRecord: vi.fn(),
}));

describe('DataProviderProcedureRecordRepository', () => {
  let mockProvider: any;
  let repository: DataProviderProcedureRecordRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProvider = {
      getFieldInternalNames: vi.fn(),
      getItemById: vi.fn(),
      listItems: vi.fn(),
    };
    repository = new DataProviderProcedureRecordRepository(mockProvider as unknown as IDataProvider, 'SupportProcedureRecord_Daily');
  });

  describe('drift resilience and error fallback', () => {
    it('should call emitDriftRecord when an essential field drifts', async () => {
      // Simulate that essential field 'planningSheetId' drifts to 'planningSheetId0'
      const essentialKey = 'planningSheetId';
      const driftName = 'planningSheetId0';
      
      const candidates = { ...(PROCEDURE_RECORD_CANDIDATES as unknown as Record<string, string[]>) };

      // Construct available fields by taking primary candidates but replacing the essential key
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
        [driftName]: 'sheet-123',
      });

      // Call getById which triggers resolveSource
      const result = await repository.getById('sp-123');

      expect(result).toBeDefined();
      
      // Verify emitDriftRecord is called for the essential field drift
      expect(emitDriftRecord).toHaveBeenCalledWith(
        'SupportProcedureRecord_Daily',
        essentialKey,
        'fuzzy_match',
        'suffix_mismatch',
        undefined,
        'warn'
      );
    });

    it('should NOT call emitDriftRecord when a non-essential field drifts', async () => {
      // Find a non-essential field candidate
      const essentials = new Set(PROCEDURE_RECORD_ESSENTIALS as unknown as string[]);
      const candidates = PROCEDURE_RECORD_CANDIDATES as unknown as Record<string, string[]>;
      const nonEssentialKey = Object.keys(candidates).find(key => !essentials.has(key));
      
      if (!nonEssentialKey) {
        throw new Error('Test setup error: No non-essential field found in PROCEDURE_RECORD_CANDIDATES');
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
        [driftName]: 'some-val',
      });

      const result = await repository.getById('sp-123');

      expect(result).toBeDefined();

      // Verify emitDriftRecord is NOT called for non-essential field drift
      expect(emitDriftRecord).not.toHaveBeenCalled();
    });

    it('should fall back to default behavior when getFieldInternalNames fails with generic error', async () => {
      mockProvider.getFieldInternalNames.mockRejectedValue(new Error('SharePoint request failed'));
      
      // We expect resolveSource to throw the error to enrichUser or repository layer, 
      // but in DataProviderProcedureRecordRepository, resolveSource failure throws and getById catches it, returning null
      const result = await repository.getById('sp-123');
      
      expect(result).toBeNull();
    });

    it('should propagate AuthRequiredError when resolveSource throws it', async () => {
      const authError = new AuthRequiredError('Auth failed');
      mockProvider.getFieldInternalNames.mockRejectedValue(authError);

      // DataProviderProcedureRecordRepository has error handling inside resolveSource that throws it, 
      // but getById has a try-catch blocks that logs generic errors and returns null.
      // Wait, let's verify if resolveSource's error is caught inside getById.
      // Yes, in getById:
      // try {
      //   const { title, fields, candidates } = await this.resolveSource();
      //   ...
      // } catch (error) {
      //   console.error(..., error);
      //   return null;
      // }
      // So let's test resolveSource directly or test another method like listByPlanningSheet which does NOT catch the error.
      // Let's look at listByPlanningSheet:
      // async listByPlanningSheet(...) {
      //   const { title, fields, candidates } = await this.resolveSource();
      //   ...
      // }
      // This method does NOT catch the error, so it will propagate it. Let's use listByPlanningSheet for this test.
      
      await expect(
        repository.listByPlanningSheet('sheet-123')
      ).rejects.toThrow(authError);
    });
  });
});
