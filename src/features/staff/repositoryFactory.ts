import { createRepositoryFactory, type BaseFactoryOptions } from '@/lib/createRepositoryFactory';
import type { StaffRepository } from './domain/StaffRepository';
import { DataProviderStaffRepository } from './infra/DataProviderStaffRepository';
import { createDataProvider } from '@/lib/data/createDataProvider';
import { createSpClient, ensureConfig } from '@/lib/spClient';

import { inMemoryStaffRepository } from './infra/InMemoryStaffRepository';

export interface StaffRepositoryFactoryOptions extends BaseFactoryOptions {
  spFetch?: (path: string, init?: RequestInit) => Promise<Response>;
}

const factory = createRepositoryFactory<StaffRepository, StaffRepositoryFactoryOptions>({
  name: 'Staff',
  createDemo: () => inMemoryStaffRepository,
  createReal: (options) => {
    const { acquireToken } = options;
    if (!acquireToken) {
      throw new Error('[StaffRepositoryFactory] acquireToken is required for real repository.');
    }
    const { baseUrl } = ensureConfig();
    const { provider } = createDataProvider(createSpClient(acquireToken, baseUrl));
    
    return new DataProviderStaffRepository({
      provider,
    });
  },
});

export const getStaffRepository = factory.getRepository;
export const useStaffRepository = factory.useRepository;
export const overrideStaffRepository = factory.override;
export const resetStaffRepository = factory.reset;
export const getCurrentStaffRepositoryKind = factory.getCurrentKind;
