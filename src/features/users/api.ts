/**
 * useUsersApi
 *
 * Users SP API — Repository 経由の薄いラッパ。
 *
 * 以前は spFetch/getListItemsByTitle を直接呼んでいたが、
 * Step1 統合により全 SP アクセスは SharePointUserRepository に一本化。
 * audit ログは Repository 側で自動発行される。
 *
 * この hook の返り値 shape は既存の呼び元と互換を維持している。
 */
import { useMemo } from 'react';
import { LIST_CONFIG, ListKeys, type IUserMaster, type IUserMasterCreateDto } from '../../sharepoint/fields';
import { useUserRepository } from './repositoryFactory';

type GetUsersOptions = { top?: number; signal?: AbortSignal };

export function useUsersApi() {
  const repo = useUserRepository();
  const LIST_TITLE = LIST_CONFIG[ListKeys.UsersMaster].title;

  return useMemo(() => ({
    usersListTitle: LIST_TITLE,

    getUsers: async (_filter?: string, opt: GetUsersOptions = {}): Promise<IUserMaster[]> => {
      return repo.getAll({ top: opt.top, signal: opt.signal });
    },

    getUserById: async (id: number): Promise<IUserMaster | null> => {
      return repo.getById(id);
    },

    createUser: async (dto: IUserMasterCreateDto): Promise<IUserMaster> => {
      return repo.create(dto);
    },

    updateUser: async (id: number, patch: Partial<IUserMasterCreateDto>): Promise<IUserMaster | null> => {
      return repo.update(id, patch);
    },

    deleteUser: async (id: number): Promise<void> => {
      return repo.remove(id);
    },
  }), [LIST_TITLE, repo]);
}
