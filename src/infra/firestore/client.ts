import { initializeApp, getApps } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

import { get, getFlag, getNumber } from '@/env';

const firebaseConfig = {
  apiKey: get('VITE_FIREBASE_API_KEY'),
  authDomain: get('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: get('VITE_FIREBASE_PROJECT_ID'),
  appId: get('VITE_FIREBASE_APP_ID'),
};

export function getFirebaseApp() {
  const apps = getApps();
  return apps.length ? apps[0]! : initializeApp(firebaseConfig);
}

const firestore = getFirestore(getFirebaseApp());

if (getFlag('VITE_FIRESTORE_USE_EMULATOR', false)) {
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
