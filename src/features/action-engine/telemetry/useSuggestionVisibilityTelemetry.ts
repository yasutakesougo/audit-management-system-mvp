import { useEffect, useRef } from 'react';
import type { ActionSuggestion, ActionSuggestionState } from '../domain/types';
import { isSuggestionVisible } from '../domain/types';
import {
  buildSuggestionTelemetryEvent,
  SUGGESTION_TELEMETRY_EVENTS,
  type SuggestionTelemetrySourceScreen,
} from './buildSuggestionTelemetryEvent';
import { recordSuggestionTelemetry } from './recordSuggestionTelemetry';

export type UseSuggestionVisibilityTelemetryOptions = {
  suggestions: ActionSuggestion[];
  states: Record<string, ActionSuggestionState>;
  sourceScreen: SuggestionTelemetrySourceScreen;
  now: Date;
};

function isResurfacedState(
  state: ActionSuggestionState | undefined,
  now: Date,
): boolean {
  if (!state || state.status !== 'snoozed' || !state.snoozedUntil) return false;
  return new Date(state.snoozedUntil).getTime() <= now.getTime();
}

/**
 * visible 遷移（非表示→表示）を観測し、shown / resurfaced を送信する。
 */
export function useSuggestionVisibilityTelemetry(
  options: UseSuggestionVisibilityTelemetryOptions,
): void {
  const { suggestions, states, sourceScreen, now } = options;
  const prevVisibleRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const nextVisible: Record<string, boolean> = {};

    for (const suggestion of suggestions) {
      const state = states[suggestion.stableId];
      const isVisible = isSuggestionVisible(state, now);
      const wasVisible = prevVisibleRef.current[suggestion.stableId] ?? false;

      nextVisible[suggestion.stableId] = isVisible;

      if (!isVisible || wasVisible) continue;

      const isResurfaced = isResurfacedState(state, now);
      const event = buildSuggestionTelemetryEvent({
        event: isResurfaced
          ? SUGGESTION_TELEMETRY_EVENTS.RESURFACED
          : SUGGESTION_TELEMETRY_EVENTS.SHOWN,
        sourceScreen,
        stableId: suggestion.stableId,
        ruleId: suggestion.ruleId,
        priority: suggestion.priority,
        targetUserId: suggestion.targetUserId,
      });

      const dedupeKey = isResurfaced
        ? `suggestion_resurfaced:${sourceScreen}:${suggestion.stableId}:${state?.snoozedUntil ?? 'none'}`
        : `suggestion_shown:${sourceScreen}:${suggestion.stableId}:visible-session`;

      recordSuggestionTelemetry(event, { dedupeKey });
    }

    prevVisibleRef.current = nextVisible;
  }, [suggestions, states, sourceScreen, now]);
}
