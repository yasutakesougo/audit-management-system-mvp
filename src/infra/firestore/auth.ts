import { getAuth, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFlag, get, isDev } from '@/env';
import { getFirebaseApp } from './client';

type FirebaseAuthMode = 'anonymous' | 'customToken';

type CustomTokenExchangeResponse = {
  firebaseCustomToken: string;
  orgId?: string;
  actor?: {
    id?: string;
    name?: string;
  };
  expiresInSec?: number;
};

const normalizeAuthMode = (rawMode: string): FirebaseAuthMode => {
  const normalized = rawMode.trim().toLowerCase();
  return normalized === 'customtoken' ? 'customToken' : 'anonymous';
};

const resolveAuthMode = (): FirebaseAuthMode => {
  const raw = get('VITE_FIREBASE_AUTH_MODE', 'anonymous');
  return normalizeAuthMode(raw);
};

const allowAnonymousFallback = (): boolean => {
  const raw = get('VITE_FIREBASE_AUTH_ALLOW_ANON_FALLBACK', '');
  if (!raw) {
    return isDev;
  }
  return getFlag('VITE_FIREBASE_AUTH_ALLOW_ANON_FALLBACK', false);
};

const acquireMsalAccessToken = async (): Promise<string> => {
  const [{ getPcaSingleton }, { SP_RESOURCE }] = await Promise.all([
    import('@/auth/azureMsal'),
    import('@/auth/msalConfig'),
  ]);

  const msal = await getPcaSingleton();
  const account = msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null;
  if (!account) {
    throw new Error('MSAL account is not available for token exchange');
  }

  const scopeResource = (SP_RESOURCE || get('VITE_SP_RESOURCE', '')).replace(/\/+$/, '');
  if (!scopeResource) {
    throw new Error('VITE_SP_RESOURCE is required for custom token exchange');
  }

  const token = await msal.acquireTokenSilent({
    scopes: [`${scopeResource}/.default`],
    account,
  });

  if (!token.accessToken) {
    throw new Error('MSAL access token acquisition returned empty token');
  }

  return token.accessToken;
};

const exchangeFirebaseCustomToken = async (): Promise<CustomTokenExchangeResponse> => {
  const exchangeUrl = get('VITE_FIREBASE_TOKEN_EXCHANGE_URL', '').trim();
  if (!exchangeUrl) {
    throw new Error('VITE_FIREBASE_TOKEN_EXCHANGE_URL is not configured');
  }

  const msalAccessToken = await acquireMsalAccessToken();
  const response = await fetch(exchangeUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${msalAccessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`custom token exchange failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as Partial<CustomTokenExchangeResponse>;
  if (typeof payload.firebaseCustomToken !== 'string' || payload.firebaseCustomToken.length === 0) {
    throw new Error('custom token exchange response missing firebaseCustomToken');
  }

  return {
    firebaseCustomToken: payload.firebaseCustomToken,
    orgId: payload.orgId,
    actor: payload.actor,
    expiresInSec: payload.expiresInSec,
  };
};

const signInWithConfiguredStrategy = async (
  auth: ReturnType<typeof getAuth>,
  mode: FirebaseAuthMode,
): Promise<void> => {
  if (mode === 'customToken') {
    const exchange = await exchangeFirebaseCustomToken();
    const result = await signInWithCustomToken(auth, exchange.firebaseCustomToken);
    console.info('[firebase-auth] ✅ custom token sign-in successful', {
      uid: result.user.uid,
      orgId: exchange.orgId ?? null,
      actorId: exchange.actor?.id ?? null,
      actorName: exchange.actor?.name ?? null,
      expiresInSec: exchange.expiresInSec ?? null,
    });
    return;
  }

  const cred = await signInAnonymously(auth);
  console.info('[firebase-auth] ✅ anonymous sign-in successful', {
    uid: cred.user.uid,
    isAnonymous: cred.user.isAnonymous,
  });
};

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
    const mode = resolveAuthMode();

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

    if (auth.currentUser) {
      console.info('[firebase-auth] ℹ️  user already authenticated', {
        uid: auth.currentUser.uid,
        isAnonymous: auth.currentUser.isAnonymous,
      });
      return;
    }

    try {
      await signInWithConfiguredStrategy(auth, mode);
    } catch (error) {
      const shouldFallback = mode === 'customToken' && allowAnonymousFallback();
      if (!shouldFallback) {
        throw error;
      }

      console.warn('[firebase-auth] custom token auth failed, falling back to anonymous', error);
      await signInWithConfiguredStrategy(auth, 'anonymous');
    }
  } catch (error) {
    // Non-fatal: Log but don't throw
    // App can continue with limited Firestore access or fallback to adapter
    console.error('[firebase-auth] ❌ initialization failed', error);
  }
}
