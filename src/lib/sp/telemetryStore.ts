import { create } from 'zustand';
import { SpTelemetryMetrics } from './telemetry';

type TelemetryStore = {
  entries: SpTelemetryMetrics[];
  addEntry: (metrics: SpTelemetryMetrics) => void;
  clearEntries: () => void;
};

const MAX_ENTRIES = 50;

export const useTelemetryStore = create<TelemetryStore>((set) => ({
  entries: [],
  addEntry: (metrics) =>
    set((state) => {
      const newEntries = [metrics, ...state.entries];
      if (newEntries.length > MAX_ENTRIES) {
        newEntries.pop(); // Remove the oldest
      }
      return { entries: newEntries };
    }),
  clearEntries: () => set({ entries: [] }),
}));
