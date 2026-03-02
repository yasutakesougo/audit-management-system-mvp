import type { PersonDaily } from '@/domain/daily/types';

export type DailyRecordWithoutId = Omit<PersonDaily, 'id'>;

export type DailyRecordValidationResult = {
  isValid: boolean;
  errors: string[];
};

export type DailyRecordStatusFilter = '完了' | '作成中' | '未作成' | 'all';

export type DailyRecordStats = {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  completionRate: number;
};

/**
 * 既存レコード配列から次のIDを採番する
 */
export function generateNewRecordId(records: PersonDaily[]): number {
  if (!records.length) return 1;
  const maxId = records.reduce((max, record) => (record.id > max ? record.id : max), records[0].id);
  return maxId + 1;
}

/**
 * 新しい日次記録を追加する（immutable）
 */
export function addDailyRecord(existing: PersonDaily[], newRecord: DailyRecordWithoutId): PersonDaily[] {
  const newId = generateNewRecordId(existing);
  const recordWithId: PersonDaily = { ...newRecord, id: newId };
  return [...existing, recordWithId];
}

/**
 * 指定IDのレコードを更新する（immutable）
 * 見つからなければ元配列をそのまま返す
 */
export function updateDailyRecord(
  existing: PersonDaily[],
  targetId: number,
  updated: DailyRecordWithoutId,
): PersonDaily[] {
  let found = false;
  const next = existing.map((record) => {
    if (record.id !== targetId) {
      return record;
    }
    found = true;
    return { ...record, ...updated, id: record.id };
  });

  return found ? next : existing;
}

/**
 * 指定IDのレコードを削除する
 */
export function deleteDailyRecord(existing: PersonDaily[], targetId: number): PersonDaily[] {
  const next = existing.filter((record) => record.id !== targetId);
  return next.length === existing.length ? existing : next;
}

/**
 * editingRecordId の有無に応じて追加 or 更新を行う
 */
export function saveDailyRecord(
  existing: PersonDaily[],
  record: DailyRecordWithoutId,
  editingRecordId?: number,
): PersonDaily[] {
  if (editingRecordId == null) {
    return addDailyRecord(existing, record);
  }
  return updateDailyRecord(existing, editingRecordId, record);
}

/**
 * 日付（YYYY-MM-DD）簡易チェック
 */
function isValidDateFormat(value: string): boolean {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  const [y, m, d] = trimmed.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * 日次記録のバリデーション
 */
export function validateDailyRecord(record: DailyRecordWithoutId): DailyRecordValidationResult {
  const errors: string[] = [];

  if (!record.personName || !record.personName.trim()) {
    errors.push('利用者名は必須です');
  }

  if (!record.personId || !record.personId.trim()) {
    errors.push('利用者の選択は必須です');
  }

  if (!record.date || !record.date.trim()) {
    errors.push('日付は必須です');
  } else if (!isValidDateFormat(record.date)) {
    errors.push('日付は YYYY-MM-DD 形式で入力してください');
  }

  const allowedStatuses: Array<PersonDaily['status']> = ['完了', '作成中', '未作成'];
  if (!allowedStatuses.includes(record.status)) {
    errors.push('ステータスが不正です');
  }

  const seizure = record.data?.seizureRecord;
  if (seizure?.occurred) {
    if (!seizure.time || !seizure.time.trim()) {
      errors.push('発作が発生した場合は時刻を入力してください');
    }
    if (!seizure.duration || !seizure.duration.trim()) {
      errors.push('発作が発生した場合は持続時間を入力してください');
    }
  }

  const problemBehavior = record.data?.problemBehavior;
  if (problemBehavior?.other) {
    if (!problemBehavior.otherDetail || !problemBehavior.otherDetail.trim()) {
      errors.push('その他の問題行動がある場合は詳細を入力してください');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 名前/ID での簡易検索
 */
export function searchRecordsByName(records: PersonDaily[], query: string): PersonDaily[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return records;
  }

  return records.filter((record) => {
    const nameHit = record.personName?.includes(trimmed);
    const idHit = record.personId?.includes(trimmed);
    return Boolean(nameHit || idHit);
  });
}

/**
 * ステータスでフィルタリング
 */
export function filterRecordsByStatus(
  records: PersonDaily[],
  status: DailyRecordStatusFilter,
): PersonDaily[] {
  if (status === 'all') {
    return records;
  }
  return records.filter((record) => record.status === status);
}

/**
 * 日付でフィルタリング
 */
export function filterRecordsByDate(records: PersonDaily[], date: string): PersonDaily[] {
  const trimmed = date.trim();
  if (!trimmed) {
    return records;
  }
  return records.filter((record) => record.date === trimmed);
}

/**
 * 日次記録の統計を計算する
 */
export function calculateDailyRecordStats(records: PersonDaily[], date?: string): DailyRecordStats {
  const targetDate = date && date.trim() ? date.trim() : new Date().toISOString().split('T')[0];
  const todaysRecords = filterRecordsByDate(records, targetDate);

  const total = todaysRecords.length;
  const completed = todaysRecords.filter((record) => record.status === '完了').length;
  const inProgress = todaysRecords.filter((record) => record.status === '作成中').length;
  const notStarted = todaysRecords.filter((record) => record.status === '未作成').length;
  const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);

  return {
    total,
    completed,
    inProgress,
    notStarted,
    completionRate,
  };
}
