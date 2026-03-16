/**
 * 申し送りアラートルールエンジン — Pure Function
 *
 * @description
 * HandoffRecord[] に対してルールベースの自動検出を行い、
 * 要注意パターンをアラートとして可視化する。
 *
 * 設計方針:
 * - ルール定義はデータ駆動（AlertRule 配列）。追加・変更が容易
 * - 判定ロジックは Pure Function — React / Hook / 外部API 依存ゼロ
 * - 利用者単位で評価し、発火したルールと根拠（handoffIds）を返す
 * - Phase 1 の extractKeywords / computeUserTrends とは独立動作
 *   （同じ HandoffRecord[] を入力として受け取る）
 *
 * @see analysisTypes.ts — 共有型定義
 */

import type {
  HandoffCategory,
  HandoffRecord,
} from './analysisTypes';

// ────────────────────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────────────────────

/** アラートの深刻度 */
export type AlertSeverity = 'info' | 'warning' | 'alert' | 'critical';

/** アラートルール定義 */
export interface AlertRule {
  /** ルールID（一意） */
  id: string;
  /** 表示ラベル */
  label: string;
  /** ルールの説明 */
  description: string;
  /** 対象カテゴリ（未指定なら全カテゴリ） */
  targetCategory?: HandoffCategory;
  /** 検出時の深刻度 */
  severity: AlertSeverity;
  /** 推奨アクション */
  suggestion: string;
  /** 判定関数: 対象利用者のレコードを受け取り、発火していれば根拠 handoffIds を返す */
  evaluate: (records: HandoffRecord[], baseDate: Date) => number[] | null;
}

/** 発火したアラート */
export interface TriggeredAlert {
  /** ルールID */
  ruleId: string;
  /** ルールラベル */
  label: string;
  /** 深刻度 */
  severity: AlertSeverity;
  /** 推奨アクション */
  suggestion: string;
  /** 対象利用者コード */
  userCode: string;
  /** 対象利用者名 */
  userDisplayName: string;
  /** 根拠となる申し送り ID */
  evidenceHandoffIds: number[];
}

/** evaluateAlertRules の出力 */
export interface AlertEvaluationResult {
  /** 全発火アラート（severity 降順 → userCode 昇順） */
  alerts: TriggeredAlert[];
  /** severity 別カウント */
  bySeverity: Record<AlertSeverity, number>;
  /** 影響を受けた利用者数 */
  affectedUserCount: number;
  /** 評価対象の利用者数 */
  totalUsersEvaluated: number;
}

// ────────────────────────────────────────────────────────────
// 内部ヘルパー
// ────────────────────────────────────────────────────────────

/**
 * レコードをユーザー別にグループ化。
 * userCode が空のレコードは除外。
 */
function groupByUser(records: HandoffRecord[]): Map<string, HandoffRecord[]> {
  const map = new Map<string, HandoffRecord[]>();
  for (const r of records) {
    if (!r.userCode || r.userCode.trim() === '') continue;
    const group = map.get(r.userCode);
    if (group) {
      group.push(r);
    } else {
      map.set(r.userCode, [r]);
    }
  }
  return map;
}

/**
 * 利用者の最新 displayName を取得。
 */
function latestDisplayName(records: HandoffRecord[]): string {
  if (records.length === 0) return '';
  let latest = records[0];
  for (const r of records) {
    if (r.createdAt > latest.createdAt) latest = r;
  }
  return latest.userDisplayName;
}

/**
 * severity の数値重み（ソート用）
 */
const SEVERITY_WEIGHT: Record<AlertSeverity, number> = {
  info: 0,
  warning: 1,
  alert: 2,
  critical: 3,
};

// ────────────────────────────────────────────────────────────
// ルール判定ユーティリティ（ルール定義内から使う）
// ────────────────────────────────────────────────────────────

/**
 * 指定カテゴリのレコードを日付文字列(YYYY-MM-DD)ごとにグループ化し、
 * baseDate から遡って連続日数を返す。
 */
export function countConsecutiveDays(
  records: HandoffRecord[],
  category: HandoffCategory,
  baseDate: Date,
): { consecutiveDays: number; handoffIds: number[] } {
  // カテゴリでフィルタ
  const catRecords = records.filter((r) => r.category === category);
  if (catRecords.length === 0) return { consecutiveDays: 0, handoffIds: [] };

  // 日付ごとにグループ化
  const dateSet = new Map<string, number[]>();
  for (const r of catRecords) {
    const dateKey = r.createdAt.substring(0, 10); // YYYY-MM-DD
    const ids = dateSet.get(dateKey);
    if (ids) ids.push(r.id);
    else dateSet.set(dateKey, [r.id]);
  }

  // baseDate から遡って連続日数をカウント
  let count = 0;
  const allIds: number[] = [];
  const d = new Date(baseDate);

  for (let i = 0; i < 30; i++) { // 最大30日遡る
    const key = d.toISOString().substring(0, 10);
    const ids = dateSet.get(key);
    if (ids) {
      count++;
      allIds.push(...ids);
    } else {
      break; // 連続途切れ
    }
    d.setDate(d.getDate() - 1);
  }

  return { consecutiveDays: count, handoffIds: allIds };
}

/**
 * 指定カテゴリのレコードが期間内に何件あるかカウント。
 */
export function countInPeriod(
  records: HandoffRecord[],
  category: HandoffCategory,
  periodDays: number,
  baseDate: Date,
): { count: number; handoffIds: number[] } {
  const cutoff = new Date(baseDate);
  cutoff.setDate(cutoff.getDate() - periodDays);
  const cutoffIso = cutoff.toISOString();

  const matched = records.filter(
    (r) => r.category === category && r.createdAt >= cutoffIso,
  );

  return {
    count: matched.length,
    handoffIds: matched.map((r) => r.id),
  };
}

/**
 * 指定カテゴリで未対応のまま N 日以上経過しているレコードがあるか。
 */
export function findStaleHandoffs(
  records: HandoffRecord[],
  category: HandoffCategory,
  staleDays: number,
  baseDate: Date,
): { hasStale: boolean; handoffIds: number[] } {
  const thresholdDate = new Date(baseDate);
  thresholdDate.setDate(thresholdDate.getDate() - staleDays);
  const thresholdIso = thresholdDate.toISOString();

  const stale = records.filter(
    (r) =>
      r.category === category &&
      r.createdAt <= thresholdIso &&
      r.status !== '対応済' &&
      r.status !== '完了' &&
      r.status !== '確認済',
  );

  return {
    hasStale: stale.length > 0,
    handoffIds: stale.map((r) => r.id),
  };
}

// ────────────────────────────────────────────────────────────
// デフォルトルール定義
// ────────────────────────────────────────────────────────────

export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: 'consecutive-health-3d',
    label: '3日連続の体調報告',
    description: '同一利用者の「体調」カテゴリ申し送りが3日連続以上',
    targetCategory: '体調',
    severity: 'warning',
    suggestion: '看護師への相談を検討してください',
    evaluate: (records, baseDate) => {
      const { consecutiveDays, handoffIds } = countConsecutiveDays(records, '体調', baseDate);
      return consecutiveDays >= 3 ? handoffIds : null;
    },
  },
  {
    id: 'behavior-3-in-7d',
    label: '行動面が週3回以上',
    description: '同一利用者の「行動面」カテゴリが直近7日で3回以上',
    targetCategory: '行動面',
    severity: 'alert',
    suggestion: 'ABC分析の実施を推奨します',
    evaluate: (records, baseDate) => {
      const { count, handoffIds } = countInPeriod(records, '行動面', 7, baseDate);
      return count >= 3 ? handoffIds : null;
    },
  },
  {
    id: 'family-stale-3d',
    label: '家族連絡が未対応3日経過',
    description: '「家族連絡」カテゴリが未対応のまま3日以上経過',
    targetCategory: '家族連絡',
    severity: 'critical',
    suggestion: '管理者へのエスカレーションを推奨します',
    evaluate: (records, baseDate) => {
      const { hasStale, handoffIds } = findStaleHandoffs(records, '家族連絡', 3, baseDate);
      return hasStale ? handoffIds : null;
    },
  },
  {
    id: 'risk-any-7d',
    label: '直近7日にリスク案件あり',
    description: '「事故・ヒヤリ」カテゴリが直近7日で発生',
    targetCategory: '事故・ヒヤリ',
    severity: 'alert',
    suggestion: 'ヒヤリハット報告書の確認・記入を推奨します',
    evaluate: (records, baseDate) => {
      const { count, handoffIds } = countInPeriod(records, '事故・ヒヤリ', 7, baseDate);
      return count >= 1 ? handoffIds : null;
    },
  },
  {
    id: 'severity-high-consecutive-2d',
    label: '2日連続の重要案件',
    description: '重要度「重要」の申し送りが2日連続以上',
    severity: 'warning',
    suggestion: 'ケース会議での検討を推奨します',
    evaluate: (records, baseDate) => {
      // 重要度フィルタ
      const important = records.filter((r) => r.severity === '重要');
      if (important.length < 2) return null;

      // 日付グループ化
      const dateSet = new Map<string, number[]>();
      for (const r of important) {
        const key = r.createdAt.substring(0, 10);
        const ids = dateSet.get(key);
        if (ids) ids.push(r.id);
        else dateSet.set(key, [r.id]);
      }

      // baseDate から遡って連続チェック
      const d = new Date(baseDate);
      let count = 0;
      const allIds: number[] = [];

      for (let i = 0; i < 14; i++) {
        const key = d.toISOString().substring(0, 10);
        const ids = dateSet.get(key);
        if (ids) {
          count++;
          allIds.push(...ids);
        } else {
          break;
        }
        d.setDate(d.getDate() - 1);
      }

      return count >= 2 ? allIds : null;
    },
  },
];

// ────────────────────────────────────────────────────────────
// メイン関数
// ────────────────────────────────────────────────────────────

export interface EvaluateAlertRulesOptions {
  /** 評価ルール（未指定なら DEFAULT_ALERT_RULES） */
  rules?: AlertRule[];
  /** 基準日（未指定なら現在日時。テストで固定可能） */
  baseDate?: Date;
}

/**
 * 全利用者に対してアラートルールを評価し、発火したアラートを返す。
 *
 * @param records 分析対象の申し送りレコード
 * @param options 評価オプション
 * @returns アラート評価結果
 *
 * @example
 * ```ts
 * const result = evaluateAlertRules(records);
 * // result.alerts → [{ ruleId: 'consecutive-health-3d', userCode: 'U001', ... }]
 * ```
 */
export function evaluateAlertRules(
  records: HandoffRecord[],
  options?: EvaluateAlertRulesOptions,
): AlertEvaluationResult {
  const rules = options?.rules ?? DEFAULT_ALERT_RULES;
  const baseDate = options?.baseDate ?? new Date();

  if (records.length === 0 || rules.length === 0) {
    return {
      alerts: [],
      bySeverity: { info: 0, warning: 0, alert: 0, critical: 0 },
      affectedUserCount: 0,
      totalUsersEvaluated: 0,
    };
  }

  const userGroups = groupByUser(records);
  const alerts: TriggeredAlert[] = [];
  const affectedUsers = new Set<string>();

  for (const [userCode, userRecords] of userGroups) {
    const displayName = latestDisplayName(userRecords);

    for (const rule of rules) {
      const evidenceIds = rule.evaluate(userRecords, baseDate);
      if (evidenceIds && evidenceIds.length > 0) {
        alerts.push({
          ruleId: rule.id,
          label: rule.label,
          severity: rule.severity,
          suggestion: rule.suggestion,
          userCode,
          userDisplayName: displayName,
          evidenceHandoffIds: evidenceIds,
        });
        affectedUsers.add(userCode);
      }
    }
  }

  // 深刻度降順 → userCode 昇順
  alerts.sort((a, b) => {
    const sevDiff = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
    if (sevDiff !== 0) return sevDiff;
    return a.userCode.localeCompare(b.userCode);
  });

  // severity 別カウント
  const bySeverity: Record<AlertSeverity, number> = { info: 0, warning: 0, alert: 0, critical: 0 };
  for (const a of alerts) {
    bySeverity[a.severity]++;
  }

  return {
    alerts,
    bySeverity,
    affectedUserCount: affectedUsers.size,
    totalUsersEvaluated: userGroups.size,
  };
}
