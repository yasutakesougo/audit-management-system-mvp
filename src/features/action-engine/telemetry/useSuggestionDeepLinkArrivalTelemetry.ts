import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  buildSuggestionTelemetryEvent,
  SUGGESTION_TELEMETRY_EVENTS,
} from './buildSuggestionTelemetryEvent';
import { recordSuggestionTelemetry } from './recordSuggestionTelemetry';
import { takeMatchingPendingSuggestionDeepLink } from './suggestionDeepLinkTracker';

/**
 * ExceptionCenter CTA で遷移した deep link 到達を route change で検知し、
 * suggestion_deep_link_arrived telemetry を1回だけ送信する。
 */
export function useSuggestionDeepLinkArrivalTelemetry(): void {
  const location = useLocation();

  useEffect(() => {
    const pending = takeMatchingPendingSuggestionDeepLink(
      location.pathname,
      location.search,
    );
    if (!pending) return;

    recordSuggestionTelemetry(
      buildSuggestionTelemetryEvent({
        event: SUGGESTION_TELEMETRY_EVENTS.DEEP_LINK_ARRIVED,
        sourceScreen: pending.sourceScreen,
        stableId: pending.stableId,
        ruleId: pending.ruleId,
        priority: pending.priority,
        targetUserId: pending.targetUserId,
        targetUrl: pending.targetUrl,
        ctaSurface: pending.ctaSurface,
      }),
      {
        dedupeKey: [
          'suggestion_deep_link_arrived',
          pending.sourceScreen,
          pending.stableId,
          pending.targetPathWithSearch,
          pending.ctaSurface ?? 'table',
        ].join(':'),
      },
    );
  }, [location.pathname, location.search]);
}

