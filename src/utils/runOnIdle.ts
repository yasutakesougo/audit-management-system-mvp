import { cancelIdle as cancelIdleInternal, scheduleIdle } from '@/prefetch/util';

export type RunOnIdleHandle = ReturnType<typeof scheduleIdle>;

export const runOnIdle = (callback: () => void, timeout?: number): RunOnIdleHandle =>
  scheduleIdle(callback, typeof timeout === 'number' ? { timeout } : undefined);

export const cancelIdle = (handle: RunOnIdleHandle): void => {
  cancelIdleInternal(handle);
};
