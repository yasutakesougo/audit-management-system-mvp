/**
 * AttendanceUsers SharePoint Repository
 *
 * 通所対象ユーザーマスタのリポジトリ
 * ユーザーコード、送迎対象フラグ、標準提供時間など
 */

import { createSpClient, ensureConfig } from '@/lib/spClient';
import {
    ATTENDANCE_USERS_FIELDS,
    ATTENDANCE_USERS_LIST_TITLE,
    ATTENDANCE_USERS_SELECT_FIELDS
} from '@/sharepoint/fields';
import { parseTransportMethod, type TransportMethod } from '../transportMethod';

export type AttendanceUserItem = {
  Id?: number;
  Title: string; // userName
  UserCode: string;
  IsTransportTarget: boolean;
  StandardMinutes: number;
  IsActive: boolean;

  // 通所予定曜日（例: ['月','水','金']）
  AttendanceDays?: string[];

  // Transport method defaults (optional - migration)
  DefaultTransportToMethod?: TransportMethod;
  DefaultTransportFromMethod?: TransportMethod;
  DefaultTransportToNote?: string;
  DefaultTransportFromNote?: string;
};

type SharePointUserRow = Record<string, unknown> & { Id?: number };

const toAttendanceUser = (row: SharePointUserRow): AttendanceUserItem | null => {
  const userCode = row[ATTENDANCE_USERS_FIELDS.userCode];
  const title = row[ATTENDANCE_USERS_FIELDS.title];
  const isTransportTarget = row[ATTENDANCE_USERS_FIELDS.isTransportTarget];
  const standardMinutes = row[ATTENDANCE_USERS_FIELDS.standardMinutes];
  const isActive = row[ATTENDANCE_USERS_FIELDS.isActive];

  if (typeof userCode !== 'string' || typeof title !== 'string') return null;

  return {
    Id: typeof row.Id === 'number' ? row.Id : undefined,
    Title: title,
    UserCode: userCode,
    IsTransportTarget: Boolean(isTransportTarget),
    StandardMinutes: typeof standardMinutes === 'number' ? standardMinutes : 0,
    IsActive: Boolean(isActive),

    // Transport method defaults (optional - may not exist in SP yet)
    DefaultTransportToMethod: parseTransportMethod(row[ATTENDANCE_USERS_FIELDS.defaultTransportToMethod]),
    DefaultTransportFromMethod: parseTransportMethod(row[ATTENDANCE_USERS_FIELDS.defaultTransportFromMethod]),
    DefaultTransportToNote: typeof row[ATTENDANCE_USERS_FIELDS.defaultTransportToNote] === 'string'
      ? (row[ATTENDANCE_USERS_FIELDS.defaultTransportToNote] as string)
      : undefined,
    DefaultTransportFromNote: typeof row[ATTENDANCE_USERS_FIELDS.defaultTransportFromNote] === 'string'
      ? (row[ATTENDANCE_USERS_FIELDS.defaultTransportFromNote] as string)
      : undefined,
  };
};

/**
 * 有効な通所ユーザーを取得
 * @param client SharePoint client
 * @param listTitle リスト名（デフォルト: AttendanceUsers）
 * @returns AttendanceUserItem[]
 */
export async function getActiveUsers(
  client: ReturnType<typeof createSpClient>,
  listTitle: string = ATTENDANCE_USERS_LIST_TITLE
): Promise<AttendanceUserItem[]> {
  const select = [...ATTENDANCE_USERS_SELECT_FIELDS];
  const filter = `${ATTENDANCE_USERS_FIELDS.isActive} eq true`;
  const orderby = ATTENDANCE_USERS_FIELDS.userCode;

  try {
    const rows = await client.getListItemsByTitle<SharePointUserRow>(
      listTitle,
      select,
      filter,
      orderby
    );

    return (rows ?? [])
      .map(toAttendanceUser)
      .filter((u): u is AttendanceUserItem => u !== null);
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    const message = err instanceof Error ? err.message : String(err);

    // Graceful degradation: list not found (404) or field not found (400)
    if (status === 404 || message.includes('does not exist')) {
      console.warn(`[AttendanceUsers] List not found (404), returning empty.`);
      return [];
    }
    if (status === 400 || message.includes('は存在しません')) {
      console.warn(`[AttendanceUsers] Missing columns (400), returning empty. Provision required columns.`);
      return [];
    }

    console.error(`[AttendanceUsers] Failed to load:`, err);
    throw err;
  }
}

/**
 * デフォルトクライアントでのヘルパー（認証付き）
 */
export function createAttendanceUsersRepository(
  acquireToken: () => Promise<string | null>
) {
  const client = createSpClient(acquireToken, ensureConfig().baseUrl);

  return {
    getActiveUsers: (listTitle?: string) => getActiveUsers(client, listTitle),
  };
}
