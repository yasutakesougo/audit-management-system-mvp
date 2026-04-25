import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUserOrchestrator } from '../useUserOrchestrator';
import type { UserRepository } from '../../../domain/UserRepository';
import type { UserEditPageState } from '../../view-models/useUserEditPageState';
import { recordAudit, OrchestratorFailureKind } from '@/lib/telemetry/auditLogger';

// Mock recordAudit to verify observability
vi.mock('@/lib/telemetry/auditLogger', () => ({
  recordAudit: vi.fn(),
  OrchestratorFailureKind: {
    CONFLICT: 'CONFLICT',
    VALIDATION: 'VALIDATION',
    UNKNOWN: 'UNKNOWN',
  }
}));

describe('useUserOrchestrator', () => {
  let mockRepository: UserRepository;
  let mockPageState: UserEditPageState;
  let mockShowSnack: any;
  let mockOnSuccess: any;

  beforeEach(() => {
    mockRepository = {
      update: vi.fn(),
      getAll: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      terminate: vi.fn(),
      remove: vi.fn(),
    };

    mockPageState = {
      formData: { FullName: 'New Name' },
      isSaving: false,
      isDirty: true,
      error: null,
      setFieldValue: vi.fn(),
      setSaving: vi.fn(),
      setError: vi.fn(),
      reset: vi.fn(),
    };

    mockShowSnack = vi.fn();
    mockOnSuccess = vi.fn();
  });

  const renderOrchestrator = () => {
    return renderHook(() => useUserOrchestrator({
      pageState: mockPageState,
      repository: mockRepository,
      showSnack: mockShowSnack,
      onSuccess: mockOnSuccess,
    }));
  };

  describe('handleUpdateProfile', () => {
    it('should coordinate a successful profile update', async () => {
      const updatedUser = { Id: 1, FullName: 'New Name' } as any;
      vi.mocked(mockRepository.update).mockResolvedValue(updatedUser);

      const { result } = renderOrchestrator();

      await act(async () => {
        await result.current.handleUpdateProfile(1);
      });

      // Verify coordinate actions
      expect(mockPageState.setSaving).toHaveBeenCalledWith(true);
      expect(mockRepository.update).toHaveBeenCalledWith(1, { FullName: 'New Name' });
      
      // Observability verification
      expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({
        action: 'UPDATE_USER_PROFILE',
        status: 'SUCCESS',
        targetId: 1
      }));

      expect(mockPageState.reset).toHaveBeenCalledWith(updatedUser);
      expect(mockShowSnack).toHaveBeenCalledWith('success', expect.stringContaining('更新しました'));
      expect(mockOnSuccess).toHaveBeenCalledWith(1);
      expect(mockPageState.setSaving).toHaveBeenCalledWith(false);
    });

    it('should handle update failures and provide feedback', async () => {
      const error = new Error('Network error');
      vi.mocked(mockRepository.update).mockRejectedValue(error);

      const { result } = renderOrchestrator();

      await act(async () => {
        await result.current.handleUpdateProfile(1);
      });

      expect(mockPageState.setError).toHaveBeenCalledWith('Network error');
      
      // Observability verification (Failure)
      expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({
        action: 'UPDATE_USER_PROFILE',
        status: 'FAILURE',
        error: expect.objectContaining({
          kind: OrchestratorFailureKind.UNKNOWN
        })
      }));

      expect(mockShowSnack).toHaveBeenCalledWith('error', expect.stringContaining('失敗しました'));
      expect(mockPageState.setSaving).toHaveBeenCalledWith(false);
    });
  });

  describe('handleApplyBenefitChange', () => {
    it('should specifically coordinate benefit changes', async () => {
      const benefitData = { GrantMunicipality: 'New City' };
      const updatedUser = { Id: 1, GrantMunicipality: 'New City' } as any;
      vi.mocked(mockRepository.update).mockResolvedValue(updatedUser);

      const { result } = renderOrchestrator();

      await act(async () => {
        await result.current.handleApplyBenefitChange(1, benefitData);
      });

      // Verify specific intent
      expect(mockRepository.update).toHaveBeenCalledWith(1, benefitData);
      expect(mockPageState.reset).toHaveBeenCalledWith(updatedUser);
      expect(mockShowSnack).toHaveBeenCalledWith('success', expect.stringContaining('受給者証情報を更新しました'));
    });
  });
});
