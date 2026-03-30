import { createRepositoryFactory, type BaseFactoryOptions } from '@/lib/createRepositoryFactory';
import type { AttendanceRepository } from './domain/AttendanceRepository';
import { inMemoryAttendanceRepository } from './infra/InMemoryAttendanceRepository';
import { SharePointAttendanceRepository, type SharePointAttendanceRepositoryOptions } from './infra/SharePointAttendanceRepository';

/**
 * Attendance Repository Factory options.
 */
export interface AttendanceRepositoryFactoryOptions extends BaseFactoryOptions, SharePointAttendanceRepositoryOptions {}

const factory = createRepositoryFactory<AttendanceRepository, AttendanceRepositoryFactoryOptions>({
  name: 'Attendance',
  createDemo: () => inMemoryAttendanceRepository,
  createReal: (options) => {
    const acquireToken = options.acquireToken;
    if (!acquireToken) {
      throw new Error(
        '[AttendanceRepositoryFactory] acquireToken is required for SharePoint repository.',
      );
    }

    return new SharePointAttendanceRepository(acquireToken, {
      listTitleUsers: options.listTitleUsers,
      listTitleDaily: options.listTitleDaily,
    });
  },
});

export const getAttendanceRepository = factory.getRepository;
export const useAttendanceRepository = factory.useRepository;
export const overrideAttendanceRepository = factory.override;
export const resetAttendanceRepository = factory.reset;
export const getCurrentAttendanceRepositoryKind = factory.getCurrentKind;

export type AttendanceRepositoryKind = 'demo' | 'real';
