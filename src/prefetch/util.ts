type IdleOptions = {
  timeout?: number;
};

type IdleHandle = number | NodeJS.Timeout;

type IdleCallback = () => void;

const fallbackSchedule = (callback: IdleCallback, options?: IdleOptions): IdleHandle => {
  const timeout = options?.timeout ?? 1_000;
  return window.setTimeout(callback, timeout);
};

const fallbackCancel = (handle: IdleHandle): void => {
  window.clearTimeout(handle);
};

export const scheduleIdle = (callback: IdleCallback, options?: IdleOptions): IdleHandle => {
  if (typeof window !== 'undefined') {
    const candidate = window as Window & {
      requestIdleCallback?: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number;
    };
    if (typeof candidate.requestIdleCallback === 'function') {
      return candidate.requestIdleCallback(() => callback(), options);
    }
  }
  if (typeof window !== 'undefined') {
    return fallbackSchedule(callback, options);
  }
  // SSR / tests
  return setTimeout(callback, options?.timeout ?? 1_000);
};

export const cancelIdle = (handle: IdleHandle): void => {
  if (typeof window !== 'undefined') {
    const candidate = window as Window & {
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof candidate.cancelIdleCallback === 'function') {
      candidate.cancelIdleCallback(Number(handle));
      return;
    }
  }
  if (typeof window !== 'undefined') {
    fallbackCancel(handle as number);
    return;
  }
  clearTimeout(handle as NodeJS.Timeout);
};
