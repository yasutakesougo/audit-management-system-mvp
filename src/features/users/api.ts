import { useMemo } from "react";
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
  const sp = useSP();
  const LIST_TITLE = LIST_CONFIG[ListKeys.UsersMaster].title;
  const SELECT_FIELDS = USERS_SELECT_FIELDS as readonly string[];
  return useMemo(() => {
    const select = SELECT_FIELDS as unknown as string[];

    const getUsers = async (filter?: string, opt: GetUsersOptions = {}) => {
      const top = opt.top ?? 50;
      return sp.getListItemsByTitle<IUserMaster>(
        LIST_TITLE,
        select,
        filter ?? buildDefaultActiveFilter(),
        undefined,
        top,
        opt.signal
      );
    };

    const getUserById = (id: number) => sp.getItemById<IUserMaster>(LIST_TITLE, id, select);

    const createUser = async (dto: IUserMasterCreateDto) => {
      const payload = {
        [FIELD_MAP.Users_Master.userId]: dto.UserID,
        [FIELD_MAP.Users_Master.fullName]: dto.FullName,
        [FIELD_MAP.Users_Master.contractDate]: dto.ContractDate,
        [FIELD_MAP.Users_Master.isHighIntensitySupportTarget]: dto.IsHighIntensitySupportTarget,
        [FIELD_MAP.Users_Master.serviceStartDate]: dto.ServiceStartDate,
        [FIELD_MAP.Users_Master.serviceEndDate]: dto.ServiceEndDate ?? null,
      };
      const created = await sp.addItemByTitle<typeof payload, IUserMaster>(LIST_TITLE, payload);
      const { pushAudit } = await import("../../lib/audit");
      await pushAudit({
        actor: "system",
        action: "create",
        entity: LIST_TITLE,
        entity_id: String(created.Id),
        channel: "SPO",
        after: payload,
      });
      return created;
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

      const updated = await sp.updateItemByTitle<typeof payload, IUserMaster>(LIST_TITLE, id, payload);
      const { pushAudit } = await import("../../lib/audit");
      await pushAudit({
        actor: "system",
        action: "update",
        entity: LIST_TITLE,
        entity_id: String(id),
        channel: "SPO",
        after: payload,
      });
      return updated;
    };

    const deleteUser = async (id: number) => {
      await sp.deleteItemByTitle(LIST_TITLE, id);
      const { pushAudit } = await import("../../lib/audit");
      await pushAudit({
        actor: "system",
        action: "delete",
        entity: LIST_TITLE,
        entity_id: String(id),
        channel: "SPO",
        before: {},
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
  }, [sp]);
}

