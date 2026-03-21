/**
 * mapSuggestionToException — Action Engine → ExceptionCenter ゲートウェイ
 *
 * ActionSuggestion を ExceptionItem に変換する唯一の接点。
 * ExceptionCenter に Action Engine 提案を流す際は必ずこの mapper を通す。
 */

import type { ActionSuggestion, SuggestionPriority } from '@/features/action-engine/domain/types';
import { summarizeEvidence } from '@/features/action-engine/domain/summarizeEvidence';
import type { ExceptionItem, ExceptionSeverity } from './exceptionLogic';

// ─── Priority → Severity 変換 ────────────────────────────────

/**
 * | Action Engine | ExceptionCenter | 温度感ラベル |
 * |---|---|---|
 * | P0 | critical | 即対応推奨 |
 * | P1 | high     | 今週見直し |
 * | P2 | medium   | 観察継続   |
 */
const PRIORITY_TO_SEVERITY: Record<SuggestionPriority, ExceptionSeverity> = {
  P0: 'critical',
  P1: 'high',
  P2: 'medium',
};

// ─── 温度感ラベル ─────────────────────────────────────────────

/**
 * corrective-action カテゴリ専用の運用ラベル。
 * ExceptionTable の severity Chip 表示で使用する。
 */
export const TEMPERATURE_LABELS: Record<SuggestionPriority, string> = {
  P0: '即対応推奨',
  P1: '今週見直し',
  P2: '観察継続',
};

/**
 * ExceptionSeverity → SuggestionPriority の逆引き（温度感ラベル表示用）
 */
export function severityToPriority(severity: ExceptionSeverity): SuggestionPriority | null {
  const map: Partial<Record<ExceptionSeverity, SuggestionPriority>> = {
    critical: 'P0',
    high: 'P1',
    medium: 'P2',
  };
  return map[severity] ?? null;
}

// ─── Mapper ───────────────────────────────────────────────────

/**
 * ActionSuggestion を ExceptionItem に変換する。
 *
 * id には `ae:` プレフィックスを付与して既存 ExceptionItem と衝突を回避。
 * stableId を保持して dismiss/snooze の追跡に使えるようにする。
 */
export function mapSuggestionToException(
  suggestion: ActionSuggestion,
): ExceptionItem {
  return {
    id: `ae:${suggestion.stableId}`,
    category: 'corrective-action',
    severity: PRIORITY_TO_SEVERITY[suggestion.priority],
    title: suggestion.title,
    description: summarizeEvidence(suggestion.evidence),
    targetUserId: suggestion.targetUserId,
    targetDate: suggestion.createdAt.split('T')[0],
    updatedAt: suggestion.createdAt,
    actionLabel: suggestion.cta.label,
    actionPath: suggestion.cta.route,
    stableId: suggestion.stableId,
  };
}
