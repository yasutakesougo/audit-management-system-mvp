export const shouldRunSharePointProvisioningBootstrap = (options: {
  providerType: string;
  skipSharePoint: boolean;
  skipProvisioning: boolean;
}): boolean =>
  options.providerType === 'sharepoint' && !options.skipSharePoint && !options.skipProvisioning;
