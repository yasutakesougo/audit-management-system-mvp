// contract:allow-sp-direct
import { createRepositoryFactory, type BaseFactoryOptions } from '@/lib/createRepositoryFactory';
import type { AttendanceRepository } from './domain/AttendanceRepository';
import { inMemoryAttendanceRepository } from './infra/InMemoryAttendanceRepository';
import { DataProviderAttendanceRepository } from './infra/DataProviderAttendanceRepository';
import { createDataProvider } from '@/lib/data/createDataProvider';
import { createSpClient, ensureConfig } from '@/lib/spClient';

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
  createReal: (options) => {
    const { acquireToken } = options;
    if (!acquireToken) {
      throw new Error('[AttendanceRepositoryFactory] acquireToken is required for real repository.');
    }
    const { baseUrl } = ensureConfig();
    const { provider } = createDataProvider(createSpClient(acquireToken, baseUrl));

    return new DataProviderAttendanceRepository({
      provider,
      listTitleUsers: options.listTitleUsers || 'Users_Master',
      listTitleDaily: options.listTitleDaily || 'SupportRecord_Daily',
    });
  },
});

export const getAttendanceRepository = factory.getRepository;
export const useAttendanceRepository = factory.useRepository;
export const overrideAttendanceRepository = factory.override;
export const resetAttendanceRepository = factory.reset;
export const getCurrentAttendanceRepositoryKind = factory.getCurrentKind;

export type AttendanceRepositoryKind = 'demo' | 'real';
