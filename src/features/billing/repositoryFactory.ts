import { createRepositoryFactory, type BaseFactoryOptions } from '@/lib/createRepositoryFactory';
import type { BillingOrderRepository } from './repository';
import { DataProviderBillingOrderRepository } from './infra/DataProviderBillingOrderRepository';
import { inMemoryBillingOrderRepository } from './infra/InMemoryBillingOrderRepository';
import { createDataProvider } from '@/lib/data/createDataProvider';
import { createSpClient, ensureConfig } from '@/lib/spClient';

export interface BillingOrderRepositoryFactoryOptions extends BaseFactoryOptions {
  spFetch?: (path: string, init?: RequestInit) => Promise<Response>;
}

const factory = createRepositoryFactory<BillingOrderRepository, BillingOrderRepositoryFactoryOptions>({
  name: 'BillingOrder',
  createDemo: () => inMemoryBillingOrderRepository,
  createReal: (options) => {
    const { acquireToken } = options;
    if (!acquireToken) {
      throw new Error('[BillingOrderRepositoryFactory] acquireToken is required for real repository.');
    }
    const { baseUrl } = ensureConfig();
    const { provider } = createDataProvider(createSpClient(acquireToken, baseUrl));
    
    return new DataProviderBillingOrderRepository(provider);
  },
});

export const getBillingOrderRepository = factory.getRepository;
export const useBillingOrderRepository = factory.useRepository;
export const overrideBillingOrderRepository = factory.override;
export const resetBillingOrderRepository = factory.reset;
export const getCurrentBillingOrderRepositoryKind = factory.getCurrentKind;
