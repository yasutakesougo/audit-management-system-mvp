import { useEffect, useMemo } from 'react';
import { isScheduleFixturesMode } from '@/features/schedule/api/schedulesClient';
import { useToast } from '@/hooks/useToast';
import { readBool, readEnv } from '@/lib/env';
import type { SpFieldDef, UseSP } from '@/lib/spClient';
import { syncServiceTypeChoices } from './ensureScheduleList.syncServiceTypes';

type ScheduleSpClient = Pick<UseSP, 'spFetch' | 'ensureListExists'>;

type GuidIdentifier = { type: 'guid'; value: string } | { type: 'title'; value: string };

const GUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const DEFAULT_SCHEDULE_LIST_TITLE = 'Schedules';
const DEFAULT_USERS_LIST_TITLE = 'Users_Master';
const DEFAULT_STAFF_LIST_TITLE = 'Staff_Master';

const STATUS_CHOICES = ['下書き', '申請中', '承認済み', '完了'] as const;
const CATEGORY_CHOICES = ['生活介護', '一時ケア', 'ショートステイ', '来客', 'イベント'] as const;

let ensureScheduleListPromise: Promise<void> | null = null;
let cachedUserListId: string | null = null;
let cachedStaffListId: string | null = null;

const getEnvString = (key: string): string => readEnv(key, '').trim();

const normalizeGuid = (value: string | null | undefined): string => {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const bare = trimmed.replace(/[{}]/g, '');
  return GUID_REGEX.test(bare) ? bare : '';
};

const parseGuidToken = (value: string): string => {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const tokenMatch = trimmed.match(/guid\s*[:=]\s*([^\s]+)/i);
  if (tokenMatch?.[1]) {
    const normalized = normalizeGuid(tokenMatch[1]);
    if (normalized) return normalized;
  }
  return normalizeGuid(trimmed);
};

const resolveScheduleListTitle = (): string => {
  const override = getEnvString('VITE_SP_LIST_SCHEDULES');
  return override || DEFAULT_SCHEDULE_LIST_TITLE;
};

const resolveUsersListIdentifier = (): GuidIdentifier => {
  const override = getEnvString('VITE_SP_LIST_USERS');
  if (override) {
    const maybeGuid = parseGuidToken(override);
    if (maybeGuid) {
      return { type: 'guid', value: maybeGuid };
    }
    return { type: 'title', value: override };
  }
  return { type: 'title', value: DEFAULT_USERS_LIST_TITLE };
};

const resolveStaffListIdentifier = (): GuidIdentifier => {
  const guidOverride = parseGuidToken(getEnvString('VITE_SP_LIST_STAFF_GUID'));
  if (guidOverride) {
    return { type: 'guid', value: guidOverride };
  }
  const override = getEnvString('VITE_SP_LIST_STAFF');
  if (override) {
    const maybeGuid = parseGuidToken(override);
    if (maybeGuid) {
      return { type: 'guid', value: maybeGuid };
    }
    return { type: 'title', value: override };
  }
  return { type: 'title', value: DEFAULT_STAFF_LIST_TITLE };
};

const buildListPath = (identifier: GuidIdentifier): string => {
  if (identifier.type === 'guid') {
    return `/lists(guid'${identifier.value}')`;
  }
  const encoded = encodeURIComponent(identifier.value);
  return `/lists/getbytitle('${encoded}')`;
};

const fetchListId = async (sp: ScheduleSpClient, identifier: GuidIdentifier): Promise<string> => {
  if (identifier.type === 'guid') {
    return identifier.value;
  }

  const path = `${buildListPath(identifier)}?$select=Id`;
  const res = await sp.spFetch(path);
  if (!res.ok) {
    throw new Error(`SharePoint リスト "${identifier.value}" の確認に失敗しました (HTTP ${res.status})`);
  }
  const json = await res.json().catch(() => ({}));
  const id =
    typeof json?.Id === 'string'
      ? json.Id
      : typeof json?.id === 'string'
        ? json.id
        : typeof (json as { d?: { Id?: string } })?.d?.Id === 'string'
          ? ((json as { d?: { Id?: string } }).d?.Id as string)
          : '';
  const normalized = normalizeGuid(id);
  if (!normalized) {
    throw new Error(`SharePoint リスト "${identifier.value}" の ID を取得できませんでした。`);
  }
  return normalized;
};

const resolveUserListId = async (sp: ScheduleSpClient): Promise<string> => {
  if (cachedUserListId) {
    return cachedUserListId;
  }
  const identifier = resolveUsersListIdentifier();
  const listId = await fetchListId(sp, identifier);
  cachedUserListId = listId;
  return listId;
};

const resolveStaffListId = async (sp: ScheduleSpClient): Promise<string> => {
  if (cachedStaffListId) {
    return cachedStaffListId;
  }
  const identifier = resolveStaffListIdentifier();
  const listId = await fetchListId(sp, identifier);
  cachedStaffListId = listId;
  return listId;
};

const buildScheduleFieldDefs = (userListId: string, staffListId: string): SpFieldDef[] => [
  { internalName: 'Title', type: 'Text', required: true },
  { internalName: 'StartUtc', type: 'DateTime', required: true },
  { internalName: 'EndUtc', type: 'DateTime', required: true },
  { internalName: 'AllDay', type: 'Boolean', required: true },
  { internalName: 'Status', type: 'Choice', required: true, choices: [...STATUS_CHOICES] },
  { internalName: 'Category', type: 'Choice', choices: [...CATEGORY_CHOICES] },
  { internalName: 'UserId', type: 'Lookup', lookupListId: userListId },
  { internalName: 'StaffId', type: 'Lookup', lookupListId: staffListId },
  { internalName: 'Recurrence', type: 'Note' },
];

const ensureScheduleListInternal = async (sp: ScheduleSpClient): Promise<void> => {
  if (isScheduleFixturesMode()) {
    console.debug('[Schedule] fixtures mode: skip ensureScheduleList SharePoint calls');
    return;
  }
  if (typeof window !== 'undefined') {
    try {
      const globalScope = window as Window & { __E2E_SCHEDULE_ENSURE__?: number };
      globalScope.__E2E_SCHEDULE_ENSURE__ = (globalScope.__E2E_SCHEDULE_ENSURE__ ?? 0) + 1;
    } catch {
      /* noop */
    }
  }
  const [userListId, staffListId] = await Promise.all([resolveUserListId(sp), resolveStaffListId(sp)]);
  const fieldDefs = buildScheduleFieldDefs(userListId, staffListId);
  const listTitle = resolveScheduleListTitle();
  await sp.ensureListExists(listTitle, fieldDefs);

  try {
    const syncResult = await syncServiceTypeChoices(sp, listTitle);
    if (syncResult.updated) {
      console.info('[Schedule] ServiceType choices synced', syncResult.choices);
    }
  } catch (error) {
    console.warn('[Schedule] ServiceType choice sync skipped', error);
  }
};

export const ensureScheduleList = async (sp: ScheduleSpClient): Promise<void> => {
  if (!ensureScheduleListPromise) {
    ensureScheduleListPromise = ensureScheduleListInternal(sp).catch((error) => {
      ensureScheduleListPromise = null;
      throw error;
    });
  }
  return ensureScheduleListPromise;
};

export const useEnsureScheduleList = (sp: ScheduleSpClient): void => {
  const { show } = useToast();
  const skipProvision = useMemo(() => {
    if (typeof window !== 'undefined') {
      const flag = (window as Window & { __SKIP_ENSURE_SCHEDULE__?: boolean }).__SKIP_ENSURE_SCHEDULE__;
      if (typeof flag === 'boolean') {
        return flag;
      }
    }
    if (readBool('VITE_SKIP_ENSURE_SCHEDULE', false)) {
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (skipProvision) {
      return;
    }
    let cancelled = false;

    ensureScheduleList(sp).catch((error) => {
      if (cancelled) {
        return;
      }
      console.error('[Schedule] ensureListExists failed', error);
      const message = error instanceof Error ? error.message : String(error);
      show('warning', `スケジュールリストの準備に失敗しました（読み取り専用で続行します）: ${message}`);
    });

    return () => {
      cancelled = true;
    };
  }, [skipProvision, sp, show]);
};
