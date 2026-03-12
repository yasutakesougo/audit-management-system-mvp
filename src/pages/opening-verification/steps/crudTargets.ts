/**
 * Step 4: CRUD Verification — Target definitions
 *
 * Separated from execution logic so runStep4 stays focused on
 * the Read / Create / Update flow.
 */

export interface CrudTarget {
  entity: string;
  listKey: string;
  selectFields: string;
  createPayload?: Record<string, unknown>;
  updateField?: string;
  updateValue?: unknown;
}

export const CRUD_TARGETS: CrudTarget[] = [
  {
    entity: 'Users',
    listKey: 'users_master',
    selectFields: 'Id,Title,UserID,FullName',
  },
  {
    entity: 'Daily',
    listKey: 'daily_activity_records',
    selectFields: 'Id,UserCode,RecordDate,TimeSlot,Observation',
    createPayload: {
      UserCode: '__SMOKE_TEST__',
      RecordDate: new Date().toISOString().slice(0, 10),
      TimeSlot: '09:00-10:00',
      Observation: 'A班開通テスト - 自動作成レコード',
    },
    updateField: 'Observation',
    updateValue: 'A班開通テスト - 更新済み',
  },
  {
    entity: 'Attendance',
    listKey: 'attendance_daily',
    selectFields: 'Id,UserCode,RecordDate,Status',
  },
  {
    entity: 'Handoff',
    listKey: 'handoff',
    selectFields: 'Id,Title,Message,Status,Created',
    createPayload: {
      Title: `A班開通テスト_${Date.now()}`,
      Message: 'A班開通テスト - 自動作成引継ぎ',
      Status: '未対応',
      Category: 'テスト',
      Severity: '通常',
    },
    updateField: 'Status',
    updateValue: '対応済み',
  },
  {
    entity: 'Staff Attendance',
    listKey: 'staff_attendance',
    selectFields: 'Id,StaffId,RecordDate,Status',
  },
];
