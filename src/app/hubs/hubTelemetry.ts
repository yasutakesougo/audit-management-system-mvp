import { getDb, isFirestoreWriteAvailable } from '@/infra/firestore/client';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

export const HUB_TELEMETRY_EVENTS = {
  HUB_VIEWED: 'hub_viewed',
  CARD_VIEWED: 'hub_card_viewed',
  CARD_CLICKED: 'hub_card_clicked',
  HELP_LINK_CLICKED: 'hub_help_link_clicked',
  EMPTY_STATE_CTA_CLICKED: 'hub_empty_state_cta_clicked',
} as const;

export type HubTelemetryEventName =
  (typeof HUB_TELEMETRY_EVENTS)[keyof typeof HUB_TELEMETRY_EVENTS];

export type HubTelemetrySection = 'primary' | 'secondary' | 'comingSoon' | 'emptyState' | 'hub';

export type HubTelemetryEvent = {
  eventName: HubTelemetryEventName;
  hubId: string;
  role: string;
  telemetryName: string;
  pathname?: string;
  search?: string;
  entryId?: string;
  section?: HubTelemetrySection;
  position?: number;
  targetUrl?: string;
  helpLink?: string;
  visibleEntryCount?: number;
};

/**
 * Fire-and-forget telemetry for hub entry experience.
 * Failure is intentionally swallowed to avoid blocking navigation or rendering.
 */
export function recordHubTelemetry(event: HubTelemetryEvent): void {
  if (!isFirestoreWriteAvailable()) {
    return;
  }

  const payload = {
    ...event,
    type: 'hub_entry_telemetry' as const,
    ts: serverTimestamp(),
    clientTs: new Date().toISOString(),
  };

  try {
    addDoc(collection(getDb(), 'telemetry'), payload).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[hub:telemetry] write failed', err);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[hub:telemetry] skipped (db not ready)', err);
  }
}

