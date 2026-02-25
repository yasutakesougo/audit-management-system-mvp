import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractSupportPlanHints } from '../supportPlanAdapter';

describe('supportPlanAdapter', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('returns empty object when localStorage is empty', () => {
    expect(extractSupportPlanHints()).toEqual({});
  });

  it('correctly parses and normalizes IDs from Array shape', () => {
    const mockData = {
      drafts: [
        {
          userId: 123,
          data: { longTermGoal: ' Goal A ', dailySupports: ' Support A ' },
          updatedAt: '2026-02-25T10:00:00Z'
        },
        {
          userId: '456',
          data: { longTermGoal: 'Goal B' }
        }
      ]
    };
    localStorage.setItem('support-plan-guide.v2', JSON.stringify(mockData));

    const hints = extractSupportPlanHints();
    expect(hints['123']).toEqual({
      userId: '123',
      longTermGoal: 'Goal A',
      dailySupports: 'Support A',
      riskManagement: undefined,
      lastUpdated: '2026-02-25T10:00:00Z'
    });
    expect(hints['456'].userId).toBe('456');
    expect(hints['456'].longTermGoal).toBe('Goal B');
  });

  it('correctly parses from Object/Map shape', () => {
    const mockData = {
      drafts: {
        'id-1': { userId: 'I022', data: { dailySupports: 'Instruction' } }
      }
    };
    localStorage.setItem('support-plan-guide.v2', JSON.stringify(mockData));

    const hints = extractSupportPlanHints();
    expect(hints['I022'].dailySupports).toBe('Instruction');
  });

  it('filters out empty or noise-only data', () => {
    const mockData = {
      drafts: [
        { userId: '999', data: { longTermGoal: '   ', dailySupports: '' } }
      ]
    };
    localStorage.setItem('support-plan-guide.v2', JSON.stringify(mockData));

    expect(extractSupportPlanHints()).toEqual({});
  });

  it('is robust against invalid JSON', () => {
    localStorage.setItem('support-plan-guide.v2', 'invalid-json');
    expect(extractSupportPlanHints()).toEqual({});
  });
});
