import { create } from 'zustand';
import type { TodayQueueTelemetrySample } from './todayQueueTelemetry.types';

export const MAX_TELEMETRY_SAMPLES = 100;

export interface TodayQueueTelemetryState {
  samples: TodayQueueTelemetrySample[];
  pushSample: (sample: TodayQueueTelemetrySample) => void;
  clearSamples: () => void;
}

export const useTodayQueueTelemetryStore = create<TodayQueueTelemetryState>((set) => ({
  samples: [],

  pushSample: (sample) =>
    set((state) => {
      const next = [...state.samples, sample];
      return {
        samples:
          next.length > MAX_TELEMETRY_SAMPLES
            ? next.slice(next.length - MAX_TELEMETRY_SAMPLES)
            : next,
      };
    }),

  clearSamples: () => set({ samples: [] }),
}));

// Selectors
export function selectLatestTodayQueueSample(
  state: TodayQueueTelemetryState
): TodayQueueTelemetrySample | undefined {
  return state.samples[state.samples.length - 1];
}
