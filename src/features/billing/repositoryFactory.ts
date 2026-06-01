import { createRepositoryFactory, type BaseFactoryOptions } from '@/lib/createRepositoryFactory';
import type { BillingOrderRepository } from './repository';
import { DataProviderBillingOrderRepository } from './infra/DataProviderBillingOrderRepository';
import { inMemoryBillingOrderRepository } from './infra/InMemoryBillingOrderRepository';
import { createSpClient, ensureConfig } from '@/lib/spClient';
import { SharePointDataProvider } from '@/lib/sp/spDataProvider';
import { getAppConfig, readOptionalEnv } from '@/lib/env';

export interface BillingOrderRepositoryFactoryOptions extends BaseFactoryOptions {
  spFetch?: (path: string, init?: RequestInit) => Promise<Response>;
}

export function resolveBillingSharePointBaseUrl(): string {
  const billingSiteRelative = readOptionalEnv('VITE_SP_LIST_BILLING_ORDERS_SITE_RELATIVE');
  const { VITE_SP_RESOURCE } = getAppConfig();
  const { baseUrl } = billingSiteRelative
    ? ensureConfig({
        VITE_SP_RESOURCE,
        VITE_SP_SITE_RELATIVE: billingSiteRelative,
      })
    : ensureConfig();
  return baseUrl;
}

const factory = createRepositoryFactory<BillingOrderRepository, BillingOrderRepositoryFactoryOptions>({
  name: 'BillingOrder',
  createDemo: () => inMemoryBillingOrderRepository,
  createReal: (options) => {
    const { acquireToken } = options;
    if (!acquireToken) {
      throw new Error('[BillingOrderRepositoryFactory] acquireToken is required for real repository.');
    }
    const baseUrl = resolveBillingSharePointBaseUrl();
    const provider = new SharePointDataProvider(createSpClient(acquireToken, baseUrl));
    
    return new DataProviderBillingOrderRepository(provider);
  },
});

export const getBillingOrderRepository = factory.getRepository;
export const useBillingOrderRepository = factory.useRepository;
export const overrideBillingOrderRepository = factory.override;
export const resetBillingOrderRepository = factory.reset;
export const getCurrentBillingOrderRepositoryKind = factory.getCurrentKind;
