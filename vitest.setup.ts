// Vitest global setup: polyfill crypto.randomUUID if absent (Node < 19 environments)
import { webcrypto } from 'crypto';
import '@testing-library/jest-dom/vitest';

if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto as any;
}

if (!globalThis.crypto.randomUUID) {
  // Fallback implementation (NOT cryptographically equivalent, but sufficient for test IDs)
  globalThis.crypto.randomUUID = function() {
    // Simple RFC4122 v4-ish fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 0xf) >> 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  } as any;
}
