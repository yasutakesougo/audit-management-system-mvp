import { useMemo } from 'react';
import { useSP, type UseSP } from '../../lib/spClient';
import { pushAudit } from '../../lib/audit';
import { FIELD_MAP, LIST_CONFIG, ListKeys } from '../../sharepoint/fields';
import type { IUserMaster, IUserMasterCreateDto, IUserMasterUpdateDto } from './types';

const LIST_KEY = ListKeys.Users_Master;
const LIST_TITLE = LIST_CONFIG[LIST_KEY].title;
const FIELD_INTERNAL = FIELD_MAP[LIST_KEY];
const SELECT_FIELDS: string[] = [
  'Id',
  'Created',
  'Modified',
  FIELD_INTERNAL.userId,
  FIELD_INTERNAL.fullName,
  FIELD_INTERNAL.contractDate,
  FIELD_INTERNAL.serviceStartDate,
  FIELD_INTERNAL.serviceEndDate,
  FIELD_INTERNAL.isHighIntensitySupportTarget,
] as const;

const LIST_PREVIEW_FIELDS: string[] = [
  'Id',
  FIELD_INTERNAL.userId,
  FIELD_INTERNAL.fullName,
  FIELD_INTERNAL.contractDate,
  FIELD_INTERNAL.isHighIntensitySupportTarget,
] as const;

const ITEMS_ENDPOINT = `/lists/getbytitle('${encodeURIComponent(LIST_TITLE)}')/items`;

function ensureClient(client?: UseSP): UseSP {
  if (!client) {
    throw new Error('SharePoint client instance is required. Call these APIs via useUsers hook.');
  }
  return client;
}

function normalizeDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') return value;
  return String(value);
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const lowered = value.toLowerCase();
    return lowered === 'true' || lowered === '1' || lowered === 'yes';
  }
  return false;
}

function fromSP(item: Record<string, any>): IUserMaster {
  return {
    id: Number(item.Id ?? item.ID ?? 0),
    userId: item[FIELD_INTERNAL.userId] ?? '',
    fullName: item[FIELD_INTERNAL.fullName] ?? '',
    contractDate: normalizeDate(item[FIELD_INTERNAL.contractDate]),
    serviceStartDate: normalizeDate(item[FIELD_INTERNAL.serviceStartDate]),
    serviceEndDate: normalizeDate(item[FIELD_INTERNAL.serviceEndDate]),
    isHighIntensitySupportTarget: normalizeBoolean(item[FIELD_INTERNAL.isHighIntensitySupportTarget]),
    created: normalizeDate(item.Created),
    modified: normalizeDate(item.Modified),
  };
}

function toSP(payload: Partial<IUserMasterCreateDto | IUserMasterUpdateDto>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (payload.userId !== undefined) body[FIELD_INTERNAL.userId] = payload.userId;
  if (payload.fullName !== undefined) body[FIELD_INTERNAL.fullName] = payload.fullName;
  if (payload.contractDate !== undefined) body[FIELD_INTERNAL.contractDate] = payload.contractDate || null;
  if (payload.serviceStartDate !== undefined) body[FIELD_INTERNAL.serviceStartDate] = payload.serviceStartDate || null;
  if (payload.serviceEndDate !== undefined) body[FIELD_INTERNAL.serviceEndDate] = payload.serviceEndDate || null;
  if (payload.isHighIntensitySupportTarget !== undefined) {
    body[FIELD_INTERNAL.isHighIntensitySupportTarget] = !!payload.isHighIntensitySupportTarget;
  }
  return body;
}

function buildDefaultActiveFilter(): string {
  const endField = FIELD_INTERNAL.serviceEndDate;
  const todayIso = new Date().toISOString();
  return `(${endField} eq null) or (${endField} ge datetime'${todayIso}')`;
}

async function fetchItemById(id: number | string, client: UseSP): Promise<IUserMaster> {
  const path = `${ITEMS_ENDPOINT}(${Number(id)})?$select=${SELECT_FIELDS.join(',')}`;
  const res = await client.spFetch(path);
  const data = await res.json();
  return fromSP(data);
}

export async function getUsers(filter?: string, client?: UseSP): Promise<IUserMaster[]> {
  const sp = ensureClient(client);
  const rows = await sp.getListItemsByTitle<Record<string, any>>(
    LIST_TITLE,
    LIST_PREVIEW_FIELDS as unknown as string[],
    filter ?? buildDefaultActiveFilter(),
    undefined,
    50
  );
  return rows.map(fromSP);
}

export async function getUserById(id: number | string, client?: UseSP): Promise<IUserMaster> {
  const sp = ensureClient(client);
  return fetchItemById(id, sp);
}

export async function createUser(data: IUserMasterCreateDto, client?: UseSP): Promise<IUserMaster> {
  const sp = ensureClient(client);
  const body = toSP(data);
  const createdRaw = await sp.addListItemByTitle<Record<string, unknown>, Record<string, any>>(LIST_TITLE, body);
  const createdId = Number(createdRaw?.Id ?? createdRaw?.ID ?? createdRaw?.id);
  if (!Number.isFinite(createdId) || createdId <= 0) {
    throw new Error('Failed to determine created item ID for Users_Master.');
  }
  const created = await fetchItemById(createdId, sp);

  pushAudit({
    actor: 'user',
    action: 'CREATE_USER',
    entity: LIST_TITLE,
    entity_id: String(created.id),
    channel: 'UI',
    after: created as unknown as Record<string, unknown>,
  });

  return created;
}

export async function updateUser(id: number | string, data: IUserMasterUpdateDto, client?: UseSP): Promise<IUserMaster> {
  const sp = ensureClient(client);
  const numericId = Number(id);
  const before = await fetchItemById(numericId, sp);
  const body = toSP(data);

  await sp.spFetch(`${ITEMS_ENDPOINT}(${numericId})`, {
    method: 'POST',
    headers: {
      'IF-MATCH': '*',
      'X-HTTP-Method': 'MERGE',
    },
    body: JSON.stringify(body),
  });

  const after = await fetchItemById(numericId, sp);

  pushAudit({
    actor: 'user',
    action: 'UPDATE_USER',
    entity: LIST_TITLE,
    entity_id: String(numericId),
    channel: 'UI',
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
  });

  return after;
}

export async function deleteUser(id: number | string, client?: UseSP): Promise<void> {
  const sp = ensureClient(client);
  const numericId = Number(id);
  const before = await fetchItemById(numericId, sp);

  await sp.spFetch(`${ITEMS_ENDPOINT}(${numericId})`, {
    method: 'POST',
    headers: {
      'IF-MATCH': '*',
      'X-HTTP-Method': 'DELETE',
    },
  });

  pushAudit({
    actor: 'user',
    action: 'DELETE_USER',
    entity: LIST_TITLE,
    entity_id: String(numericId),
    channel: 'UI',
    before: before as unknown as Record<string, unknown>,
  });
}

export function useUsersApi() {
  const client = useSP();

  return useMemo(() => ({
    getUsers: (filter?: string) => getUsers(filter, client),
    getUserById: (id: number | string) => getUserById(id, client),
    createUser: (payload: IUserMasterCreateDto) => createUser(payload, client),
    updateUser: (id: number | string, payload: IUserMasterUpdateDto) => updateUser(id, payload, client),
    deleteUser: (id: number | string) => deleteUser(id, client),
  }), [client]);
}
