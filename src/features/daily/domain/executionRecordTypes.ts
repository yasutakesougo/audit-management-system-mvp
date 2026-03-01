import { z } from 'zod';

// ---------------------------------------------------------------------------
// 実施記録（Execution Record）ドメイン型
//
// ScheduleItem（時間割の1スロット）に対する日ごとの実施結果を記録する。
// PDCAサイクルの「Do / Check」に相当。
// ---------------------------------------------------------------------------

/**
 * 実施ステータス
 * - completed: 予定通り完了
 * - triggered: 行動発生（BIP発動）
 * - skipped: スキップ（欠席・時間変更等）
 * - unrecorded: 未記録（デフォルト）
 */
export type RecordStatus = 'completed' | 'triggered' | 'skipped' | 'unrecorded';

/**
 * 1スロット分の実施記録
 */
export type ExecutionRecord = {
  /** 一意なID: `${date}-${userId}-${scheduleItemId}` */
  id: string;
  /** 実施日 (YYYY-MM-DD) */
  date: string;
  /** 対象利用者ID */
  userId: string;
  /** ProcedureItem（時間割）のID or scheduleKey */
  scheduleItemId: string;
  /** 実施ステータス */
  status: RecordStatus;
  /** status が 'triggered' の場合、発動した BIP の ID リスト */
  triggeredBipIds: string[];
  /** 現場スタッフの簡易メモ（任意） */
  memo: string;
  /** 記録者（スタッフ名など、MVP では空文字可） */
  recordedBy: string;
  /** 記録時刻 (ISO文字列) */
  recordedAt: string;
};

/**
 * 日付×ユーザー単位での記録集合
 */
export type DailyUserRecords = {
  date: string;
  userId: string;
  records: ExecutionRecord[];
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Zod Validation
// ---------------------------------------------------------------------------

export const executionRecordSchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  userId: z.string().min(1),
  scheduleItemId: z.string().min(1),
  status: z.enum(['completed', 'triggered', 'skipped', 'unrecorded']),
  triggeredBipIds: z.array(z.string()),
  memo: z.string(),
  recordedBy: z.string(),
  recordedAt: z.string(),
});

export const dailyUserRecordsSchema = z.object({
  date: z.string(),
  userId: z.string(),
  records: z.array(executionRecordSchema),
  updatedAt: z.string(),
});

export const executionStoreSchema = z.object({
  version: z.literal(1),
  data: z.record(z.string(), dailyUserRecordsSchema),
});

export type ExecutionStorePayload = z.infer<typeof executionStoreSchema>;

export const EXECUTION_RECORD_KEY = 'executionRecord.v1';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/** 複合キーを生成 */
export function makeRecordId(date: string, userId: string, scheduleItemId: string): string {
  return `${date}-${userId}-${scheduleItemId}`;
}

/** 日付×ユーザーの辞書キーを生成 */
export function makeDailyUserKey(date: string, userId: string): string {
  return `${date}::${userId}`;
}

/** 空の ExecutionRecord を生成 */
export function createEmptyRecord(
  date: string,
  userId: string,
  scheduleItemId: string,
): ExecutionRecord {
  return {
    id: makeRecordId(date, userId, scheduleItemId),
    date,
    userId,
    scheduleItemId,
    status: 'unrecorded',
    triggeredBipIds: [],
    memo: '',
    recordedBy: '',
    recordedAt: '',
  };
}
