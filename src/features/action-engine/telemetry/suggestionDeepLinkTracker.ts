import type { SuggestionPriority } from '../domain/types';
import {
  SUGGESTION_TELEMETRY_EVENTS,
  type SuggestionTelemetryCtaSurface,
  type SuggestionTelemetryEvent,
  type SuggestionTelemetrySourceScreen,
} from './buildSuggestionTelemetryEvent';

const PENDING_DEEP_LINK_STORAGE_KEY = 'suggestion-deep-link-pending-v1';
const PENDING_DEEP_LINK_TTL_MS = 10 * 60 * 1000;

export type PendingSuggestionDeepLink = {
  sourceScreen: SuggestionTelemetrySourceScreen;
  stableId: string;
  ruleId: string;
  priority: SuggestionPriority;
  targetUserId?: string;
  targetUrl: string;
  targetPathWithSearch: string;
  ctaSurface?: SuggestionTelemetryCtaSurface;
  clickedAt: string;
  expiresAtMs: number;
};

function isStorageAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.sessionStorage !== 'undefined'
  );
}

function normalizePathWithSearch(rawUrl: string): string | null {
  if (!rawUrl) return null;

  try {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://example.invalid';
    const parsed = new URL(rawUrl, origin);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

function readPendingFromStorage(): PendingSuggestionDeepLink | null {
  if (!isStorageAvailable()) return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_DEEP_LINK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingSuggestionDeepLink;
    if (
      typeof parsed?.sourceScreen !== 'string' ||
      typeof parsed?.stableId !== 'string' ||
      typeof parsed?.ruleId !== 'string' ||
      typeof parsed?.priority !== 'string' ||
      typeof parsed?.targetUrl !== 'string' ||
      typeof parsed?.targetPathWithSearch !== 'string' ||
      typeof parsed?.clickedAt !== 'string' ||
      typeof parsed?.expiresAtMs !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingSuggestionDeepLink(): void {
  if (!isStorageAvailable()) return;
  try {
    window.sessionStorage.removeItem(PENDING_DEEP_LINK_STORAGE_KEY);
  } catch {
    // noop
  }
}

export function queuePendingSuggestionDeepLink(
  event: SuggestionTelemetryEvent,
): void {
  if (!isStorageAvailable()) return;
  if (event.event !== SUGGESTION_TELEMETRY_EVENTS.CTA_CLICKED) return;
  if (!event.targetUrl) return;

  const targetPathWithSearch = normalizePathWithSearch(event.targetUrl);
  if (!targetPathWithSearch) return;

  const pending: PendingSuggestionDeepLink = {
    sourceScreen: event.sourceScreen,
    stableId: event.stableId,
    ruleId: event.ruleId,
    priority: event.priority,
    targetUserId: event.targetUserId,
    targetUrl: event.targetUrl,
    targetPathWithSearch,
    ctaSurface: event.ctaSurface,
    clickedAt: event.timestamp,
    expiresAtMs: Date.now() + PENDING_DEEP_LINK_TTL_MS,
  };

  try {
    window.sessionStorage.setItem(
      PENDING_DEEP_LINK_STORAGE_KEY,
      JSON.stringify(pending),
    );
  } catch {
    // noop
  }
}

export function takeMatchingPendingSuggestionDeepLink(
  pathname: string,
  search: string,
): PendingSuggestionDeepLink | null {
  const pending = readPendingFromStorage();
  if (!pending) return null;

  if (pending.expiresAtMs <= Date.now()) {
    clearPendingSuggestionDeepLink();
    return null;
  }

  const currentPathWithSearch = `${pathname}${search}`;
  if (currentPathWithSearch !== pending.targetPathWithSearch) {
    return null;
  }

  clearPendingSuggestionDeepLink();
  return pending;
}

