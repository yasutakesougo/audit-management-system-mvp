/**
 * SharePoint token extraction from Playwright storageState (MSAL localStorage)
 * Shared utility for all integration tests
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type StorageState = {
  origins: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
};

const DEFAULT_AUTH_STATE_PATH = resolve(process.cwd(), 'tests/.auth/storageState.json');

export function loadAuthState(path: string = DEFAULT_AUTH_STATE_PATH): StorageState {
  if (!existsSync(path)) {
    throw new Error(
      `[integration] Missing storageState at ${path}. Run: npm run auth:setup`
    );
  }
  return JSON.parse(readFileSync(path, 'utf-8')) as StorageState;
}

/**
 * Extract SharePoint access token from MSAL storageState.
 * MSAL stores tokens in localStorage with various formats.
 * 
 * Logs token extraction statistics for diagnostics.
 */
export function extractSharePointAccessToken(
  state: StorageState,
  spResource: string = process.env.VITE_SP_RESOURCE ?? 'https://isogokatudouhome.sharepoint.com'
): string {
  const all = state.origins.flatMap((o) => o.localStorage);
  const originsCount = state.origins.length;
  const localStorageCount = all.length;
  const candidates = all
    .map((x) => x.value)
    .filter((v) => v.includes('accessToken') && v.includes(spResource));
  const candidateCount = candidates.length;

  // Try JSON-encoded tokens first
  for (const v of candidates) {
    try {
      const obj = JSON.parse(v);
      if (typeof obj?.secret === 'string' && obj.secret.length > 100) return obj.secret;
      if (typeof obj?.accessToken === 'string' && obj.accessToken.length > 100)
        return obj.accessToken;
    } catch {
      // ignore
    }
  }

  // Fallback: scan all localStorage for token-like strings
  for (const { value } of all) {
    try {
      const obj = JSON.parse(value);
      const token = obj?.secret ?? obj?.accessToken;
      if (typeof token === 'string' && token.length > 100 && !token.includes('refresh')) {
        return token;
      }
    } catch {
      // ignore
    }
  }

  throw new Error(
    [
      '[integration] Could not extract SharePoint access token from storageState.',
      `origins=${originsCount}, localStorageEntries=${localStorageCount}, candidateTokens=${candidateCount}`,
      'Run: npm run auth:setup (ensure SharePoint scope is granted and token is in storageState).',
    ].join(' ')
  );
}
