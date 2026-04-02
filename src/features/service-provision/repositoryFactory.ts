/**
 * ServiceProvision Repository Factory
 * 
 * demo / sharepoint 切り替え。
 * createRepositoryFactory を使用した共通パターン。
 */
import { createRepositoryFactory, type BaseFactoryOptions } from '@/lib/createRepositoryFactory';
import { createDataProvider } from '@/lib/data/createDataProvider';
import { createSpClient, ensureConfig } from '@/lib/spClient';

import type { ServiceProvisionRepository } from './domain/ServiceProvisionRepository';
import { inMemoryServiceProvisionRepository } from './infra/InMemoryServiceProvisionRepository';
import { DataProviderServiceProvisionRepository } from './infra/DataProviderServiceProvisionRepository';

/**
 * ServiceProvision Repository Factory options.
 */
export interface ServiceProvisionRepositoryFactoryOptions extends BaseFactoryOptions {
  /** Optional custom list title. */
  listTitle?: string;
}

const factory = createRepositoryFactory<ServiceProvisionRepository, ServiceProvisionRepositoryFactoryOptions>({
  name: 'ServiceProvision',
  createDemo: () => inMemoryServiceProvisionRepository,
  createReal: (options) => {
    const { acquireToken } = options;
    if (!acquireToken) {
      throw new Error('[ServiceProvisionRepositoryFactory] acquireToken is required for real repository.');
    }
    
    const { baseUrl } = ensureConfig();
    const { provider } = createDataProvider(createSpClient(acquireToken, baseUrl), { type: 'sharepoint' });

    return new DataProviderServiceProvisionRepository({
      provider,
      listTitle: options.listTitle || 'ServiceProvisionRecords',
    });
  },
});

export const getServiceProvisionRepository = factory.getRepository;
export const useServiceProvisionRepository = factory.useRepository;
export const overrideServiceProvisionRepository = factory.override;
export const resetServiceProvisionRepository = factory.reset;
export const getCurrentServiceProvisionRepositoryKind = factory.getCurrentKind;

export type ServiceProvisionRepositoryKind = 'demo' | 'real';
