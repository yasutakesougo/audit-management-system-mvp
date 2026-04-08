import { vi, describe, it, expect, beforeEach } from 'vitest';
import { getActiveProviderType } from '../createDataProvider';
import { isDevMode, shouldSkipSharePoint, readBool, readOptionalEnv } from '@/lib/env';

// Mock the environment helpers
vi.mock('@/lib/env', () => ({
  isDevMode: vi.fn(),
  isDemoModeEnabled: vi.fn(),
  shouldSkipSharePoint: vi.fn(),
  readBool: vi.fn(),
  readOptionalEnv: vi.fn(),
}));

describe('getActiveProviderType Priority Logic (Regression Guard)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(readOptionalEnv).mockReturnValue(undefined);
  });

  it('CASE 1: should ALWAYS select "memory" if shouldSkipSharePoint is true (Highest Priority)', () => {
    // GIVEN: Both skip and force are set
    vi.mocked(shouldSkipSharePoint).mockReturnValue(true);
    // VITE_FORCE_SHAREPOINT が true でも skipSp が優先されることを確認
    vi.mocked(readBool).mockImplementation((key) => key === 'VITE_FORCE_SHAREPOINT');
    
    // WHEN
    const result = getActiveProviderType();
    
    // THEN: Memory should win over the force flag
    expect(result).toBe('memory');
  });

  it('CASE 2: should select "sharepoint" if VITE_FORCE_SHAREPOINT is true and skip is false', () => {
    // GIVEN: Skip is false, but force is true
    vi.mocked(shouldSkipSharePoint).mockReturnValue(false);
    vi.mocked(readBool).mockImplementation((key) => key === 'VITE_FORCE_SHAREPOINT');
    
    // WHEN
    const result = getActiveProviderType();

    // THEN: SharePoint is selected
    expect(result).toBe('sharepoint');
  });

  it('CASE 3: should fallback to "memory" in Dev mode if no force is set', () => {
    // GIVEN: Normal Dev environment
    vi.mocked(shouldSkipSharePoint).mockReturnValue(false);
    vi.mocked(readBool).mockReturnValue(false);
    vi.mocked(isDevMode).mockReturnValue(true);
    
    // WHEN
    const result = getActiveProviderType();

    // THEN: Dev mode defaults to memory
    expect(result).toBe('memory');
  });

  it('CASE 4: should prioritize explicit VITE_DATA_PROVIDER over Dev/Demo defaults', () => {
    // GIVEN: Dev mode is on, but env var explicitly sets sharepoint
    vi.mocked(shouldSkipSharePoint).mockReturnValue(false);
    vi.mocked(isDevMode).mockReturnValue(true);
    vi.mocked(readOptionalEnv).mockImplementation((key) => key === 'VITE_DATA_PROVIDER' ? 'sharepoint' : undefined);
    
    // WHEN
    const result = getActiveProviderType();

    // THEN: Explicit env var wins over the Dev default
    expect(result).toBe('sharepoint');
  });
});
