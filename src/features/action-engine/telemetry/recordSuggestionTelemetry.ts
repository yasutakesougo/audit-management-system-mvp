import { db } from '@/infra/firestore/client';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import type { SuggestionTelemetryEvent } from './buildSuggestionTelemetryEvent';

const _dedupeGuard = new Set<string>();

export function _resetSuggestionTelemetryGuard(): void {
  _dedupeGuard.clear();
}

/**
 * Suggestion lifecycle telemetry を Firestore に送信する。
 * dedupeKey 指定時は同一セッションで重複送信を抑制する。
 */
export function recordSuggestionTelemetry(
  event: SuggestionTelemetryEvent,
  options: { dedupeKey?: string } = {},
): void {
  if (options.dedupeKey) {
    if (_dedupeGuard.has(options.dedupeKey)) return;
    _dedupeGuard.add(options.dedupeKey);
  }

  const payload = {
    ...event,
    type: 'suggestion_lifecycle_event' as const,
    ts: serverTimestamp(),
    clientTs: event.timestamp,
  };

  try {
    addDoc(collection(db, 'telemetry'), payload).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[suggestion-telemetry] write failed', err);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[suggestion-telemetry] skipped (db not ready)', err);
  }
}
