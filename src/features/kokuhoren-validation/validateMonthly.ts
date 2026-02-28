/**
 * 国保連プリバリデーション — 月次バリデーション
 *
 * 純粋関数。MonthlyProvisionInput を受け取り ValidationResult を返す。
 * ルールは catalog.ts のIDに1:1で対応。
 */
import type {
  KokuhorenUserProfile,
  MonthlyProvisionInput,
  ValidationIssue,
  ValidationResult,
} from './types';
import { getRuleMessage } from './catalog';
import { ABSENT_SUPPORT_MONTHLY_LIMIT } from './catalog';
import {
  deriveProvisionEntry,
  hasDataOnNonProvided,
  isDurationExtreme,
} from './derive';

// ─── ヘルパー ────────────────────────────────────────────────

function issue(
  ruleId: string,
  userCode: string,
  targetDate: string,
  overrides?: Partial<ValidationIssue>,
): ValidationIssue {
  // catalog からメッセージを動的取得するが、存在しないIDでも安全に
  let message: string;
  try {
    message = getRuleMessage(ruleId as Parameters<typeof getRuleMessage>[0]);
  } catch {
    message = ruleId;
  }
  return {
    ruleId,
    level: 'BLOCK',
    userCode,
    targetDate,
    message,
    ...overrides,
  };
}

// ─── バリデーション ─────────────────────────────────────────

/**
 * 月次バリデーション実行
 */
export function validateMonthly(input: MonthlyProvisionInput): ValidationResult {
  const issues: ValidationIssue[] = [];
  const userMap = new Map<string, KokuhorenUserProfile>();

  for (const user of input.users) {
    userMap.set(user.userCode, user);
  }

  // ユーザーごとの月間カウンタ
  const absentSupportCount = new Map<string, number>();

  // ──────────────────────────────────────────────────────────
  // Rule KOKU-71-001: 受給者証番号未登録（ユーザー単位、1回だけ）
  // ──────────────────────────────────────────────────────────
  const usersWithRecords = new Set(input.records.map((r) => r.userCode));

  for (const userCode of usersWithRecords) {
    const user = userMap.get(userCode);
    const cert = user?.recipientCertNumber?.trim();

    if (!cert || !/^\d{10}$/.test(cert)) {
      issues.push(
        issue('KOKU-71-001', userCode, input.yearMonth, {
          level: 'BLOCK',
          targetField: 'recipientCertNumber',
          message: `${user?.userName ?? userCode}: 受給者証番号が未登録または不正です`,
        }),
      );
    }
  }

  // ──────────────────────────────────────────────────────────
  // レコード単位のルール
  // ──────────────────────────────────────────────────────────
  for (const record of input.records) {
    const derived = deriveProvisionEntry(record);

    if (record.status === '提供') {
      // ── KOKU-71-002: 提供なのに時刻片方欠け ────────────
      if (record.startHHMM == null || record.endHHMM == null) {
        issues.push(
          issue('KOKU-71-002', record.userCode, record.recordDateISO, {
            level: 'BLOCK',
            targetField: 'startHHMM/endHHMM',
          }),
        );
      }

      // ── KOKU-71-003: 開始≧終了 ─────────────────────────
      if (
        record.startHHMM != null &&
        record.endHHMM != null &&
        record.startHHMM >= record.endHHMM
      ) {
        issues.push(
          issue('KOKU-71-003', record.userCode, record.recordDateISO, {
            level: 'BLOCK',
            targetField: 'startHHMM/endHHMM',
          }),
        );
      }

      // ── KOKU-71-005: 算定時間コード算出不能 ─────────────
      if (
        record.startHHMM != null &&
        record.endHHMM != null &&
        record.startHHMM < record.endHHMM &&
        derived.timeCode == null
      ) {
        issues.push(
          issue('KOKU-71-005', record.userCode, record.recordDateISO, {
            level: 'BLOCK',
            targetField: 'timeCode',
          }),
        );
      }

      // ── KOKU-71-101: 送迎ありだが時間未入力 ────────────
      if (
        record.hasTransport &&
        (record.startHHMM == null || record.endHHMM == null)
      ) {
        issues.push(
          issue('KOKU-71-101', record.userCode, record.recordDateISO, {
            level: 'WARNING',
            targetField: 'hasTransport',
          }),
        );
      }

      // ── KOKU-71-102: 滞在時間が極端 ────────────────────
      if (isDurationExtreme(derived.durationMinutes)) {
        issues.push(
          issue('KOKU-71-102', record.userCode, record.recordDateISO, {
            level: 'WARNING',
            targetField: 'durationMinutes',
            message: `滞在時間 ${derived.durationMinutes}分 は確認が必要です`,
          }),
        );
      }
    } else {
      // ── KOKU-71-004: 非提供レコードに時間/加算 ─────────
      if (hasDataOnNonProvided(record)) {
        issues.push(
          issue('KOKU-71-004', record.userCode, record.recordDateISO, {
            level: 'BLOCK',
          }),
        );
      }
    }

    // ── 欠席時対応カウント ────────────────────────────────
    if (record.hasAbsentSupport) {
      const count = (absentSupportCount.get(record.userCode) ?? 0) + 1;
      absentSupportCount.set(record.userCode, count);
    }
  }

  // ──────────────────────────────────────────────────────────
  // KOKU-71-103: 欠席時対応の月間回数上限
  // ──────────────────────────────────────────────────────────
  for (const [userCode, count] of absentSupportCount) {
    if (count > ABSENT_SUPPORT_MONTHLY_LIMIT) {
      issues.push(
        issue('KOKU-71-103', userCode, input.yearMonth, {
          level: 'WARNING',
          targetField: 'hasAbsentSupport',
          message: `欠席時対応が月${count}回（上限${ABSENT_SUPPORT_MONTHLY_LIMIT}回）`,
        }),
      );
    }
  }

  // ──────────────────────────────────────────────────────────
  // 集計
  // ──────────────────────────────────────────────────────────
  const blockCount = issues.filter((i) => i.level === 'BLOCK').length;
  const warningCount = issues.filter((i) => i.level === 'WARNING').length;
  const infoCount = issues.filter((i) => i.level === 'INFO').length;

  return {
    yearMonth: input.yearMonth,
    issues,
    summary: {
      blockCount,
      warningCount,
      infoCount,
      totalRecords: input.records.length,
      validRecords: input.records.length - blockCount,
    },
    isValidForExport: blockCount === 0,
  };
}
