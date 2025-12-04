import type { IUserMaster, IUserMasterCreateDto } from '../types';

export type UserFilters = {
  keyword?: string;
  isActive?: boolean;
};

export type UserRepositoryListParams = {
  filters?: UserFilters;
  top?: number;
  signal?: AbortSignal;
};

export type UserRepositoryGetParams = {
  signal?: AbortSignal;
};

export type UserRepositoryUpdateDto = Partial<IUserMasterCreateDto>;

export interface UserRepository {
  getAll(params?: UserRepositoryListParams): Promise<IUserMaster[]>;
  getById(id: number | string, params?: UserRepositoryGetParams): Promise<IUserMaster | null>;
  create(payload: IUserMasterCreateDto): Promise<IUserMaster>;
  update(id: number | string, payload: UserRepositoryUpdateDto): Promise<IUserMaster>;
  remove(id: number | string): Promise<void>;
}
