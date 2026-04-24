import { createRepositoryFactory, defaultShouldUseDemo } from '@/lib/createRepositoryFactory';
import type { AssignmentRepository } from './domain/assignment';
import { inMemoryAssignmentRepository } from './infra/InMemoryAssignmentRepository';
import { SharePointAssignmentRepository } from './infra/SharePointAssignmentRepository';
import { getScheduleRepository, type ScheduleRepositoryFactoryOptions } from './repositoryFactory';

/**
 * Assignment Repository Factory
 * 
 * Manages the creation and override of AssignmentRepository instances.
 * Supports 'demo' (in-memory) and 'real' (SharePoint) modes.
 */
const factory = createRepositoryFactory<AssignmentRepository, ScheduleRepositoryFactoryOptions>({
  name: 'Assignment',
  createDemo: () => inMemoryAssignmentRepository,
  createReal: (options) => {
    // Get the real schedule repository to use as the backing store
    const scheduleRepo = getScheduleRepository(options);
    return new SharePointAssignmentRepository(scheduleRepo);
  },
  shouldUseDemo: () => {
    return defaultShouldUseDemo();
  },
});

export const getAssignmentRepository = factory.getRepository;
export const useAssignmentRepository = factory.useRepository;
export const overrideAssignmentRepository = factory.override;
export const resetAssignmentRepository = factory.reset;
