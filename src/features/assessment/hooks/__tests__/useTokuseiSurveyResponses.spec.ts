import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTokuseiSurveyResponses } from '../useTokuseiSurveyResponses';

const mockEnv = {
  isDemoModeEnabled: false,
  shouldSkipSharePoint: false,
};

const mockDataProvider = {
  getActiveProviderType: 'sharepoint',
};

// モック設定
vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    isDemoModeEnabled: () => mockEnv.isDemoModeEnabled,
    shouldSkipSharePoint: () => mockEnv.shouldSkipSharePoint,
  };
});

vi.mock('@/lib/data/createDataProvider', async () => {
  const actual = await vi.importActual<typeof import('@/lib/data/createDataProvider')>('@/lib/data/createDataProvider');
  return {
    ...actual,
    getActiveProviderType: () => mockDataProvider.getActiveProviderType,
  };
});

const mockListItems = vi.fn();
vi.mock('@/lib/spClient', async () => {
  return {
    useSP: () => ({
      listItems: mockListItems,
    }),
  };
});

describe('useTokuseiSurveyResponses Hook', () => {
  beforeEach(() => {
    mockEnv.isDemoModeEnabled = false;
    mockEnv.shouldSkipSharePoint = false;
    mockDataProvider.getActiveProviderType = 'sharepoint';
    mockListItems.mockClear();
  });

  it('returns mock responses and does not query SharePoint when shouldSkipSharePoint is true', async () => {
    mockEnv.shouldSkipSharePoint = true;

    const { result } = renderHook(() => useTokuseiSurveyResponses());

    await vi.waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    expect(result.current.responses.length).toBeGreaterThan(0);
    expect(mockListItems).not.toHaveBeenCalled();
  });

  it('returns mock responses and does not query SharePoint when getActiveProviderType is memory', async () => {
    mockDataProvider.getActiveProviderType = 'memory';

    const { result } = renderHook(() => useTokuseiSurveyResponses());

    await vi.waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    expect(result.current.responses.length).toBeGreaterThan(0);
    expect(mockListItems).not.toHaveBeenCalled();
  });

  it('queries SharePoint list when in real/SharePoint mode', async () => {
    mockListItems.mockResolvedValue([]);

    const { result } = renderHook(() => useTokuseiSurveyResponses());

    await vi.waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    expect(mockListItems).toHaveBeenCalled();
  });
});
