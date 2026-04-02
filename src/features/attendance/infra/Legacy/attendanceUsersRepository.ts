/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/* eslint-disable */
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
import { parseTransportMethod, type TransportMethod } from '../../transportMethod';
import { 
  resolveInternalNamesDetailed, 
  areEssentialFieldsResolved 
} from '@/lib/sp/helpers';
import { ATTENDANCE_USERS_CANDIDATES } from '@/sharepoint/fields';
import { auditLog } from '@/lib/debugLogger';

export type AttendanceUserItem = {
  Id?: number;
  Title: string; // userName
  UserCode: string;
  IsTransportTarget: boolean;
  StandardMinutes: number;
  IsActive: boolean;
  ServiceEndDate?: string;
  UsageStatus?: string;

  // 通所予定曜日（例: ['月','水','金']）
  AttendanceDays?: string[];

  // Transport method defaults (optional - migration)
  DefaultTransportToMethod?: TransportMethod;
  DefaultTransportFromMethod?: TransportMethod;
  DefaultTransportToNote?: string;
  DefaultTransportFromNote?: string;
};

type SharePointUserRow = Record<string, unknown> & { Id?: number };

const toAttendanceUser = (
  row: SharePointUserRow, 
  fieldMap?: Record<string, string | undefined>
): AttendanceUserItem | null => {
  // Use resolved names if available, otherwise fallback to registry defaults
  const userCodeKey = fieldMap?.userCode || ATTENDANCE_USERS_FIELDS.userCode;
  const titleKey = fieldMap?.title || ATTENDANCE_USERS_FIELDS.title;
  const isTransportTargetKey = fieldMap?.isTransportTarget || ATTENDANCE_USERS_FIELDS.isTransportTarget;
  const standardMinutesKey = fieldMap?.standardMinutes || ATTENDANCE_USERS_FIELDS.standardMinutes;
  const isActiveKey = fieldMap?.isActive || ATTENDANCE_USERS_FIELDS.isActive;
  const serviceEndDateKey = fieldMap?.serviceEndDate || ATTENDANCE_USERS_FIELDS.serviceEndDate;
  const usageStatusKey = fieldMap?.usageStatus || ATTENDANCE_USERS_FIELDS.usageStatus;

  const userCode = row[userCodeKey];
  const title = row[titleKey];
  const isTransportTarget = row[isTransportTargetKey];
  const standardMinutes = row[standardMinutesKey];
  const isActive = row[isActiveKey];

  if (typeof userCode !== 'string' || typeof title !== 'string') return null;

  return {
    Id: typeof row.Id === 'number' ? row.Id : undefined,
    Title: title,
    UserCode: userCode,
    IsTransportTarget: Boolean(isTransportTarget),
    StandardMinutes: typeof standardMinutes === 'number' ? standardMinutes : 0,
    IsActive: Boolean(isActive),
    // Safe fallbacks for missing physical columns
    ServiceEndDate: typeof row[serviceEndDateKey] === 'string'
      ? (row[serviceEndDateKey] as string)
      : undefined,
    UsageStatus: typeof row[usageStatusKey] === 'string'
      ? (row[usageStatusKey] as string)
      : '利用中', // 欠落時は「利用中」とみなして全員表示
    
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
  listTitle: string = ATTENDANCE_USERS_LIST_TITLE,
  date?: string
): Promise<AttendanceUserItem[]> {
  try {
    // 1. SharePoint の物理列情報を取得して動的に `$select` を構築する
    const availableFields = await client.getListFieldInternalNames(listTitle);
    const { resolved, missing } = resolveInternalNamesDetailed(availableFields, ATTENDANCE_USERS_CANDIDATES);

    if (missing.length > 0) {
      auditLog.warn('attendance:repo', `Missing some columns in ${listTitle}. Falling back to defaults for: ${missing.join(', ')}`);
    }

    // 存在する列のみを `$select` に含める（これで HTTP 400 を回避）
    const activeSelectFields = Object.values(resolved).filter((name): name is string => !!name);
    // 常に必要な基本 ID は含める
    if (!activeSelectFields.includes('Id')) activeSelectFields.push('Id');

    const filter = resolved.isActive 
      ? `${resolved.isActive} eq true`
      : undefined; // IsActive 列がない場合はフィルタなし（全員取得）
    
    const orderby = resolved.userCode || 'Id';

    const rows = await client.getListItemsByTitle<SharePointUserRow>(
      listTitle,
      activeSelectFields,
      filter,
      orderby
    );

    const refDate = date || new Date().toISOString().split('T')[0];
    return (rows ?? [])
      .map(row => toAttendanceUser(row, resolved))
      .filter((u): u is AttendanceUserItem => {
        if (!u) return false;
        // Basic active flag (if column missing, assume true)
        if (resolved.isActive && !u.IsActive) return false;

        // Usage status check (if column missing, UsageStatus defaults to '利用中')
        if (u.UsageStatus && (u.UsageStatus.includes('終了') || u.UsageStatus.includes('退会'))) return false;
        
        // Contract end date check (if column missing, ServiceEndDate is undefined)
        if (u.ServiceEndDate && u.ServiceEndDate < refDate) return false;
        
        return true;
      });
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
    getActiveUsers: (listTitle?: string, date?: string) => getActiveUsers(client, listTitle, date),
  };
}
