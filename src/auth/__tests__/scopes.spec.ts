import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the env module before importing scopes
vi.mock('../../lib/env', () => ({
  getConfiguredMsalScopes: vi.fn(() => []),
  getMsalLoginScopes: vi.fn(() => []),
  getSharePointDefaultScope: vi.fn(() => undefined),
}));

import {
    getConfiguredMsalScopes,
    getMsalLoginScopes,
    getSharePointDefaultScope,
} from '../../lib/env';
import { buildMsalScopes } from '../scopes';

const mockGetConfigured = vi.mocked(getConfiguredMsalScopes);
const mockGetLogin = vi.mocked(getMsalLoginScopes);
const mockGetSPDefault = vi.mocked(getSharePointDefaultScope);

describe('buildMsalScopes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfigured.mockReturnValue([]);
    mockGetLogin.mockReturnValue([]);
    mockGetSPDefault.mockReturnValue(undefined as unknown as string);
  });

  it('should return configured scopes when VITE_MSAL_SCOPES is set', () => {
    mockGetConfigured.mockReturnValue(['User.Read', 'AllSites.Write']);

    const result = buildMsalScopes();
    expect(result).toEqual(['User.Read', 'AllSites.Write']);
  });

  it('should fall back to login scopes + SP default when no configured scopes', () => {
    mockGetConfigured.mockReturnValue([]);
    mockGetLogin.mockReturnValue(['User.Read']);
    mockGetSPDefault.mockReturnValue('https://contoso.sharepoint.com/.default');

    const result = buildMsalScopes();
    expect(result).toEqual(['User.Read', 'https://contoso.sharepoint.com/.default']);
  });

  it('should deduplicate scopes', () => {
    mockGetConfigured.mockReturnValue(['User.Read', 'User.Read', 'AllSites.Write']);

    const result = buildMsalScopes();
    expect(result).toEqual(['User.Read', 'AllSites.Write']);
  });

  it('should filter out empty/whitespace scopes', () => {
    mockGetConfigured.mockReturnValue(['User.Read', '', '  ', 'AllSites.Write']);

    const result = buildMsalScopes();
    expect(result).toEqual(['User.Read', 'AllSites.Write']);
  });

  it('should return empty array when no scopes available', () => {
    const result = buildMsalScopes();
    expect(result).toEqual([]);
  });

  it('should return login scopes only when SP default is not set', () => {
    mockGetLogin.mockReturnValue(['User.Read', 'openid']);
    mockGetSPDefault.mockReturnValue(undefined as unknown as string);

    const result = buildMsalScopes();
    expect(result).toEqual(['User.Read', 'openid']);
  });
});
