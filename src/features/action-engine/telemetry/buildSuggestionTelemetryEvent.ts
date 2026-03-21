import type { SnoozePreset } from '../domain/computeSnoozeUntil';
import type { SuggestionPriority } from '../domain/types';

export const SUGGESTION_TELEMETRY_EVENTS = {
  SHOWN: 'suggestion_shown',
  CTA_CLICKED: 'suggestion_cta_clicked',
  DISMISSED: 'suggestion_dismissed',
  SNOOZED: 'suggestion_snoozed',
  RESURFACED: 'suggestion_resurfaced',
} as const;

export type SuggestionTelemetryEventName =
  (typeof SUGGESTION_TELEMETRY_EVENTS)[keyof typeof SUGGESTION_TELEMETRY_EVENTS];

export type SuggestionTelemetrySourceScreen = 'today' | 'exception-center';

export type BuildSuggestionTelemetryEventInput = {
  event: SuggestionTelemetryEventName;
  sourceScreen: SuggestionTelemetrySourceScreen;
  stableId: string;
  ruleId: string;
  priority: SuggestionPriority;
  targetUserId?: string;
  targetUrl?: string;
  snoozePreset?: SnoozePreset;
  snoozedUntil?: string;
  timestamp?: string;
};

export type SuggestionTelemetryEvent = {
  event: SuggestionTelemetryEventName;
  sourceScreen: SuggestionTelemetrySourceScreen;
  stableId: string;
  ruleId: string;
  priority: SuggestionPriority;
  timestamp: string;
  targetUserId?: string;
  targetUrl?: string;
  snoozePreset?: SnoozePreset;
  snoozedUntil?: string;
};

/**
 * Suggestion lifecycle telemetry の payload builder。
 * 画面層は event ごとの差分を意識せず、この builder に入力を渡すだけでよい。
 */
export function buildSuggestionTelemetryEvent(
  input: BuildSuggestionTelemetryEventInput,
): SuggestionTelemetryEvent {
  return {
    event: input.event,
    sourceScreen: input.sourceScreen,
    stableId: input.stableId,
    ruleId: input.ruleId,
    priority: input.priority,
    timestamp: input.timestamp ?? new Date().toISOString(),
    ...(input.targetUserId ? { targetUserId: input.targetUserId } : {}),
    ...(input.targetUrl ? { targetUrl: input.targetUrl } : {}),
    ...(input.snoozePreset ? { snoozePreset: input.snoozePreset } : {}),
    ...(input.snoozedUntil ? { snoozedUntil: input.snoozedUntil } : {}),
  };
}
