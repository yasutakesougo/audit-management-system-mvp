// contract:allow-interface
export interface RawDailyRecord {
  Id?: number;
  UserIdId?: number | null;
  TargetDate?: string | null;
  ServiceType?: string | null;
  Status?: string | null;
  Notes?: string | null;
}

export interface UserMasterData {
  Id: number;
  FullName: string;
}

export interface TableRowViewModel {
  recordId: number | null; // 新規の場合は null
  userId: number;
  userName: string;
  targetDate: string;
  serviceType: string;
  status: 'draft' | 'completed' | 'unknown';
  notes: string;
}

/**
 * 生レコードの欠損フィールドを補完し正規化する
 */
export function normalizeDailyRecord(raw: Partial<RawDailyRecord>): RawDailyRecord {
  return {
    Id: raw.Id,
    UserIdId: typeof raw.UserIdId === 'number' ? raw.UserIdId : null,
    TargetDate: raw.TargetDate ? raw.TargetDate.trim() : null,
    ServiceType: raw.ServiceType ? raw.ServiceType.trim() : '通常',
    Status: raw.Status ? raw.Status.trim() : 'draft',
    Notes: raw.Notes ? raw.Notes.trim() : '',
  };
}

/**
 * 正規化されたレコードとユーザー情報を結合し、表示用 ViewModel に変換する
 */
export function toTableRowViewModel(
  record: RawDailyRecord,
  user?: UserMasterData
): TableRowViewModel {
  // ユーザーIDのフォールバック
  const userId = record.UserIdId ?? user?.Id ?? -1;
  const userName = user?.FullName ?? '不明なユーザー';

  // ステータス変換
  let status: TableRowViewModel['status'] = 'unknown';
  const rawStatus = record.Status?.toLowerCase();
  if (rawStatus === 'draft' || rawStatus === '下書き') {
    status = 'draft';
  } else if (rawStatus === 'completed' || rawStatus === '完了' || rawStatus === '確定') {
    status = 'completed';
  }

  return {
    recordId: record.Id ?? null,
    userId,
    userName,
    targetDate: record.TargetDate ?? '',
    serviceType: record.ServiceType ?? '通常',
    status,
    notes: record.Notes ?? '',
  };
}

/**
 * リスト全体を ViewModel に一括変換・ソートする
 */
export function mapToTableViewModel(
  records: RawDailyRecord[],
  users: UserMasterData[]
): TableRowViewModel[] {
  const userMap = new Map(users.map(u => [u.Id, u]));

  const viewModels = records.map(raw => {
    const normalized = normalizeDailyRecord(raw);
    const user = normalized.UserIdId ? userMap.get(normalized.UserIdId) : undefined;
    return toTableRowViewModel(normalized, user);
  });

  // 日付降順 -> 名前昇順の固定ソート
  viewModels.sort((a, b) => {
    if (a.targetDate !== b.targetDate) {
      return a.targetDate > b.targetDate ? -1 : 1;
    }
    return a.userName.localeCompare(b.userName, 'ja');
  });

  return viewModels;
}
