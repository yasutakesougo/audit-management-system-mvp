import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

import { get } from '@/env';

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

export const db = getFirestore(getFirebaseApp());
