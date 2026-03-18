import { beforeEach, describe, expect, it } from 'vitest';
import type { TodayQueueTelemetrySample } from './todayQueueTelemetry.types';
import {
  MAX_TELEMETRY_SAMPLES,
  selectLatestTodayQueueSample,
  useTodayQueueTelemetryStore,
} from './todayQueueTelemetryStore';

describe('todayQueueTelemetryStore', () => {
  const dummySample: TodayQueueTelemetrySample = {
    timestamp: 1000,
    queueSize: 1,
    p0Count: 0,
    p1Count: 0,
    p2Count: 0,
    p3Count: 0,
    overdueCount: 0,
    requiresAttentionCount: 0,
  };

  beforeEach(() => {
    // Reset state before each test to ensure tests are isolated
    useTodayQueueTelemetryStore.setState({ samples: [] });
  });

  it('starts with empty samples', () => {
    const state = useTodayQueueTelemetryStore.getState();
    expect(state.samples).toEqual([]);
    expect(selectLatestTodayQueueSample(state)).toBeUndefined();
  });

  it('can push a sample', () => {
    const store = useTodayQueueTelemetryStore.getState();
    store.pushSample(dummySample);

    const newState = useTodayQueueTelemetryStore.getState();
    expect(newState.samples).toHaveLength(1);
    expect(newState.samples[0]).toEqual(dummySample);
  });

  it('can clear samples', () => {
    const store = useTodayQueueTelemetryStore.getState();
    store.pushSample(dummySample);

    // Act
    useTodayQueueTelemetryStore.getState().clearSamples();

    // Assert
    const clearedState = useTodayQueueTelemetryStore.getState();
    expect(clearedState.samples).toEqual([]);
    expect(selectLatestTodayQueueSample(clearedState)).toBeUndefined();
  });

  it('retrieves the last pushed sample using selectLatestTodayQueueSample', () => {
    const store = useTodayQueueTelemetryStore.getState();
    const sample1 = { ...dummySample, timestamp: 1000 };
    const sample2 = { ...dummySample, timestamp: 2000 };

    store.pushSample(sample1);
    store.pushSample(sample2);

    const latest = selectLatestTodayQueueSample(
      useTodayQueueTelemetryStore.getState()
    );
    expect(latest).toEqual(sample2);
  });

  it(`truncates to exactly MAX_TELEMETRY_SAMPLES (${MAX_TELEMETRY_SAMPLES}) and drops the oldest`, () => {
    const store = useTodayQueueTelemetryStore.getState();

    // Push MAX_TELEMETRY_SAMPLES + 5 items
    const overage = 5;
    for (let i = 0; i < MAX_TELEMETRY_SAMPLES + overage; i++) {
      store.pushSample({ ...dummySample, timestamp: i });
    }

    const newState = useTodayQueueTelemetryStore.getState();
    
    // Total should not exceed max
    expect(newState.samples).toHaveLength(MAX_TELEMETRY_SAMPLES);

    // Oldest 5 items should have been dropped.
    // Index 0 shouldn't be timestamp 0, it should be overage
    expect(newState.samples[0].timestamp).toBe(overage);

    // The newest should be our last push operation
    const latest = selectLatestTodayQueueSample(newState);
    expect(latest?.timestamp).toBe(MAX_TELEMETRY_SAMPLES + overage - 1);
  });
});
