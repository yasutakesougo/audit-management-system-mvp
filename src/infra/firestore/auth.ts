import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFlag, get } from '@/env';
import { getFirebaseApp } from './client';

/**
 * Initialize Firebase Authentication (anonymous mode)
 * 
 * Purpose:
 * - Satisfies Firestore rules `signedIn()` precondition
 * - Firestore rules require authenticated UID to track events
 * 
 * Strategy:
 * - Anonymous auth: No user interaction, instant token, perfect for demo + local dev
 * - Emulator support: Routes to local emulator if VITE_FIREBASE_AUTH_USE_EMULATOR=1
 * - Non-blocking: If auth fails, app continues (graceful degradation)
 * - Token refresh: Automatic via Firebase SDK
 * 
 * Designed for easy swap:
 * - Replace signInAnonymously() with custom token / MSAL exchange
 * - No dependency on Firestore client.ts (separate init)
 * - Emulator pattern mirrors Firestore client
 * 
 * @throws {FirebaseError} On fatal auth config errors (logs only, does not throw)
 */
export async function initFirebaseAuth(): Promise<void> {
  try {
    const app = getFirebaseApp();
    const auth = getAuth(app);

    // ✅ Connect to Emulator if enabled
    if (getFlag('VITE_FIREBASE_AUTH_USE_EMULATOR')) {
      const emulatorUrl = get('VITE_FIREBASE_AUTH_EMULATOR_URL') || 'http://localhost:9099';
      try {
        // connectAuthEmulator only allows ONE call per app instance
        // Safe to call multiple times if already connected
        if (auth.emulatorConfig === null) {
          const { connectAuthEmulator } = await import('firebase/auth');
          connectAuthEmulator(auth, emulatorUrl, { disableWarnings: true });
          console.info('[firebase-auth] ✅ emulator connected', { emulatorUrl });
        }
      } catch (error) {
        // Emulator already connected, or connection failed - log and continue
        console.warn('[firebase-auth] emulator connection warning (may already be connected)', error);
      }
    }

    // ✅ Sign in anonymously
    // If user is already signed in, this is a no-op
    // If persist disabled or localStorage unavailable, token lives in memory (tablet-friendly)
    if (!auth.currentUser) {
      const cred = await signInAnonymously(auth);
      console.info('[firebase-auth] ✅ anonymous sign-in successful', {
        uid: cred.user.uid,
        isAnonymous: cred.user.isAnonymous,
      });
    } else {
      console.info('[firebase-auth] ℹ️  user already authenticated', {
        uid: auth.currentUser.uid,
        isAnonymous: auth.currentUser.isAnonymous,
      });
    }
  } catch (error) {
    // Non-fatal: Log but don't throw
    // App can continue with limited Firestore access or fallback to adapter
    console.error('[firebase-auth] ❌ initialization failed', error);
  }
}
