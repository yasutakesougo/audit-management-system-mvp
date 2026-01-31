import { readOptionalEnv } from '@/lib/env';
import { toSafeError } from '@/lib/errors';
import { createSpClient, ensureConfig } from '@/lib/spClient';
import { STAFF_ATTENDANCE_LIST_TITLE } from '@/sharepoint/fields';

export type StaffAttendancePreflightResult = {
  status: 'connected' | 'blocked';
  reason: string | null;
};

const getHttpStatus = (error: unknown): number | undefined => {
  const anyErr = error as { status?: number; response?: { status?: number } };
  return anyErr?.status ?? anyErr?.response?.status;
};

export const resolveStaffAttendanceListTitle = (): string =>
  readOptionalEnv('VITE_SP_LIST_STAFF_ATTENDANCE') ?? STAFF_ATTENDANCE_LIST_TITLE;

export async function preflightStaffAttendanceList(args: {
  acquireToken: () => Promise<string | null>;
  listTitle?: string;
}): Promise<StaffAttendancePreflightResult> {
  const listTitle = args.listTitle ?? resolveStaffAttendanceListTitle();

  try {
    const { baseUrl } = ensureConfig();
    if (!baseUrl) {
      return {
        status: 'blocked',
        reason: 'SharePoint 接続が無効です（デモ/スキップ設定）。',
      };
    }

    const client = createSpClient(args.acquireToken, baseUrl);
    const metadata = await client.tryGetListMetadata(listTitle);

    if (metadata) {
      return { status: 'connected', reason: null };
    }

    return { status: 'blocked', reason: 'Staff_Attendance list が見つかりません。' };
  } catch (err) {
    const status = getHttpStatus(err);
    if (status === 401) {
      return { status: 'blocked', reason: 'SharePoint 認証が必要です（401）。' };
    }
    if (status === 403) {
      return { status: 'blocked', reason: 'SharePoint 権限がありません（403）。' };
    }

    const safe = toSafeError(err);
    return { status: 'blocked', reason: safe.message || 'SharePoint 接続に失敗しました。' };
  }
}
