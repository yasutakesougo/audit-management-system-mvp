import { createRepositoryFactory, type BaseFactoryOptions, defaultShouldUseDemo } from '@/lib/createRepositoryFactory';
import type { AssignmentRepository } from './domain/assignment';
import { inMemoryAssignmentRepository } from './infra/InMemoryAssignmentRepository';

/**
 * Assignment Repository Factory
 * 
 * Manages the creation and override of AssignmentRepository instances.
 * Currently only supports 'demo' (in-memory) mode. 
 * Real (SharePoint) mode will be implemented as the domain matures.
 */
const factory = createRepositoryFactory<AssignmentRepository, BaseFactoryOptions>({
  name: 'Assignment',
  createDemo: () => inMemoryAssignmentRepository,
  createReal: () => {
    // Fallback to demo for now as real implementation is pending
    console.warn('[AssignmentRepositoryFactory] Real repository requested but not yet implemented. Falling back to Demo.');
    return inMemoryAssignmentRepository;
  },
  shouldUseDemo: () => {
    return defaultShouldUseDemo();
  },
});

export const getAssignmentRepository = factory.getRepository;
export const useAssignmentRepository = factory.useRepository;
export const overrideAssignmentRepository = factory.override;
export const resetAssignmentRepository = factory.reset;
