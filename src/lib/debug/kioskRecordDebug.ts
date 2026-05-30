import { isDev } from '@/env';

/**
 * Diagnostic log switch for kiosk execution record matching.
 * Gates personal data and matching debug outputs behind explicit development flags or DevTools keys
 * to protect user privacy (PII) and performance in production environments.
 */
export const isKioskRecordDebugEnabled = (): boolean => {
  if (isDev) return true;

  if (typeof window === 'undefined') {
    // Enable logging in local test environments (e.g. Vitest) by checking NODE_ENV
    return typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
  }

  try {
    if (window.localStorage?.getItem('debug:kiosk-records') === '1') {
      return true;
    }
  } catch {
    // Ignore localStorage failures
  }

  try {
    return new URLSearchParams(window.location.search).get('debugRecords') === '1';
  } catch {
    return false;
  }
};
