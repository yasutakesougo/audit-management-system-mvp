/**
 * 国保連プリバリデーション — ルールカタログ
 *
 * ルールIDとメッセージを辞書で管理。
 * 追加＝ここに1行足すだけ。validate関数側のロジックと1:1対応。
 */
import type { ValidationLevel } from './types';

export interface RuleDef {
  id: string;
  level: ValidationLevel;
  label: string;
  description: string;
}

/**
 * ルールカタログ — KOKU-71-xxx 体系
 *
 * KOKU = 国保連
 * 71   = 様式71（サービス提供実績記録票）
 * xxx  = 連番
 */
export const RULE_CATALOG = {
  // ─── BLOCK（出力不可） ──────────────────────────────
  'KOKU-71-001': {
    id: 'KOKU-71-001',
    level: 'BLOCK' as const,
    label: '受給者証番号未登録',
    description: '受給者証番号が登録されていないため国保連CSVに出力できません',
  },
  'KOKU-71-002': {
    id: 'KOKU-71-002',
    level: 'BLOCK' as const,
    label: '提供時刻不完全',
    description: 'ステータスが「提供」ですが開始時刻または終了時刻が入力されていません',
  },
  'KOKU-71-003': {
    id: 'KOKU-71-003',
    level: 'BLOCK' as const,
    label: '開始≧終了',
    description: '開始時刻が終了時刻以降になっています',
  },
  'KOKU-71-004': {
    id: 'KOKU-71-004',
    level: 'BLOCK' as const,
    label: '非提供レコードに時間/加算',
    description: '「提供」以外のステータスに時間や加算が設定されています',
  },
  'KOKU-71-005': {
    id: 'KOKU-71-005',
    level: 'BLOCK' as const,
    label: '算定時間コード算出不能',
    description: '滞在時間から算定時間コードを算出できません',
  },

  // ─── WARNING（確認後出力可） ────────────────────────
  'KOKU-71-101': {
    id: 'KOKU-71-101',
    level: 'WARNING' as const,
    label: '送迎ありだが時間未入力',
    description: '送迎ありですが開始/終了時刻が入力されていません（運用確認）',
  },
  'KOKU-71-102': {
    id: 'KOKU-71-102',
    level: 'WARNING' as const,
    label: '滞在時間が極端',
    description: '滞在時間が短すぎ（30分未満）または長すぎ（12時間超）です',
  },
  'KOKU-71-103': {
    id: 'KOKU-71-103',
    level: 'WARNING' as const,
    label: '欠席時対応の月間回数上限',
    description: '欠席時対応の月間回数が上限を超えています',
  },
} as const satisfies Record<string, RuleDef>;

export type RuleId = keyof typeof RULE_CATALOG;

/** ルールIDからルール定義を取得 */
export function getRule(ruleId: RuleId): RuleDef {
  return RULE_CATALOG[ruleId];
}

/** ルールIDからメッセージを取得 */
export function getRuleMessage(ruleId: RuleId): string {
  return RULE_CATALOG[ruleId].description;
}

/** 欠席時対応の月間上限回数（設定化可能） */
export const ABSENT_SUPPORT_MONTHLY_LIMIT = 4;
