// contract:allow-interface — Repository interface defines behavior contract, not data shapes (SSOT = schema.ts)
import type { UserSelectMode } from '@/sharepoint/fields';
import type { IUserMaster, IUserMasterCreateDto } from '../types';

export type UserFilters = {
  keyword?: string;
  isActive?: boolean;
};

export type UserRepositoryListParams = {
  filters?: UserFilters;
  top?: number;
  selectMode?: UserSelectMode;
  signal?: AbortSignal;
};

export type UserRepositoryGetParams = {
  selectMode?: UserSelectMode;
  signal?: AbortSignal;
};

export type UserRepositoryUpdateDto = Partial<IUserMasterCreateDto>;

export type UserRepository = {
  getAll(params?: UserRepositoryListParams): Promise<IUserMaster[]>;
  getById(id: number | string, params?: UserRepositoryGetParams): Promise<IUserMaster | null>;
  create(payload: IUserMasterCreateDto): Promise<IUserMaster>;
  update(id: number | string, payload: UserRepositoryUpdateDto): Promise<IUserMaster>;
  terminate(id: number | string): Promise<IUserMaster>;
  remove(id: number | string): Promise<void>;
}
