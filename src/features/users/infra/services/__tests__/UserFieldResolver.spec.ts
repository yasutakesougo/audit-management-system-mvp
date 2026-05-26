import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserFieldResolver } from '../UserFieldResolver';
import { emitDriftRecord } from '@/features/diagnostics/drift/domain/driftLogic';
import { AuthRequiredError } from '@/lib/errors';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';

vi.mock('@/features/diagnostics/drift/domain/driftLogic', () => ({
  emitDriftRecord: vi.fn(),
}));

describe('UserFieldResolver', () => {
  let mockProvider: any;
  let resolver: UserFieldResolver;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProvider = {
      getFieldInternalNames: vi.fn(),
    };
    resolver = new UserFieldResolver(mockProvider as unknown as IDataProvider, 'Users_Master');
  });

  describe('resolveAccessoryFields', () => {
    it('should call emitDriftRecord when an essential field drifts', async () => {
      mockProvider.getFieldInternalNames.mockResolvedValue(new Set(['essentialField0', 'nonEssentialField0']));

      const candidates = {
        essentialField: ['essentialField'],
        nonEssentialField: ['nonEssentialField'],
      };

      const essentials = ['essentialField'];

      const result = await resolver.resolveAccessoryFields('accessory_list', candidates, essentials);

      // Verify the essential field is resolved correctly
      expect(result.resolvedFields.essentialField).toBe('essentialField0');
      expect(result.resolvedKeys.has('essentialField')).toBe(true);

      // Verify emitDriftRecord is called for the essential field
      expect(emitDriftRecord).toHaveBeenCalledWith(
        'accessory_list',
        'essentialField',
        'fuzzy_match',
        'suffix_mismatch',
        undefined,
        'warn'
      );
    });

    it('should NOT call emitDriftRecord when a non-essential field drifts', async () => {
      mockProvider.getFieldInternalNames.mockResolvedValue(new Set(['essentialField', 'nonEssentialField0']));

      const candidates = {
        essentialField: ['essentialField'],
        nonEssentialField: ['nonEssentialField', 'nonEssentialField0'],
      };

      const essentials = ['essentialField'];

      const result = await resolver.resolveAccessoryFields('accessory_list', candidates, essentials);

      // Verify non-essential field is resolved
      expect(result.resolvedFields.nonEssentialField).toBe('nonEssentialField0');
      
      // Verify emitDriftRecord is NOT called for the non-essential field
      expect(emitDriftRecord).not.toHaveBeenCalled();
    });

    it('should fall back to primary candidate when getFieldInternalNames fails', async () => {
      mockProvider.getFieldInternalNames.mockRejectedValue(new Error('Network error'));

      const candidates = {
        essentialField: ['essentialField', 'essentialField0'],
        nonEssentialField: ['nonEssentialField', 'nonEssentialField0'],
      };

      const essentials = ['essentialField'];

      const result = await resolver.resolveAccessoryFields('accessory_list', candidates, essentials);

      // Verify essential falls back to primary candidate
      expect(result.resolvedFields.essentialField).toBe('essentialField');
      // Verify non-essential falls back to undefined
      expect(result.resolvedFields.nonEssentialField).toBeUndefined();
      // Verify resolvedKeys is empty
      expect(result.resolvedKeys.size).toBe(0);
    });

    it('should propagate AuthRequiredError when getFieldInternalNames throws it', async () => {
      const authError = new AuthRequiredError('Auth failed');
      mockProvider.getFieldInternalNames.mockRejectedValue(authError);

      const candidates = {
        essentialField: ['essentialField'],
      };

      await expect(
        resolver.resolveAccessoryFields('accessory_list', candidates, ['essentialField'])
      ).rejects.toThrow(authError);
    });

    it('should singleflight concurrent resolveAccessoryFields calls for the same list', async () => {
      let resolvePromise: (value: any) => void = () => {};
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockProvider.getFieldInternalNames.mockReturnValue(promise);

      const candidates = {
        essentialField: ['essentialField'],
      };

      const call1 = resolver.resolveAccessoryFields('accessory_list', candidates, ['essentialField']);
      const call2 = resolver.resolveAccessoryFields('accessory_list', candidates, ['essentialField']);

      resolvePromise(new Set(['essentialField']));

      const [res1, res2] = await Promise.all([call1, call2]);

      expect(res1).toEqual(res2);
      expect(mockProvider.getFieldInternalNames).toHaveBeenCalledTimes(1);
    });
  });
});
