import { describe, it, expect, vi } from 'vitest';
import { DataProviderSupportPlanDraftRepository } from '../DataProviderSupportPlanDraftRepository';

describe('DataProviderSupportPlanDraftRepository Normalization', () => {
  const mockProvider = {
    listItems: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    getFieldInternalNames: vi.fn().mockResolvedValue(new Set([
      'DraftId',
      'UserCode',
      'DraftName',
      'FormDataJson',
      'Status',
      'SchemaVersion',
    ])),
  };

  it('should lift partial SharePoint JSON to full normalized schema on load', async () => {
    const repo = new DataProviderSupportPlanDraftRepository({ provider: mockProvider as any });

    // Mock SharePoint row with partial JSON
    mockProvider.listItems.mockResolvedValueOnce([
      {
        Id: 1,
        DraftId: 'd-1',
        UserCode: 'U001',
        DraftName: 'Target User',
        FormDataJson: JSON.stringify({
          serviceUserName: 'Target User',
          supportLevel: 'Level 4'
        }),
        Created: '2026-01-01T00:00:00Z',
        Modified: '2026-01-01T00:00:00Z',
      }
    ]);

    const drafts = await repo.listDrafts();
    expect(drafts.length).toBe(1);
    const draft = drafts[0];

    expect(draft.id).toBe('d-1');
    expect(draft.data.serviceUserName).toBe('Target User');
    // Schema Lift check
    expect(draft.data).toHaveProperty('ibdEnvAdjustment');
    expect(draft.data.ibdEnvAdjustment).toBe('');
    expect(draft.data.userRole).toBe('');
    expect(draft.data.attendingDays).toBe('');
    expect(Array.isArray(draft.data.goals)).toBe(true);
  });

  it('should handle malformed JSON by returning null in mapRowToDraft (skipping that row)', async () => {
    const repo = new DataProviderSupportPlanDraftRepository({ provider: mockProvider as any });

    mockProvider.listItems.mockResolvedValueOnce([
      {
        Id: 2,
        DraftId: 'd-2',
        FormDataJson: 'NOT_JSON',
      }
    ]);

    const drafts = await repo.listDrafts();
    expect(drafts.length).toBe(0); // Row should be filtered out because of parsing error
  });
});
