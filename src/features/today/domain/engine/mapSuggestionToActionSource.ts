// ---------------------------------------------------------------------------
// ActionSuggestion → RawActionSource mapper
//
// Action Engine の出力を Today ActionQueue に流すための変換層。
// Action Engine 側にUI都合を入れず、Today 側で吸収する設計。
// ---------------------------------------------------------------------------

import type { ActionSuggestion, SuggestionPriority } from '../../../action-engine/domain/types';
import type { ActionPriority, RawActionSource } from '../models/queue.types';

/** Action Engine の priority → Today Queue の priority へ変換 */
function toQueuePriority(p: SuggestionPriority): ActionPriority {
  switch (p) {
    case 'P0': return 'P0';
    case 'P1': return 'P1';
    case 'P2': return 'P2';
  }
}

/**
 * ActionSuggestion を RawActionSource に変換する。
 *
 * Today ActionQueue に corrective_action として混ぜ込むための one-way mapper。
 * payload に元の suggestion 全体を保持し、UI レイヤーで CTA.route に遷移可能にする。
 *
 * @example
 * ```ts
 * const sources = suggestions.map(mapSuggestionToActionSource);
 * const queue = buildTodayActionQueue([...existingSources, ...sources], now);
 * ```
 */
export function mapSuggestionToActionSource(
  suggestion: ActionSuggestion,
): RawActionSource {
  return {
    id: `corrective:${suggestion.stableId}`,
    sourceType: 'corrective_action',
    title: suggestion.title,
    // corrective_action は targetTime を持たない（即時対応推奨）
    targetTime: undefined,
    slaMinutes: undefined,
    isCompleted: false,
    assignedStaffId: undefined,
    payload: {
      suggestion,
      queuePriority: toQueuePriority(suggestion.priority),
    },
  };
}
