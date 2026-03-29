import { useMemo } from 'react';
import { useDataProvider } from '@/lib/data/useDataProvider';
import type { AttendanceRepository } from './domain/AttendanceRepository';
import { DataProviderAttendanceRepository } from './infra/DataProviderAttendanceRepository';

/**
 * AttendanceRepositoryFactory
 * 
 * 従来の getAttendanceRepository (static) から useAttendanceRepository (hook) へ移行。
 * IDataProvider を利用することで、SharePoint / InMemory の切り替えを
 * レポジトリ層が意識せずに実行できる。
 */
export const useAttendanceRepository = (): AttendanceRepository => {
  const { provider } = useDataProvider();
  
  return useMemo(() => {
    return new DataProviderAttendanceRepository({ provider });
  }, [provider]);
};

// --- Test Overrides ---
let overrideRepository: AttendanceRepository | null = null;

export const overrideAttendanceRepository = (repo: AttendanceRepository | null) => {
  overrideRepository = repo;
};

export const getAttendanceRepository = (): AttendanceRepository => {
  if (overrideRepository) return overrideRepository;
  throw new Error('Static getAttendanceRepository is deprecated. Use useAttendanceRepository hook instead.');
};
