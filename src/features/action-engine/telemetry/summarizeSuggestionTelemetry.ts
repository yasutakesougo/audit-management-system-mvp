import type { SuggestionPriority } from '../domain/types';
import {
  SUGGESTION_TELEMETRY_EVENTS,
  type SuggestionTelemetryEventName,
  type SuggestionTelemetrySourceScreen,
} from './buildSuggestionTelemetryEvent';

const DEFAULT_WINDOW_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const SCREEN_ORDER: SuggestionTelemetrySourceScreen[] = ['today', 'exception-center'];
const PRIORITY_ORDER: SuggestionPriority[] = ['P0', 'P1', 'P2'];

const EVENT_SET = new Set<string>(Object.values(SUGGESTION_TELEMETRY_EVENTS));

export type SuggestionTelemetryRecord = {
  event: SuggestionTelemetryEventName | string;
  sourceScreen: SuggestionTelemetrySourceScreen | string;
  stableId: string;
  ruleId: string;
  priority: SuggestionPriority | string;
  timestamp: string;
};

export type SuggestionTelemetryWindow = {
  from?: Date;
  to?: Date;
  now?: Date;
};

export type SuggestionTelemetryCounts = {
  shown: number;
  clicked: number;
  dismissed: number;
  snoozed: number;
  resurfaced: number;
};

export type SuggestionTelemetryRates = {
  cta: number;
  dismiss: number;
  snooze: number;
  resurfaced: number;
  noResponse: number;
};

export type SuggestionTelemetrySummary = SuggestionTelemetryCounts & {
  rates: SuggestionTelemetryRates;
  window: {
    from: string;
    to: string;
  };
};

export type SuggestionTelemetryByRule = SuggestionTelemetryCounts & {
  ruleId: string;
  rates: SuggestionTelemetryRates;
};

export type SuggestionTelemetryByScreen = SuggestionTelemetryCounts & {
  sourceScreen: SuggestionTelemetrySourceScreen;
  rates: SuggestionTelemetryRates;
};

export type SuggestionTelemetryByPriority = SuggestionTelemetryCounts & {
  priority: SuggestionPriority;
  rates: SuggestionTelemetryRates;
};

type PreparedSuggestionTelemetryEvent = {
  event: SuggestionTelemetryEventName;
  sourceScreen: SuggestionTelemetrySourceScreen;
  stableId: string;
  ruleId: string;
  priority: SuggestionPriority;
};

type ResolvedWindow = {
  from: Date;
  to: Date;
};

function createEmptyCounts(): SuggestionTelemetryCounts {
  return {
    shown: 0,
    clicked: 0,
    dismissed: 0,
    snoozed: 0,
    resurfaced: 0,
  };
}

function safeRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

function computeRates(counts: SuggestionTelemetryCounts): SuggestionTelemetryRates {
  const noResponseCount = Math.max(
    counts.shown - counts.clicked - counts.dismissed - counts.snoozed,
    0,
  );

  return {
    cta: safeRate(counts.clicked, counts.shown),
    dismiss: safeRate(counts.dismissed, counts.shown),
    snooze: safeRate(counts.snoozed, counts.shown),
    resurfaced: safeRate(counts.resurfaced, counts.snoozed),
    noResponse: safeRate(noResponseCount, counts.shown),
  };
}

function isKnownEvent(event: string): event is SuggestionTelemetryEventName {
  return EVENT_SET.has(event);
}

function isKnownSourceScreen(
  sourceScreen: string,
): sourceScreen is SuggestionTelemetrySourceScreen {
  return sourceScreen === 'today' || sourceScreen === 'exception-center';
}

function isKnownPriority(priority: string): priority is SuggestionPriority {
  return priority === 'P0' || priority === 'P1' || priority === 'P2';
}

function normalizeRuleId(ruleId: string): string {
  const normalized = ruleId
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-');
  return normalized || 'unknown-rule';
}

function resolveWindow(window?: SuggestionTelemetryWindow): ResolvedWindow {
  const to = window?.to ?? window?.now ?? new Date();
  const from =
    window?.from ?? new Date(to.getTime() - DEFAULT_WINDOW_DAYS * MS_PER_DAY);

  if (from.getTime() <= to.getTime()) {
    return { from, to };
  }

  return { from: to, to: from };
}

function isWithinWindow(timestamp: string, window: ResolvedWindow): boolean {
  const ts = new Date(timestamp).getTime();
  if (Number.isNaN(ts)) return false;
  return ts >= window.from.getTime() && ts <= window.to.getTime();
}

function prepareSuggestionTelemetryEvents(
  events: SuggestionTelemetryRecord[],
  window?: SuggestionTelemetryWindow,
): { prepared: PreparedSuggestionTelemetryEvent[]; resolvedWindow: ResolvedWindow } {
  const resolvedWindow = resolveWindow(window);
  const prepared: PreparedSuggestionTelemetryEvent[] = [];
  const shownDedupe = new Set<string>();

  for (const event of events) {
    if (!event.stableId) continue;
    if (!isKnownEvent(event.event)) continue;
    if (!isKnownSourceScreen(event.sourceScreen)) continue;
    if (!isKnownPriority(event.priority)) continue;
    if (!isWithinWindow(event.timestamp, resolvedWindow)) continue;

    if (event.event === SUGGESTION_TELEMETRY_EVENTS.SHOWN) {
      const dedupeKey = `${event.stableId}:${event.sourceScreen}`;
      if (shownDedupe.has(dedupeKey)) continue;
      shownDedupe.add(dedupeKey);
    }

    prepared.push({
      event: event.event,
      sourceScreen: event.sourceScreen,
      stableId: event.stableId,
      ruleId: normalizeRuleId(event.ruleId),
      priority: event.priority,
    });
  }

  return { prepared, resolvedWindow };
}

function accumulateCounts(
  counts: SuggestionTelemetryCounts,
  eventName: SuggestionTelemetryEventName,
): void {
  if (eventName === SUGGESTION_TELEMETRY_EVENTS.SHOWN) {
    counts.shown += 1;
    return;
  }
  if (eventName === SUGGESTION_TELEMETRY_EVENTS.CTA_CLICKED) {
    counts.clicked += 1;
    return;
  }
  if (eventName === SUGGESTION_TELEMETRY_EVENTS.DISMISSED) {
    counts.dismissed += 1;
    return;
  }
  if (eventName === SUGGESTION_TELEMETRY_EVENTS.SNOOZED) {
    counts.snoozed += 1;
    return;
  }
  if (eventName === SUGGESTION_TELEMETRY_EVENTS.RESURFACED) {
    counts.resurfaced += 1;
  }
}

function toSummaryCounts(
  counts: SuggestionTelemetryCounts,
): SuggestionTelemetryCounts & { rates: SuggestionTelemetryRates } {
  return {
    ...counts,
    rates: computeRates(counts),
  };
}

/**
 * suggestion lifecycle telemetry を集計する。
 * デフォルトは直近7日 window。
 */
export function summarizeSuggestionTelemetry(
  events: SuggestionTelemetryRecord[],
  window?: SuggestionTelemetryWindow,
): SuggestionTelemetrySummary {
  const { prepared, resolvedWindow } = prepareSuggestionTelemetryEvents(events, window);
  const counts = createEmptyCounts();

  for (const event of prepared) {
    accumulateCounts(counts, event.event);
  }

  return {
    ...toSummaryCounts(counts),
    window: {
      from: resolvedWindow.from.toISOString(),
      to: resolvedWindow.to.toISOString(),
    },
  };
}

/** ruleId ごとの lifecycle 集計（shown 降順） */
export function groupSuggestionTelemetryByRule(
  events: SuggestionTelemetryRecord[],
  window?: SuggestionTelemetryWindow,
): SuggestionTelemetryByRule[] {
  const { prepared } = prepareSuggestionTelemetryEvents(events, window);
  const grouped = new Map<string, SuggestionTelemetryCounts>();

  for (const event of prepared) {
    const counts = grouped.get(event.ruleId) ?? createEmptyCounts();
    accumulateCounts(counts, event.event);
    grouped.set(event.ruleId, counts);
  }

  return Array.from(grouped.entries())
    .map(([ruleId, counts]) => ({
      ruleId,
      ...toSummaryCounts(counts),
    }))
    .sort((a, b) => {
      if (b.shown !== a.shown) return b.shown - a.shown;
      return a.ruleId.localeCompare(b.ruleId);
    });
}

/** sourceScreen ごとの lifecycle 集計 */
export function groupSuggestionTelemetryByScreen(
  events: SuggestionTelemetryRecord[],
  window?: SuggestionTelemetryWindow,
): SuggestionTelemetryByScreen[] {
  const { prepared } = prepareSuggestionTelemetryEvents(events, window);
  const grouped = new Map<SuggestionTelemetrySourceScreen, SuggestionTelemetryCounts>();

  for (const sourceScreen of SCREEN_ORDER) {
    grouped.set(sourceScreen, createEmptyCounts());
  }

  for (const event of prepared) {
    const counts = grouped.get(event.sourceScreen) ?? createEmptyCounts();
    accumulateCounts(counts, event.event);
    grouped.set(event.sourceScreen, counts);
  }

  return SCREEN_ORDER.map((sourceScreen) => {
    const counts = grouped.get(sourceScreen) ?? createEmptyCounts();
    return {
      sourceScreen,
      ...toSummaryCounts(counts),
    };
  });
}

/** priority ごとの lifecycle 集計 */
export function groupSuggestionTelemetryByPriority(
  events: SuggestionTelemetryRecord[],
  window?: SuggestionTelemetryWindow,
): SuggestionTelemetryByPriority[] {
  const { prepared } = prepareSuggestionTelemetryEvents(events, window);
  const grouped = new Map<SuggestionPriority, SuggestionTelemetryCounts>();

  for (const priority of PRIORITY_ORDER) {
    grouped.set(priority, createEmptyCounts());
  }

  for (const event of prepared) {
    const counts = grouped.get(event.priority) ?? createEmptyCounts();
    accumulateCounts(counts, event.event);
    grouped.set(event.priority, counts);
  }

  return PRIORITY_ORDER.map((priority) => {
    const counts = grouped.get(priority) ?? createEmptyCounts();
    return {
      priority,
      ...toSummaryCounts(counts),
    };
  });
}
