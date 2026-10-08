import { getDb, isFirestoreWriteAvailable } from '@/infra/firestore/client';
import { automaticTelemetryWriteGuard } from '@/lib/kioskAutomaticTelemetryBoundary';
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
  const automatic = event.event === 'suggestion_shown' || event.event === 'suggestion_resurfaced' || event.event === 'suggestion_deep_link_arrived';
  const canWrite = automatic ? automaticTelemetryWriteGuard() : () => true;
  if (!canWrite()) return;
  if (!isFirestoreWriteAvailable()) {
    return;
  }

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
    const db = getDb();
    const target = collection(db, 'telemetry');
    if (!canWrite()) return;
    addDoc(target, payload).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[suggestion-telemetry] write failed', err);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[suggestion-telemetry] skipped (db not ready)', err);
  }
}
