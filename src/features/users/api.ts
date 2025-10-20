import { useMemo } from "react";
import { pushAudit } from "../../lib/audit";
import { useSP } from "../../lib/spClient";
import {
  FIELD_MAP,
  LIST_CONFIG,
  ListKeys,
  USERS_SELECT_FIELDS,
  type IUserMaster,
  type IUserMasterCreateDto,
} from "../../sharepoint/fields";

const computeCutoffIso = () => {
  const now = new Date();
  const floor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return floor.toISOString();
};

let cachedDefaultFilter: { cutoff: string; filter: string } | null = null;

// “今”を固定したデフォルトフィルタを生成
export function buildDefaultActiveFilter(nowIso?: string) {
  if (nowIso) {
    return `(ServiceEndDate eq null) or (ServiceEndDate ge datetime'${nowIso}')`;
  }
  if (!cachedDefaultFilter) {
    const cutoff = computeCutoffIso();
    cachedDefaultFilter = {
      cutoff,
      filter: `(ServiceEndDate eq null) or (ServiceEndDate ge datetime'${cutoff}')`,
    };
  }
  return cachedDefaultFilter.filter;
}

type GetUsersOptions = { top?: number; signal?: AbortSignal };

// API フック（useSP を1回だけ初期化）
export function useUsersApi() {
  const { spFetch, getListItemsByTitle, addListItemByTitle } = useSP();
  const LIST_TITLE = LIST_CONFIG[ListKeys.UsersMaster].title;
  const SELECT_FIELDS = USERS_SELECT_FIELDS as readonly string[];
  return useMemo(() => {
    const select = SELECT_FIELDS as unknown as string[];
    const encodeTitle = (title: string) => encodeURIComponent(title);
    const itemPath = (id: number) =>
      `/_api/web/lists/getbytitle('${encodeTitle(LIST_TITLE)}')/items(${id})`;

    const getUsers = async (filter?: string, opt: GetUsersOptions = {}) => {
      const top = opt.top ?? 50;
      return getListItemsByTitle<IUserMaster>(
        LIST_TITLE,
        select,
        filter ?? buildDefaultActiveFilter(),
        undefined,
        top
      );
    };

    const getUserById = async (id: number) => {
      const results = await getListItemsByTitle<IUserMaster>(
        LIST_TITLE,
        select,
        `Id eq ${id}`,
        undefined,
        1
      );
      return results[0] ?? null;
    };

    const createUser = async (dto: IUserMasterCreateDto) => {
      const payload = {
        [FIELD_MAP.Users_Master.userId]: dto.UserID,
        [FIELD_MAP.Users_Master.fullName]: dto.FullName,
        [FIELD_MAP.Users_Master.contractDate]: dto.ContractDate,
        [FIELD_MAP.Users_Master.isHighIntensitySupportTarget]: dto.IsHighIntensitySupportTarget,
        [FIELD_MAP.Users_Master.serviceStartDate]: dto.ServiceStartDate,
        [FIELD_MAP.Users_Master.serviceEndDate]: dto.ServiceEndDate ?? null,
      };
      return withAudit({ baseAction: 'CREATE', entity: 'Users_Master', before: { payload } }, async () => {
        const created = await addListItemByTitle<typeof payload, IUserMaster>(LIST_TITLE, payload);
        // keep legacy simple audit for compatibility
        await pushAudit({
          actor: 'user',
          entity: 'Users_Master',
          action: 'create',
          entity_id: created?.Id != null ? String(created.Id) : undefined,
          channel: 'UI',
          after: { item: created },
        });
        return created;
      });
    };

    const updateUser = async (id: number, patch: Partial<IUserMasterCreateDto>) => {
      const payload: Record<string, unknown> = {};
      if (patch.UserID !== undefined) payload[FIELD_MAP.Users_Master.userId] = patch.UserID;
      if (patch.FullName !== undefined) payload[FIELD_MAP.Users_Master.fullName] = patch.FullName;
      if (patch.ContractDate !== undefined) payload[FIELD_MAP.Users_Master.contractDate] = patch.ContractDate;
      if (patch.IsHighIntensitySupportTarget !== undefined)
        payload[FIELD_MAP.Users_Master.isHighIntensitySupportTarget] = patch.IsHighIntensitySupportTarget;
      if (patch.ServiceStartDate !== undefined) payload[FIELD_MAP.Users_Master.serviceStartDate] = patch.ServiceStartDate;
      if (patch.ServiceEndDate !== undefined) payload[FIELD_MAP.Users_Master.serviceEndDate] = patch.ServiceEndDate;

      return withAudit({ baseAction: 'UPDATE', entity: 'Users_Master', before: { id, payload } }, async () => {
        await spFetch(itemPath(id), {
          method: 'PATCH',
          headers: {
            'IF-MATCH': '*',
            'Content-Type': 'application/json;odata=nometadata',
          },
          body: JSON.stringify(payload),
        });
        await pushAudit({
          actor: 'user',
          entity: 'Users_Master',
          action: 'update',
          entity_id: String(id),
          channel: 'UI',
          after: { patch: payload },
        });
        return getUserById(id);
      });
    };

    const deleteUser = async (id: number) => {
      return withAudit({ baseAction: 'DELETE', entity: 'Users_Master', before: { id } }, async () => {
        await spFetch(itemPath(id), {
          method: 'DELETE',
          headers: {
            'IF-MATCH': '*',
          },
        });
        await pushAudit({
          actor: 'user',
          entity: 'Users_Master',
          action: 'delete',
          entity_id: String(id),
          channel: 'UI',
        });
      });
    };

    return {
      usersListTitle: LIST_TITLE,
      getUsers,
      getUserById,
      createUser,
      updateUser,
      deleteUser,
    };
  }, [LIST_TITLE, SELECT_FIELDS, addListItemByTitle, getListItemsByTitle, spFetch]);
}
import { withAudit } from "@/lib/auditWrap";
