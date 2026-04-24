import { create } from 'zustand';


/**
 * Common Telemetry Events across the system.
 */
export type CommonTelemetryEvent =
  | 'sp:field_skipped'
  | 'drift:detected'
  | 'remediation:triggered'
  | 'remediation:completed'
  | 'remediation:failed'
  | 'assignment:concurrency_conflict'
  | 'assignment:conflict_resolved'
  | 'assignment:conflict_unresolved';

export type TelemetryPayload = Record<string, unknown>;

export type TelemetryTransport = (event: string, payload: TelemetryPayload) => void;

interface TelemetryState {
  transport: TelemetryTransport | null;
}

const useTelemetryStore = create<TelemetryState>()(() => ({
  transport: null,
}));

import { spTelemetryStore } from './spTelemetryStore';

/**
 * Global entry point for operational telemetry.
 */
export const emitTelemetry = (event: CommonTelemetryEvent | string, payload: TelemetryPayload = {}) => {
  const { transport } = useTelemetryStore.getState();
  
  if (typeof window !== 'undefined') {
    // Robust E2E diagnostic hook (Persistent log)
    type TelemetryLogEntry = { event: string; payload: TelemetryPayload; timestamp: number };
    const diag = window as Window & {
      __TELEMETRY_LOG__?: TelemetryLogEntry[];
      __LAST_TELEMETRY__?: TelemetryLogEntry;
    };
    const log = diag.__TELEMETRY_LOG__ ?? [];
    log.push({ event, payload, timestamp: Date.now() });
    diag.__TELEMETRY_LOG__ = log;
    diag.__LAST_TELEMETRY__ = { event, payload, timestamp: Date.now() };

    window.dispatchEvent(new CustomEvent('app:telemetry', {
      detail: { event, payload, timestamp: new Date().toISOString() } 
    }));

    // [Operational OS Bridge] Bridge significant app events to SP telemetry for Nightly Patrol aggregation
    if (event === 'assignment:concurrency_conflict') {
      spTelemetryStore.record({
        type: 'config_warning',
        scope: 'TransportAssignment',
        code: 'CONCURRENCY_CONFLICT',
        message: Array.isArray(payload.vehicles) ? payload.vehicles.join(', ') : String(payload.vehicles || ''),
        count: Number(payload.conflictCount || 1),
      });
    }

    if (event === 'assignment:conflict_resolved') {
      spTelemetryStore.record({
        type: 'config_warning',
        scope: 'TransportAssignment',
        code: 'CONFLICT_RESOLVED',
        message: String(payload.reason ?? payload.itemId ?? ''),
        itemId: String(payload.itemId ?? ''),
        reason: String(payload.reason ?? ''),
        count: Number(payload.retryCount ?? 1),
      });
    }

    if (event === 'assignment:conflict_unresolved') {
      spTelemetryStore.record({
        type: 'config_warning',
        scope: 'TransportAssignment',
        code: 'CONFLICT_UNRESOLVED',
        message: String(payload.reason ?? payload.itemId ?? ''),
        itemId: String(payload.itemId ?? ''),
        reason: String(payload.reason ?? ''),
        count: Number(payload.retryCount ?? 1),
      });
    }
  }

  if (transport) {
    transport(event, payload);
    return;
  }
  
  // eslint-disable-next-line no-console
  console.debug(`[telemetry:ops] ${event}`, payload);
};

/**
 * Configure the actual sink for telemetry (e.g. App Insights, Log Analytics, Console)
 */
export const setTelemetryTransport = (next: TelemetryTransport | null) => {
  useTelemetryStore.setState({ transport: next });
};
