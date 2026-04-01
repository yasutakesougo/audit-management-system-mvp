import type { Staff } from '@/types';

export interface StaffRepositoryListParams {
  signal?: AbortSignal;
  top?: number;
  skip?: number;
  filter?: string;
  orderBy?: string;
}

export interface StaffRepository {
  getAll(params?: StaffRepositoryListParams): Promise<Staff[]>;
  getById(id: number | string, options?: { signal?: AbortSignal }): Promise<Staff | null>;
  create(payload: Partial<Staff>): Promise<Staff>;
  update(id: number | string, payload: Partial<Staff>): Promise<Staff>;
  remove(id: number | string): Promise<void>;
}
