import { spTelemetryStore } from './spTelemetryStore';

export function dumpSpTelemetryToFile() {
  const data = (window as unknown as { spTelemetryStore?: typeof spTelemetryStore }).spTelemetryStore?.getSnapshot?.()
    ?? spTelemetryStore.getSnapshot();

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'sp-telemetry.json';
  a.click();

  URL.revokeObjectURL(url);
}

// Bind to window for easy access from console
if (typeof window !== 'undefined') {
  (window as unknown as { dumpSpTelemetryToFile: typeof dumpSpTelemetryToFile }).dumpSpTelemetryToFile = dumpSpTelemetryToFile;
}
