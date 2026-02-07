/**
 * AttendanceDaily SharePoint Repository
 * 
 * 通所記録日次データのリポジトリ
 * Keyベースでのupsert（更新または作成）操作を提供
 */

import { createSpClient, ensureConfig } from '@/lib/spClient';
import { 
  ATTENDANCE_DAILY_LIST_TITLE, 
  ATTENDANCE_DAILY_FIELDS,
  ATTENDANCE_DAILY_SELECT_FIELDS 
} from '@/sharepoint/fields';

export type AttendanceDailyItem = {
  Id?: number;
  Key: string;
  UserCode: string;
  RecordDate: string; // YYYY-MM-DD
  Status: string;
  CheckInAt?: string | null;
  CheckOutAt?: string | null;
  CntAttendIn?: number;
  CntAttendOut?: number;
  TransportTo?: boolean;
  TransportFrom?: boolean;
  ProvidedMinutes?: number | null;
  IsEarlyLeave?: boolean;
  UserConfirmedAt?: string | null;
  AbsentMorningContacted?: boolean;
  AbsentMorningMethod?: string;
  EveningChecked?: boolean;
  EveningNote?: string;
  IsAbsenceAddonClaimable?: boolean;
};

type SharePointDailyRow = Record<string, unknown> & { Id?: number };

const escapeODataString = (value: string): string => value.replace(/'/g, "''");

const getString = (value: unknown): string | undefined => 
  typeof value === 'string' ? value : undefined;

const getNumber = (value: unknown): number | undefined => 
  typeof value === 'number' ? value : undefined;

const getBool = (value: unknown): boolean => Boolean(value);

const toAttendanceDaily = (row: SharePointDailyRow): AttendanceDailyItem | null => {
  const key = getString(row[ATTENDANCE_DAILY_FIELDS.key]);
  const userCode = getString(row[ATTENDANCE_DAILY_FIELDS.userCode]);
  const recordDate = getString(row[ATTENDANCE_DAILY_FIELDS.recordDate]);
  const status = getString(row[ATTENDANCE_DAILY_FIELDS.status]);

  if (!key || !userCode || !recordDate || !status) return null;

  return {
    Id: typeof row.Id === 'number' ? row.Id : undefined,
    Key: key,
    UserCode: userCode,
    RecordDate: recordDate,
    Status: status,
    CheckInAt: getString(row[ATTENDANCE_DAILY_FIELDS.checkInAt]) ?? null,
    CheckOutAt: getString(row[ATTENDANCE_DAILY_FIELDS.checkOutAt]) ?? null,
    CntAttendIn: getNumber(row[ATTENDANCE_DAILY_FIELDS.cntAttendIn]) ?? 0,
    CntAttendOut: getNumber(row[ATTENDANCE_DAILY_FIELDS.cntAttendOut]) ?? 0,
    TransportTo: getBool(row[ATTENDANCE_DAILY_FIELDS.transportTo]),
    TransportFrom: getBool(row[ATTENDANCE_DAILY_FIELDS.transportFrom]),
    ProvidedMinutes: getNumber(row[ATTENDANCE_DAILY_FIELDS.providedMinutes]) ?? null,
    IsEarlyLeave: getBool(row[ATTENDANCE_DAILY_FIELDS.isEarlyLeave]),
    UserConfirmedAt: getString(row[ATTENDANCE_DAILY_FIELDS.userConfirmedAt]) ?? null,
    AbsentMorningContacted: getBool(row[ATTENDANCE_DAILY_FIELDS.absentMorningContacted]),
    AbsentMorningMethod: getString(row[ATTENDANCE_DAILY_FIELDS.absentMorningMethod]) ?? '',
    EveningChecked: getBool(row[ATTENDANCE_DAILY_FIELDS.eveningChecked]),
    EveningNote: getString(row[ATTENDANCE_DAILY_FIELDS.eveningNote]) ?? '',
    IsAbsenceAddonClaimable: getBool(row[ATTENDANCE_DAILY_FIELDS.isAbsenceAddonClaimable]),
  };
};

const omitUndefined = (record: Record<string, unknown>): Record<string, unknown> => {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
};

const toSpPayload = (item: AttendanceDailyItem): Record<string, unknown> => {
  return omitUndefined({
    [ATTENDANCE_DAILY_FIELDS.key]: item.Key,
    [ATTENDANCE_DAILY_FIELDS.userCode]: item.UserCode,
    [ATTENDANCE_DAILY_FIELDS.recordDate]: item.RecordDate,
    [ATTENDANCE_DAILY_FIELDS.status]: item.Status,
    [ATTENDANCE_DAILY_FIELDS.checkInAt]: item.CheckInAt,
    [ATTENDANCE_DAILY_FIELDS.checkOutAt]: item.CheckOutAt,
    [ATTENDANCE_DAILY_FIELDS.cntAttendIn]: item.CntAttendIn,
    [ATTENDANCE_DAILY_FIELDS.cntAttendOut]: item.CntAttendOut,
    [ATTENDANCE_DAILY_FIELDS.transportTo]: item.TransportTo,
    [ATTENDANCE_DAILY_FIELDS.transportFrom]: item.TransportFrom,
    [ATTENDANCE_DAILY_FIELDS.providedMinutes]: item.ProvidedMinutes,
    [ATTENDANCE_DAILY_FIELDS.isEarlyLeave]: item.IsEarlyLeave,
    [ATTENDANCE_DAILY_FIELDS.userConfirmedAt]: item.UserConfirmedAt,
    [ATTENDANCE_DAILY_FIELDS.absentMorningContacted]: item.AbsentMorningContacted,
    [ATTENDANCE_DAILY_FIELDS.absentMorningMethod]: item.AbsentMorningMethod,
    [ATTENDANCE_DAILY_FIELDS.eveningChecked]: item.EveningChecked,
    [ATTENDANCE_DAILY_FIELDS.eveningNote]: item.EveningNote,
    [ATTENDANCE_DAILY_FIELDS.isAbsenceAddonClaimable]: item.IsAbsenceAddonClaimable,
  });
};

/**
 * 指定日の記録を取得
 * @param client SharePoint client
 * @param recordDate YYYY-MM-DD形式の日付
 * @param listTitle リスト名（デフォルト: AttendanceDaily）
 */
export async function getDailyByDate(
  client: ReturnType<typeof createSpClient>,
  recordDate: string,
  listTitle: string = ATTENDANCE_DAILY_LIST_TITLE
): Promise<AttendanceDailyItem[]> {
  const select = [...ATTENDANCE_DAILY_SELECT_FIELDS] as unknown as string[];
  const filter = `${ATTENDANCE_DAILY_FIELDS.recordDate} eq '${escapeODataString(recordDate)}'`;

  const rows = await client.getListItemsByTitle<SharePointDailyRow>(
    listTitle,
    select,
    filter
  );

  return (rows ?? [])
    .map(toAttendanceDaily)
    .filter((item): item is AttendanceDailyItem => item !== null);
}

/**
 * KeyでUpsert（更新または作成）
 * 1. Key で検索（top=1）
 * 2. 存在すれば PATCH (updateItemByTitle)
 * 3. 存在しなければ POST (addListItemByTitle)
 * 
 * @param client SharePoint client
 * @param item AttendanceDailyItem
 * @param listTitle リスト名（デフォルト: AttendanceDaily）
 */
export async function upsertDailyByKey(
  client: ReturnType<typeof createSpClient>,
  item: AttendanceDailyItem,
  listTitle: string = ATTENDANCE_DAILY_LIST_TITLE
): Promise<void> {
  const select = [...ATTENDANCE_DAILY_SELECT_FIELDS] as unknown as string[];
  const filter = `${ATTENDANCE_DAILY_FIELDS.key} eq '${escapeODataString(item.Key)}'`;

  // 1) GET by Key (top 1)
  const existing = await client.getListItemsByTitle<SharePointDailyRow>(
    listTitle,
    select,
    filter,
    undefined,
    1
  );

  const payload = toSpPayload(item);

  // 2) if found -> PATCH by Id
  if (existing && existing.length > 0 && typeof existing[0].Id === 'number') {
    const existingId = existing[0].Id;
    const { etag } = await client.getItemByIdWithEtag(listTitle, existingId, select);
    await client.updateItemByTitle(listTitle, existingId, payload, { ifMatch: etag ?? '*' });
    return;
  }

  // 3) else -> POST
  await client.addListItemByTitle(listTitle, payload);
}

/**
 * デフォルトクライアントでのヘルパー（認証付き）
 */
export function createAttendanceDailyRepository(
  acquireToken: () => Promise<string | null>
) {
  const client = createSpClient(acquireToken, ensureConfig().baseUrl);

  return {
    getDailyByDate: (recordDate: string, listTitle?: string) => 
      getDailyByDate(client, recordDate, listTitle),
    upsertDailyByKey: (item: AttendanceDailyItem, listTitle?: string) => 
      upsertDailyByKey(client, item, listTitle),
  };
}
