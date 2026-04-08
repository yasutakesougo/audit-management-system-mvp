import { create } from 'zustand';

/**
 * Common Telemetry Events across the system.
 */
export type CommonTelemetryEvent =
  | 'sp:field_skipped'
  | 'drift:detected'
  | 'remediation:triggered'
  | 'remediation:completed'
  | 'remediation:failed';

export type TelemetryPayload = Record<string, unknown>;

export type TelemetryTransport = (event: string, payload: TelemetryPayload) => void;

interface TelemetryState {
  transport: TelemetryTransport | null;
}

const useTelemetryStore = create<TelemetryState>()(() => ({
  transport: null,
}));

/**
 * Global entry point for operational telemetry.
 * 
 * Used for tracking runtime drifts, failures, and important business signals 
 * that are decoupled from specific UI features.
 */
export const emitTelemetry = (event: CommonTelemetryEvent | string, payload: TelemetryPayload = {}) => {
  const { transport } = useTelemetryStore.getState();
  if (transport) {
    // We cast to string to allow extensibility, but highly recommend using CommonTelemetryEvent
    transport(event, payload);
    return;
  }
  
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.debug(`[telemetry:ops] ${event}`, payload);
  }
};

/**
 * Configure the actual sink for telemetry (e.g. App Insights, Log Analytics, Console)
 */
export const setTelemetryTransport = (next: TelemetryTransport | null) => {
  useTelemetryStore.setState({ transport: next });
};
