import { SharePointProvisioningCoordinator } from '@/sharepoint/spProvisioningCoordinator';
import { trackSpEvent } from '@/lib/telemetry/spTelemetry';
import { readBool } from '@/lib/env';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { useSP } from '@/lib/spClient';

vi.mock('@/lib/telemetry/spTelemetry', () => ({
  trackSpEvent: vi.fn(),
  trackGuidResolution: vi.fn(),
}));

vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/env')>();
  return {
    ...actual,
    getAppConfig: vi.fn(() => ({})),
    readBool: vi.fn(),
  };
});

// Mocking the registry to test specific lifecycles
vi.mock('@/sharepoint/spListRegistry', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/sharepoint/spListRegistry')>();
    return {
        ...actual,
        SP_LIST_REGISTRY: [
            { key: 'req', displayName: 'Required', resolve: () => 'RequiredList', lifecycle: 'required', operations: ['R'], category: 'master' },
            { key: 'opt', displayName: 'Optional', resolve: () => 'OptionalList', lifecycle: 'optional', operations: ['R'], category: 'master' },
            { key: 'dep', displayName: 'Deprecated', resolve: () => 'DeprecatedList', lifecycle: 'deprecated', operations: ['R'], category: 'master' },
            { key: 'exp', displayName: 'Experimental', resolve: () => 'ExperimentalList', lifecycle: 'experimental', operations: ['R'], category: 'master' },
        ]
    };
});

describe('SharePointProvisioningCoordinator - Lifecycle Support', () => {
  let mockClient: ReturnType<typeof useSP>;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();

    mockClient = {
      spFetch: vi.fn(),
      tryGetListMetadata: vi.fn().mockResolvedValue({ listId: '', title: 'SomeList' }),
      getListFieldInternalNames: vi.fn().mockResolvedValue(new Set()),
      getExistingListTitlesAndIds: vi.fn().mockResolvedValue(
        new Set(['RequiredList', 'OptionalList', 'DeprecatedList', 'ExperimentalList'])
      ),
    } as unknown as ReturnType<typeof useSP>;
  });

  it('Experimental: should SKIP when feature flag is OFF', async () => {
    vi.mocked(readBool).mockReturnValue(false); // Flag OFF for all

    const result = await SharePointProvisioningCoordinator.bootstrap(mockClient);
    const expResult = result.summaries.find(s => s.key === 'exp');

    expect(expResult?.status).toBe('skipped');
    expect(mockClient.tryGetListMetadata).not.toHaveBeenCalledWith('ExperimentalList', expect.any(Object));
  });

  it('Experimental: should PROCEED when feature flag is ON', async () => {
    vi.mocked(readBool).mockImplementation((key) => key === 'VITE_FEATURE_EXP'); // Flag ON for 'exp'
    vi.mocked(mockClient.tryGetListMetadata).mockResolvedValue({ listId: '', title: 'ExperimentalList' });

    const result = await SharePointProvisioningCoordinator.bootstrap(mockClient);
    const expResult = result.summaries.find(s => s.key === 'exp');

    expect(expResult?.status).toBe('ok');
    expect(mockClient.tryGetListMetadata).toHaveBeenCalledWith('ExperimentalList', expect.any(Object));
  });

  it('Deprecated: should WARN and skip detailed check', async () => {
    const result = await SharePointProvisioningCoordinator.bootstrap(mockClient);
    const depResult = result.summaries.find(s => s.key === 'dep');

    expect(depResult?.status).toBe('deprecated');
    // Deprecated lists return early in current impl
    expect(mockClient.tryGetListMetadata).not.toHaveBeenCalledWith('DeprecatedList', expect.any(Object));
  });

  it('Required: should trigger error telemetry on 404', async () => {
    vi.mocked(mockClient.tryGetListMetadata).mockImplementation((name: string) => {
        if (name === 'RequiredList') return Promise.resolve(null);
        return Promise.resolve({ listId: '', title: name });
    });

    await SharePointProvisioningCoordinator.bootstrap(mockClient);

    expect(trackSpEvent).toHaveBeenCalledWith('sp:list_missing_required', expect.objectContaining({
      key: 'req'
    }));
  });

  it('Optional: should trigger info telemetry on 404', async () => {
    vi.mocked(mockClient.tryGetListMetadata).mockImplementation((name: string) => {
        if (name === 'OptionalList') return Promise.resolve(null);
        return Promise.resolve({ listId: '', title: name });
    });

    await SharePointProvisioningCoordinator.bootstrap(mockClient);

    expect(trackSpEvent).toHaveBeenCalledWith('sp:list_missing_optional', expect.objectContaining({
      key: 'opt'
    }));
  });
});
