import { initializeApp, getApps } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

import { get, getFlag, getNumber } from '@/env';

const firebaseConfig = {
  apiKey: get('VITE_FIREBASE_API_KEY'),
  authDomain: get('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: get('VITE_FIREBASE_PROJECT_ID'),
  appId: get('VITE_FIREBASE_APP_ID'),
};

/**
 * Creates a no-op Firestore proxy for E2E tests.
 * This prevents "Cannot read properties of null" errors when Firebase operations
 * are called in test environments without a valid Firebase configuration.
 */
function createNoopFirestore(): Firestore {
  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      if (prop === 'type') return 'firestore';
      if (prop === 'app') return null;
      // Return a function that logs a warning and returns a safe value
      return (...args: any[]) => {
        if (getFlag('DEV', false)) {
          console.warn(`[firebase-noop] ${String(prop)} called with`, args);
        }
        return createNoopFirestore(); // Chain-safe
      };
    },
  };
  return new Proxy({}, handler) as Firestore;
}

export function getFirebaseApp() {
  const isE2E = getFlag('VITE_E2E', false);
  
  if (isE2E) {
    console.log('[firebase] disabled:', { VITE_E2E: getFlag('VITE_E2E', false) });
    return null as any;
  }
  
  const apps = getApps();
  return apps.length ? apps[0]! : initializeApp(firebaseConfig);
}

const isE2E = getFlag('VITE_E2E', false);
const firestore = isE2E ? createNoopFirestore() : getFirestore(getFirebaseApp());

if (!isE2E && getFlag('VITE_FIRESTORE_USE_EMULATOR', false)) {
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

export const db = firestore;
