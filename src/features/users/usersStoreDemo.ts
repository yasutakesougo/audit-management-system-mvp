import type { SafeError } from '@/lib/errors';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { normalizeAttendanceDays } from './attendance';
import type { IUserMaster, IUserMasterCreateDto } from './types';
import type { AsyncStatus } from './useUsers';

export const demoUsers: IUserMaster[] = [
  // 強度行動障害対象者（3名）- 支援手順記録対象
  {
    Id: 1,
    UserID: 'U-001',
    FullName: '田中 太郎',
    ServiceStartDate: '2034-04-01',
    ContractDate: '2034-03-15',
    IsHighIntensitySupportTarget: true,
    IsSupportProcedureTarget: true,
    ServiceEndDate: null,
    AttendanceDays: ['月', '火', '水', '木', '金'],
  },
  {
    Id: 2,
    UserID: 'U-005',
    FullName: '佐藤 花子',
    ServiceStartDate: '2034-06-01',
    ContractDate: '2034-05-20',
    IsHighIntensitySupportTarget: true,
    IsSupportProcedureTarget: true,
    ServiceEndDate: null,
    AttendanceDays: ['月', '水', '金'],
  },
  {
    Id: 3,
    UserID: 'U-012',
    FullName: '山田 一郎',
    ServiceStartDate: '2034-08-01',
    ContractDate: '2034-07-15',
    IsHighIntensitySupportTarget: true,
    IsSupportProcedureTarget: true,
    ServiceEndDate: null,
    AttendanceDays: ['火', '木', '金'],
  },
  // 通常利用者（29名）- 支援記録（ケース記録）のみ
  {
    Id: 4,
    UserID: 'U-002',
    FullName: '鈴木 美子',
    ServiceStartDate: '2034-04-15',
    ContractDate: '2034-03-30',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['月', '水', '金'],
  },
  {
    Id: 5,
    UserID: 'U-003',
    FullName: '高橋 次郎',
    ServiceStartDate: '2034-05-01',
    ContractDate: '2034-04-10',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['火', '木'],
  },
  {
    Id: 6,
    UserID: 'U-004',
    FullName: '渡辺 恵子',
    ServiceStartDate: '2034-05-15',
    ContractDate: '2034-04-25',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['月', '火', '水'],
  },
  {
    Id: 7,
    UserID: 'U-006',
    FullName: '中村 勇気',
    ServiceStartDate: '2034-06-15',
    ContractDate: '2034-06-01',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['月', '水', '金'],
  },
  {
    Id: 8,
    UserID: 'U-007',
    FullName: '小林 さくら',
    ServiceStartDate: '2034-07-01',
    ContractDate: '2034-06-15',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['火', '木', '金'],
  },
  {
    Id: 9,
    UserID: 'U-008',
    FullName: '加藤 健太',
    ServiceStartDate: '2034-07-15',
    ContractDate: '2034-07-01',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['月', '水'],
  },
  {
    Id: 10,
    UserID: 'U-009',
    FullName: '伊藤 みなみ',
    ServiceStartDate: '2034-08-01',
    ContractDate: '2034-07-20',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['月', '火', '木', '金'],
  },
  {
    Id: 11,
    UserID: 'U-010',
    FullName: '松本 大地',
    ServiceStartDate: '2034-08-15',
    ContractDate: '2034-08-01',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['火', '水', '金'],
  },
  {
    Id: 12,
    UserID: 'U-011',
    FullName: '森田 あい',
    ServiceStartDate: '2034-09-01',
    ContractDate: '2034-08-20',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['月', '木', '金'],
  },
  {
    Id: 13,
    UserID: 'U-013',
    FullName: '清水 翔太',
    ServiceStartDate: '2034-09-15',
    ContractDate: '2034-09-01',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['月', '水', '金'],
  },
  {
    Id: 14,
    UserID: 'U-014',
    FullName: '橋本 麻衣',
    ServiceStartDate: '2034-10-01',
    ContractDate: '2034-09-15',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['火', '木'],
  },
  {
    Id: 15,
    UserID: 'U-015',
    FullName: '木村 拓海',
    ServiceStartDate: '2034-10-15',
    ContractDate: '2034-10-01',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['月', '火', '水'],
  },
  {
    Id: 16,
    UserID: 'U-016',
    FullName: '野口 ひかり',
    ServiceStartDate: '2034-11-01',
    ContractDate: '2034-10-20',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['水', '木', '金'],
  },
  {
    Id: 17,
    UserID: 'U-017',
    FullName: '菊地 雄介',
    ServiceStartDate: '2034-11-15',
    ContractDate: '2034-11-01',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['月', '火', '木'],
  },
  {
    Id: 18,
    UserID: 'U-018',
    FullName: '長谷川 美咲',
    ServiceStartDate: '2034-12-01',
    ContractDate: '2034-11-20',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['火', '水', '金'],
  },
  {
    Id: 19,
    UserID: 'U-019',
    FullName: '近藤 駿',
    ServiceStartDate: '2034-12-15',
    ContractDate: '2034-12-01',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['月', '木', '金'],
  },
  {
    Id: 20,
    UserID: 'U-020',
    FullName: '今井 ゆり',
    ServiceStartDate: '2035-01-01',
    ContractDate: '2034-12-20',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['月', '水', '金'],
  },
  {
    Id: 21,
    UserID: 'U-021',
    FullName: '西田 直樹',
    ServiceStartDate: '2035-01-15',
    ContractDate: '2035-01-01',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['火', '木'],
  },
  {
    Id: 22,
    UserID: 'U-022',
    FullName: '原田 智子',
    ServiceStartDate: '2035-02-01',
    ContractDate: '2035-01-20',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['月', '水', '木'],
  },
  {
    Id: 23,
    UserID: 'U-023',
    FullName: '藤田 康平',
    ServiceStartDate: '2035-02-15',
    ContractDate: '2035-02-01',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['火', '水', '金'],
  },
  {
    Id: 24,
    UserID: 'U-024',
    FullName: '岡田 志保',
    ServiceStartDate: '2035-03-01',
    ContractDate: '2035-02-20',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['月', '火', '金'],
  },
  {
    Id: 25,
    UserID: 'U-025',
    FullName: '石井 慎一',
    ServiceStartDate: '2035-03-15',
    ContractDate: '2035-03-01',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['水', '木', '金'],
  },
  {
    Id: 26,
    UserID: 'U-026',
    FullName: '前田 るみ',
    ServiceStartDate: '2035-04-01',
    ContractDate: '2035-03-20',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['月', '火', '木'],
  },
  {
    Id: 27,
    UserID: 'U-027',
    FullName: '吉田 浩二',
    ServiceStartDate: '2035-04-15',
    ContractDate: '2035-04-01',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['火', '水', '金'],
  },
  {
    Id: 28,
    UserID: 'U-028',
    FullName: '村上 彩香',
    ServiceStartDate: '2035-05-01',
    ContractDate: '2035-04-20',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['月', '木', '金'],
  },
  {
    Id: 29,
    UserID: 'U-029',
    FullName: '内田 正人',
    ServiceStartDate: '2035-05-15',
    ContractDate: '2035-05-01',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['月', '水', '金'],
  },
  {
    Id: 30,
    UserID: 'U-030',
    FullName: '坂本 恵美',
    ServiceStartDate: '2035-06-01',
    ContractDate: '2035-05-20',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['火', '木'],
  },
  {
    Id: 31,
    UserID: 'U-031',
    FullName: '安田 光明',
    ServiceStartDate: '2035-06-15',
    ContractDate: '2035-06-01',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['月', '水', '木'],
  },
  {
    Id: 32,
    UserID: 'U-032',
    FullName: '池田 まり',
    ServiceStartDate: '2035-07-01',
    ContractDate: '2035-06-20',
    IsHighIntensitySupportTarget: false,
    IsSupportProcedureTarget: false,
    ServiceEndDate: null,
    AttendanceDays: ['火', '水', '金'],
  }
];

type UsersHookReturn = {
  data: IUserMaster[];
  status: AsyncStatus;
  error: SafeError | null;
  refresh: () => Promise<void>;
  create: (payload: IUserMasterCreateDto) => Promise<IUserMaster>;
  update: (id: number | string, payload: Partial<IUserMasterCreateDto>) => Promise<IUserMaster>;
  remove: (id: number | string) => Promise<void>;
};

const cloneUser = (user: IUserMaster): IUserMaster => ({
  ...user,
  AttendanceDays: normalizeAttendanceDays(user.AttendanceDays),
});

const initializeUsers = (initial: IUserMaster[]): void => {
  users = initial.map(cloneUser);
  nextId = users.length ? Math.max(...users.map((u) => Number(u.Id) || 0)) + 1 : 1;
};

let users: IUserMaster[] = [];
let nextId = 1;

initializeUsers(demoUsers);

const listeners = new Set<() => void>();

const snapshot = () => users;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const emit = () => {
  for (const listener of listeners) {
    listener();
  }
};

const coerceId = (id: number | string): number => {
  const numeric = Number(id);
  if (!Number.isFinite(numeric)) {
    throw new Error(`Invalid user id: ${String(id)}`);
  }
  return numeric;
};

const fromDto = (dto: IUserMasterCreateDto): IUserMaster => ({
  Id: nextId++,
  UserID: dto.UserID,
  FullName: dto.FullName,
  ContractDate: dto.ContractDate ?? undefined,
  IsHighIntensitySupportTarget: dto.IsHighIntensitySupportTarget ?? false,
  ServiceStartDate: dto.ServiceStartDate ?? undefined,
  ServiceEndDate: dto.ServiceEndDate ?? null,
  AttendanceDays: normalizeAttendanceDays(dto.AttendanceDays),
});

export function seedDemoUsers(initial: IUserMaster[] = demoUsers): void {
  initializeUsers(initial);
  emit();
}

export function resetDemoUsers(): void {
  initializeUsers(demoUsers);
  emit();
}

export function useUsersDemo(): UsersHookReturn {
  const data = useSyncExternalStore(subscribe, snapshot, snapshot);

  const refresh = useCallback(async () => {
    emit();
  }, []);

  const create = useCallback(async (payload: IUserMasterCreateDto) => {
    const record = fromDto(payload);
    users = [record, ...users];
    emit();
    return record;
  }, []);

  const update = useCallback(async (id: number | string, payload: Partial<IUserMasterCreateDto>) => {
    const numericId = coerceId(id);
    let updated: IUserMaster | null = null;
    users = users.map((row) => {
      if (row.Id === numericId) {
        updated = {
          ...row,
          ...payload,
        } as IUserMaster;
        if (payload.AttendanceDays !== undefined) {
          updated.AttendanceDays = normalizeAttendanceDays(payload.AttendanceDays);
        }
        return updated;
      }
      return row;
    });

    if (!updated) {
      throw new Error(`User with id ${numericId} not found`);
    }
    const ensured = updated as IUserMaster;
    ensured.AttendanceDays = normalizeAttendanceDays(ensured.AttendanceDays);

    emit();
    return ensured;
  }, []);

  const remove = useCallback(async (id: number | string) => {
    const numericId = coerceId(id);
    users = users.filter((row) => row.Id !== numericId);
    emit();
  }, []);

  return useMemo(
    () => ({
      data,
      status: 'success' as AsyncStatus,
      error: null,
      refresh,
      create,
      update,
      remove,
    }),
    [create, data, refresh, remove, update],
  );
}
