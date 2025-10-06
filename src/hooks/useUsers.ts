import { useCallback } from 'react';
import { useSP } from '@/lib/spClient';
import { LIST_CONFIG, ListKeys, USERS_SELECT_FIELDS } from '@/sharepoint/fields';
import type { SpUserItem, UserUpsert } from '@/types';
import { toUserItem } from '@/types';

const USERS_LIST_TITLE = LIST_CONFIG[ListKeys.UsersMaster]?.title ?? 'Users_Master';
const USER_DETAIL_FIELDS: string[] = [...USERS_SELECT_FIELDS];

export function useUsers() {
  const sp = useSP();

  const createUser = useCallback(async (input: UserUpsert): Promise<SpUserItem> => {
    const payload = toUserItem(input);
    const created = await sp.createItem(USERS_LIST_TITLE, payload);
    return created as SpUserItem;
  }, [sp]);

  const updateUser = useCallback(async (id: number, input: UserUpsert): Promise<SpUserItem> => {
    const payload = toUserItem(input);
    await sp.updateItem(USERS_LIST_TITLE, id, payload);
    return sp.getItemById<SpUserItem>(USERS_LIST_TITLE, id, USER_DETAIL_FIELDS);
  }, [sp]);

  const getUserById = useCallback(async (id: number): Promise<SpUserItem> => {
    return sp.getItemById<SpUserItem>(USERS_LIST_TITLE, id, USER_DETAIL_FIELDS);
  }, [sp]);

  return {
    createUser,
    updateUser,
    getUserById,
  };
}
