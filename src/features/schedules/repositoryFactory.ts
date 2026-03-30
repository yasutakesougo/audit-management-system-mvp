import { createRepositoryFactory, type BaseFactoryOptions, defaultShouldUseDemo } from '@/lib/createRepositoryFactory';
import { isE2E } from '@/env';
import type { ScheduleRepository } from './domain/ScheduleRepository';
import { inMemoryScheduleRepository } from './infra/InMemoryScheduleRepository';
// import { SharePointScheduleRepository, type SharePointScheduleRepositoryOptions } from './infra/SharePointScheduleRepository';
// import { createSpClient, ensureConfig } from '@/lib/spClient';

/**
 * Schedule Repository Factory options.
 */
export interface ScheduleRepositoryFactoryOptions extends BaseFactoryOptions {
  listTitle?: string;
  currentOwnerUserId?: string;
}

const factory = createRepositoryFactory<ScheduleRepository, ScheduleRepositoryFactoryOptions>({
  name: 'Schedule',
  createDemo: () => inMemoryScheduleRepository,
  createReal: (_options) => {
    // TODO: Restore SharePointScheduleRepository when the infra layer is stable.
    console.warn('[ScheduleRepositoryFactory] Real repository missing, using Demo.');
    return inMemoryScheduleRepository;
  },
  shouldUseDemo: () => {
    // E2E environment would use real, but currently falling back until infra restored.
    if (isE2E) return true; // Temporary
    return defaultShouldUseDemo();
  },
});

export const getScheduleRepository = factory.getRepository;
export const useScheduleRepository = factory.useRepository;
export const overrideScheduleRepository = factory.override;
export const resetScheduleRepository = factory.reset;
export const getCurrentScheduleRepositoryKind = factory.getCurrentKind;

export type ScheduleRepositoryKind = 'demo' | 'real';
