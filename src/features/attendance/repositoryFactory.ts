import { createRepositoryFactory, type BaseFactoryOptions } from '@/lib/createRepositoryFactory';
import type { AttendanceRepository } from './domain/AttendanceRepository';
import { inMemoryAttendanceRepository } from './infra/InMemoryAttendanceRepository';
// import { SharePointAttendanceRepository, type SharePointAttendanceRepositoryOptions } from './infra/SharePointAttendanceRepository';

/**
 * Attendance Repository Factory options.
 */
export interface AttendanceRepositoryFactoryOptions extends BaseFactoryOptions {
  listTitleUsers?: string;
  listTitleDaily?: string;
}

const factory = createRepositoryFactory<AttendanceRepository, AttendanceRepositoryFactoryOptions>({
  name: 'Attendance',
  createDemo: () => inMemoryAttendanceRepository,
  createReal: (_options) => {
    // TODO: Restore SharePointAttendanceRepository when the infra layer is stable.
    console.warn('[AttendanceRepositoryFactory] Real repository missing, using Demo.');
    return inMemoryAttendanceRepository;
  },
});

export const getAttendanceRepository = factory.getRepository;
export const useAttendanceRepository = factory.useRepository;
export const overrideAttendanceRepository = factory.override;
export const resetAttendanceRepository = factory.reset;
export const getCurrentAttendanceRepositoryKind = factory.getCurrentKind;

export type AttendanceRepositoryKind = 'demo' | 'real';
