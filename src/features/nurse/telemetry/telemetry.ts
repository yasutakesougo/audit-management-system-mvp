export type NurseTelemetryEvent =
  | 'nurse_queue_flushed_total'
  | 'nurse_queue_failed_total'
  | 'nurse_seizure_saved_total';

export type TelemetryPayload = Record<string, unknown>;

export type TelemetryTransport = (event: NurseTelemetryEvent, payload: TelemetryPayload) => void;

let transport: TelemetryTransport | null = null;

export const setTelemetryTransport = (next: TelemetryTransport | null) => {
  transport = next;
};

export const emitTelemetry = (event: NurseTelemetryEvent, payload: TelemetryPayload = {}) => {
  if (transport) {
    transport(event, payload);
    return;
  }
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.debug(`[telemetry:nurse] ${event}`, payload);
  }
};
