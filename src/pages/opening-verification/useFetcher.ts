/**
 * Opening Verification — Authenticated fetcher hook
 *
 * Acquires an MSAL token and returns a thin fetch wrapper
 * that attaches Authorization + Accept headers.
 */
import { getAppConfig } from '@/lib/env';
import { useMsal } from '@azure/msal-react';
import { useCallback } from 'react';
import type { Fetcher } from './types';

export function useFetcher() {
  const { instance, accounts } = useMsal();

  const getFetcher = useCallback(async (): Promise<Fetcher> => {
    if (accounts.length === 0) throw new Error('No MSAL account. Please login first.');
    const env = getAppConfig();
    const account = accounts[0];
    const tokenResponse = await instance.acquireTokenSilent({
      scopes: [env.VITE_SP_SCOPE_DEFAULT || 'https://isogokatudouhome.sharepoint.com/AllSites.Read'],
      account,
    });
    const token = tokenResponse.accessToken;
    const siteBaseUrl = env.VITE_SP_RESOURCE + env.VITE_SP_SITE_RELATIVE;

    return async (path: string, init?: RequestInit): Promise<Response> => {
      const url = path.startsWith('http') ? path : `${siteBaseUrl}${path}`;
      return fetch(url, {
        ...init,
        headers: {
          ...(init?.headers as Record<string, string>),
          Authorization: `Bearer ${token}`,
          Accept: 'application/json;odata=nometadata',
        },
      });
    };
  }, [accounts, instance]);

  return { getFetcher };
}
