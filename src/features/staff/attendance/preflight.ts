import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { readOptionalEnv } from '@/lib/env';
import { toSafeError } from '@/lib/errors';
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
  provider: IDataProvider;
  listTitle?: string;
}): Promise<StaffAttendancePreflightResult> {
  const listTitle = args.listTitle ?? resolveStaffAttendanceListTitle();

  try {
    const metadata = await args.provider.getMetadata(listTitle);

    if (metadata && metadata.Id) {
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
    if (status === 404) {
      return { status: 'blocked', reason: 'Staff_Attendance list が存在しません（404）。' };
    }

    const safe = toSafeError(err);
    return { status: 'blocked', reason: safe.message || 'SharePoint 接続に失敗しました。' };
  }
}
