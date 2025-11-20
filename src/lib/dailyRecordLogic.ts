import { PersonDaily } from '../domain/daily/types';

/**
 * 新しい日次記録のIDを生成する
 */
export function generateNewRecordId(existingRecords: PersonDaily[]): number {
  if (existingRecords.length === 0) {
    return 1;
  }
  return Math.max(...existingRecords.map(r => r.id)) + 1;
}

/**
 * 日次記録を追加する
 */
export function addDailyRecord(
  existingRecords: PersonDaily[],
  newRecord: Omit<PersonDaily, 'id'>
): PersonDaily[] {
  const id = generateNewRecordId(existingRecords);
  const recordWithId: PersonDaily = { ...newRecord, id };
  return [...existingRecords, recordWithId];
}

/**
 * 日次記録を更新する
 */
export function updateDailyRecord(
  existingRecords: PersonDaily[],
  recordId: number,
  updatedRecord: Omit<PersonDaily, 'id'>
): PersonDaily[] {
  return existingRecords.map(record =>
    record.id === recordId
      ? { ...updatedRecord, id: recordId }
      : record
  );
}

/**
 * 日次記録を削除する
 */
export function deleteDailyRecord(
  existingRecords: PersonDaily[],
  recordId: number
): PersonDaily[] {
  return existingRecords.filter(record => record.id !== recordId);
}

/**
 * 日次記録の保存処理（新規 or 更新を自動判定）
 */
export function saveDailyRecord(
  existingRecords: PersonDaily[],
  record: Omit<PersonDaily, 'id'>,
  editingRecordId?: number
): PersonDaily[] {
  if (editingRecordId !== undefined) {
    // 更新
    return updateDailyRecord(existingRecords, editingRecordId, record);
  } else {
    // 新規追加
    return addDailyRecord(existingRecords, record);
  }
}

/**
 * 日次記録のバリデーション
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateDailyRecord(record: Omit<PersonDaily, 'id'>): ValidationResult {
  const errors: string[] = [];

  // 必須フィールドのチェック
  if (!record.personName?.trim()) {
    errors.push('利用者名は必須です');
  }

  if (!record.personId?.trim()) {
    errors.push('利用者IDは必須です');
  }

  if (!record.date) {
    errors.push('日付は必須です');
  }

  // 日付形式のチェック
  if (record.date && !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) {
    errors.push('日付は YYYY-MM-DD 形式で入力してください');
  }

  // ステータスのチェック
  if (!['完了', '作成中', '未作成'].includes(record.status)) {
    errors.push('ステータスが不正です');
  }

  // 発作記録の整合性チェック
  if (record.data?.seizureRecord?.occurred) {
    if (!record.data.seizureRecord.time?.trim()) {
      errors.push('発作が発生した場合は時刻を入力してください');
    }
    if (!record.data.seizureRecord.duration?.trim()) {
      errors.push('発作が発生した場合は持続時間を入力してください');
    }
  }

  // その他の問題行動の詳細チェック
  if (record.data?.problemBehavior?.other && !record.data.problemBehavior.otherDetail?.trim()) {
    errors.push('その他の問題行動がある場合は詳細を入力してください');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * 今日の日次記録統計を計算
 */
export interface DailyRecordStats {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  completionRate: number;
}

export function calculateDailyRecordStats(
  records: PersonDaily[],
  targetDate?: string
): DailyRecordStats {
  const today = targetDate || new Date().toISOString().split('T')[0];
  const todayRecords = records.filter(record => record.date === today);

  const total = todayRecords.length;
  const completed = todayRecords.filter(r => r.status === '完了').length;
  const inProgress = todayRecords.filter(r => r.status === '作成中').length;
  const notStarted = todayRecords.filter(r => r.status === '未作成').length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    total,
    completed,
    inProgress,
    notStarted,
    completionRate
  };
}

/**
 * 利用者名での検索（部分一致）
 */
export function searchRecordsByName(
  records: PersonDaily[],
  searchQuery: string
): PersonDaily[] {
  if (!searchQuery.trim()) {
    return records;
  }

  const query = searchQuery.toLowerCase().trim();
  return records.filter(record =>
    record.personName.toLowerCase().includes(query) ||
    record.personId.toLowerCase().includes(query)
  );
}

/**
 * ステータスでフィルタリング
 */
export function filterRecordsByStatus(
  records: PersonDaily[],
  status: string
): PersonDaily[] {
  if (status === 'all') {
    return records;
  }
  return records.filter(record => record.status === status);
}

/**
 * 日付でフィルタリング
 */
export function filterRecordsByDate(
  records: PersonDaily[],
  date: string
): PersonDaily[] {
  if (!date) {
    return records;
  }
  return records.filter(record => record.date === date);
}