import { getApps, initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

import { get, getFlag, getNumber } from '@/env';

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
};

const readFirebaseConfig = (): FirebaseConfig => ({
  apiKey: get('VITE_FIREBASE_API_KEY'),
  authDomain: get('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: get('VITE_FIREBASE_PROJECT_ID'),
  appId: get('VITE_FIREBASE_APP_ID'),
});

const hasConfiguredApiKey = (apiKey: string | undefined): boolean =>
  !!apiKey && apiKey !== 'undefined' && apiKey !== 'null';

/**
 * Creates a no-op Firestore proxy for E2E tests.
 * This prevents runtime failures when Firebase operations are called
 * without a valid Firebase configuration.
 */
function createNoopFirestore(): Firestore {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === 'type') return 'firestore';
      if (prop === 'app') return null;
      if (prop === 'toJSON') return () => ({ noop: true });
      return (...args: unknown[]) => {
        if (getFlag('DEV', false)) {
          console.warn(`[firebase-noop] ${String(prop)} called with`, args);
        }
        return createNoopFirestore();
      };
    },
  };
  return new Proxy({}, handler) as unknown as Firestore;
}

/**
 * Creates a stub Firebase app for E2E/tests.
 */
function createNoopFirebaseApp(config: FirebaseConfig) {
  return {
    name: '[DEFAULT]',
    options: config,
    automaticDataCollectionEnabled: false,
  };
}

export function isFirestoreWriteAvailable(): boolean {
  const isE2E = getFlag('VITE_E2E', false);
  if (isE2E) return false;
  const config = readFirebaseConfig();
  return hasConfiguredApiKey(config.apiKey);
}

export function getFirebaseApp() {
  const isE2E = getFlag('VITE_E2E', false);
  const config = readFirebaseConfig();

  if (isE2E) {
    console.log('[firebase] disabled:', { VITE_E2E: true });
    return createNoopFirebaseApp(config);
  }

  if (!hasConfiguredApiKey(config.apiKey)) {
    if (getFlag('DEV', false)) {
      console.info('[firebase] ⏭️ skipped: VITE_FIREBASE_API_KEY is not configured');
    }
    return createNoopFirebaseApp(config);
  }

  const apps = getApps();
  return apps.length ? apps[0]! : initializeApp(config);
}

let cachedDb: { key: string; value: Firestore } | null = null;

const buildDbCacheKey = (): string => {
  const isE2E = getFlag('VITE_E2E', false);
  const useEmulator = getFlag('VITE_FIRESTORE_USE_EMULATOR', false);
  const host = get('VITE_FIRESTORE_EMULATOR_HOST', '127.0.0.1');
  const port = getNumber('VITE_FIRESTORE_EMULATOR_PORT', 8080);
  const config = readFirebaseConfig();
  return [
    isE2E ? '1' : '0',
    hasConfiguredApiKey(config.apiKey) ? '1' : '0',
    config.apiKey ?? '',
    config.projectId ?? '',
    useEmulator ? '1' : '0',
    host,
    String(port),
  ].join('|');
};

export function getDb(): Firestore {
  const key = buildDbCacheKey();
  if (cachedDb && cachedDb.key === key) {
    return cachedDb.value;
  }

  const isE2E = getFlag('VITE_E2E', false);
  const config = readFirebaseConfig();
  const configured = hasConfiguredApiKey(config.apiKey);
  const firestore = (isE2E || !configured) ? createNoopFirestore() : getFirestore(getFirebaseApp());

  if (!isE2E && configured && getFlag('VITE_FIRESTORE_USE_EMULATOR', false)) {
    const host = get('VITE_FIRESTORE_EMULATOR_HOST', '127.0.0.1');
    const port = getNumber('VITE_FIRESTORE_EMULATOR_PORT', 8080);
    try {
      connectFirestoreEmulator(firestore, host, port);
    } catch (error) {
      if (getFlag('DEV', false)) {
        console.warn('[firestore] emulator connection skipped:', error);
      }
    }
  }

  cachedDb = { key, value: firestore };
  return firestore;
}

// Backward-compatible default export-style constant.
export const db = getDb();
