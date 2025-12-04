import { normalizeAttendanceDays } from '../attendance';
import { DEMO_USERS } from '../constants';
import type {
  UserRepository,
  UserRepositoryGetParams,
  UserRepositoryListParams,
  UserRepositoryUpdateDto,
} from '../domain/UserRepository';
import type { IUserMaster, IUserMasterCreateDto } from '../types';
import { ensureUserId } from '../utils/userId';

const coerceId = (id: number | string): number => {
  const numeric = Number(id);
  if (!Number.isFinite(numeric)) {
    throw new Error(`Invalid user id: ${String(id)}`);
  }
  return numeric;
};

const cloneUser = (user: IUserMaster): IUserMaster => ({
  ...user,
  AttendanceDays: normalizeAttendanceDays(user.AttendanceDays),
});

const fromDto = (dto: IUserMasterCreateDto, nextId: number): IUserMaster => ({
  Id: nextId,
  UserID: ensureUserId(dto.UserID, nextId),
  FullName: dto.FullName,
  ContractDate: dto.ContractDate ?? undefined,
  IsHighIntensitySupportTarget: dto.IsHighIntensitySupportTarget ?? false,
  IsSupportProcedureTarget: dto.IsSupportProcedureTarget ?? false,
  ServiceStartDate: dto.ServiceStartDate ?? undefined,
  ServiceEndDate: dto.ServiceEndDate ?? null,
  AttendanceDays: normalizeAttendanceDays(dto.AttendanceDays),
});

export class InMemoryUserRepository implements UserRepository {
  private users: IUserMaster[] = [];
  private nextId = 1;
  private readonly listeners = new Set<() => void>();

  constructor(initialData: IUserMaster[] = []) {
    this.initialize(initialData);
  }

  public initialize(initialData: IUserMaster[]): void {
    this.users = initialData.map(cloneUser);
    this.nextId = this.users.length ? Math.max(...this.users.map((u) => Number(u.Id) || 0)) + 1 : 1;
    this.emit();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getSnapshot(): IUserMaster[] {
    return this.users;
  }

  public async getAll(params?: UserRepositoryListParams): Promise<IUserMaster[]> {
    if (params?.signal?.aborted) {
      return [];
    }
    const filters = params?.filters;
    let result = [...this.users];

    if (filters?.isActive !== undefined) {
      result = result.filter((user) => Boolean(user.IsActive) === Boolean(filters.isActive));
    }

    if (filters?.keyword) {
      const keyword = filters.keyword.trim().toLowerCase();
      if (keyword) {
        result = result.filter((user) => {
          const fullName = user.FullName?.toLowerCase() ?? '';
          const userId = user.UserID?.toLowerCase() ?? '';
          return fullName.includes(keyword) || userId.includes(keyword);
        });
      }
    }

    if (typeof params?.top === 'number' && params.top > 0) {
      return result.slice(0, params.top);
    }

    return result;
  }

  public async getById(id: number | string, params?: UserRepositoryGetParams): Promise<IUserMaster | null> {
    if (params?.signal?.aborted) {
      return null;
    }
    const numericId = coerceId(id);
    return this.users.find((user) => user.Id === numericId) ?? null;
  }

  public async create(payload: IUserMasterCreateDto): Promise<IUserMaster> {
    const record = fromDto(payload, this.nextId++);
    this.users = [record, ...this.users];
    this.emit();
    return record;
  }

  public async update(id: number | string, payload: UserRepositoryUpdateDto): Promise<IUserMaster> {
    const numericId = coerceId(id);
    let updated: IUserMaster | null = null;

    this.users = this.users.map((user) => {
      if (user.Id !== numericId) {
        return user;
      }
      updated = {
        ...user,
        ...payload,
      } as IUserMaster;
      if (payload.AttendanceDays !== undefined) {
        updated.AttendanceDays = normalizeAttendanceDays(payload.AttendanceDays);
      }
      return updated;
    });

    if (!updated) {
      throw new Error(`User with id ${numericId} not found`);
    }

    const ensured = updated as IUserMaster;
    ensured.AttendanceDays = normalizeAttendanceDays(ensured.AttendanceDays);
    this.emit();
    return ensured;
  }

  public async remove(id: number | string): Promise<void> {
    const numericId = coerceId(id);
    this.users = this.users.filter((user) => user.Id !== numericId);
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const inMemoryUserRepository = new InMemoryUserRepository(DEMO_USERS);

export const seedInMemoryUsers = (rows: IUserMaster[]): void => {
  inMemoryUserRepository.initialize(rows);
};

export const resetInMemoryUsers = (): void => {
  inMemoryUserRepository.initialize(DEMO_USERS);
};
