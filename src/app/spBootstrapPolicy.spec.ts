import { describe, expect, it } from 'vitest';
import { shouldRunSharePointProvisioningBootstrap } from './spBootstrapPolicy';

describe('shouldRunSharePointProvisioningBootstrap', () => {
  it('runs only for SharePoint when provisioning is enabled', () => {
    expect(shouldRunSharePointProvisioningBootstrap({
      providerType: 'sharepoint',
      skipSharePoint: false,
      skipProvisioning: false,
    })).toBe(true);
  });

  it('skips the bootstrap when the provisioning policy is enabled', () => {
    expect(shouldRunSharePointProvisioningBootstrap({
      providerType: 'sharepoint',
      skipSharePoint: false,
      skipProvisioning: true,
    })).toBe(false);
  });

  it('skips non-SharePoint and SharePoint-skip modes', () => {
    expect(shouldRunSharePointProvisioningBootstrap({
      providerType: 'localStorage',
      skipSharePoint: false,
      skipProvisioning: false,
    })).toBe(false);
    expect(shouldRunSharePointProvisioningBootstrap({
      providerType: 'sharepoint',
      skipSharePoint: true,
      skipProvisioning: false,
    })).toBe(false);
  });
});
