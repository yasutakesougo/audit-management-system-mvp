// Service Provision Records — Public API
//
// ドメイン型
export type {
  ProvisionSource,
  ServiceProvisionRecord,
  ServiceProvisionStatus,
  UpsertProvisionInput,
} from './domain/types';
export { makeEntryKey } from './domain/types';

// スキーマ
export { upsertProvisionInputSchema } from './domain/schema';

// Repository インターフェース
export type { ServiceProvisionRepository } from './domain/ServiceProvisionRepository';

// Repository 実装 (InMemory)
export {
  InMemoryServiceProvisionRepository,
  inMemoryServiceProvisionRepository,
} from './infra/InMemoryServiceProvisionRepository';

// Repository Factory
export {
  getCurrentServiceProvisionRepositoryKind,
  getServiceProvisionRepository,
  overrideServiceProvisionRepository,
  resetServiceProvisionRepository,
  useServiceProvisionRepository,
} from './repositoryFactory';
export type { ServiceProvisionRepositoryKind } from './repositoryFactory';

// Hook
export { useServiceProvisionSave } from './useServiceProvisionSave';
export type { SaveStatus, UseServiceProvisionSaveReturn } from './useServiceProvisionSave';

export { useServiceProvisionList } from './useServiceProvisionList';
export type { UseServiceProvisionListReturn } from './useServiceProvisionList';
