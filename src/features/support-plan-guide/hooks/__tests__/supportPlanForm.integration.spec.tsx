import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { useSupportPlanForm } from '../useSupportPlanForm';

// Mock repositories and sub-hooks as needed or mock the hooks themselves
vi.mock('../../repositoryFactory', () => ({
  useSupportPlanDraftRepository: () => ({
    getDrafts: vi.fn().mockResolvedValue({}),
    saveDraft: vi.fn().mockResolvedValue(undefined),
    deleteDraft: vi.fn(),
  }),
}));

vi.mock('../useIspRepositories', () => ({
  useIspRepositories: () => ({
    // Mock repos
  }),
}));

// Mock useDraftBootstrap to simulate initial legacy data
vi.mock('../useDraftBootstrap', () => ({
  useDraftBootstrap: ({ setDrafts, setActiveDraftId }: any) => {
    React.useEffect(() => {
      // Inject legacy data (missing new keys like userRole)
      const legacyDraft = {
        id: 'legacy-1',
        name: 'Legacy User',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        data: {
          serviceUserName: 'Legacy User',
          supportLevel: 'Level 2',
          // ibdEnvAdjustment is missing here!
        },
      };
      setDrafts({ 'legacy-1': legacyDraft as any });
      setActiveDraftId('legacy-1');
    }, []);
    return { isFetching: false, error: null };
  },
}));

// We need to wrap in any necessary providers if the hooks use them.
// Currently useSupportPlanForm seems to use standard React hooks and our mocks.

describe('useSupportPlanForm Integration (Normalization Guard)', () => {
  it('should normalize old drafts in memory and persist them with full schema on any edit', async () => {
    const { result } = renderHook(() => useSupportPlanForm({
      isAdmin: true,
      locationSearch: '',
      userList: [],
    }));

    // Wait for bootstrap
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });

    // 1. Initial check: Memory state should be normalized (derived state)
    expect(result.current.form.serviceUserName).toBe('Legacy User');
    expect(result.current.form.ibdEnvAdjustment).toBe(''); // Lifted to empty string
    expect(result.current.activeDraftId).toBe('legacy-1');

    // 2. Perform an edit on an existing field
    act(() => {
      result.current.handleFieldChange('supportLevel', 'Level 3');
    });

    // 3. Verify that the SAVED data (in drafts state) is now normalized
    const updatedDraft = result.current.drafts['legacy-1'];
    expect(updatedDraft.data.supportLevel).toBe('Level 3');
    expect(updatedDraft.data.ibdEnvAdjustment).toBe(''); // Key now exists in data object
    expect(updatedDraft.data).toHaveProperty('userRole'); // Key now exists in data object
    expect(updatedDraft.data).toHaveProperty('attendingDays');
  });

  it('should normalize data when adding a goal to a legacy draft', async () => {
    const { result } = renderHook(() => useSupportPlanForm({
      isAdmin: true,
      locationSearch: '',
      userList: [],
    }));

    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });

    // Add a goal
    act(() => {
      result.current.handleAddGoal('long', 'New Long Term Goal');
    });

    const updatedDraft = result.current.drafts['legacy-1'];
    expect(updatedDraft.data.goals.length).toBe(1);
    expect(updatedDraft.data).toHaveProperty('ibdEnvAdjustment'); // Normalized on goal update
  });
});
