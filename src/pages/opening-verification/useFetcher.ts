/**
 * Opening Verification — Authenticated fetcher hook
 *
 * Acquires an MSAL token via useAuth and returns a thin fetch wrapper
 * (Fetcher) that is transport-compatible with the opening verification steps.
 *
 * ## Migration note (Issue #1)
 * Replaced raw `fetch` + independent MSAL token flow with
 * `createSpClient(acquireToken, baseUrl).spFetch`.
 * This unifies the SharePoint communication boundary across the app and
 * removes the `eslint-disable no-restricted-globals` suppression.
 */
import { useAuth } from '@/auth/useAuth';
import { createSpClient, ensureConfig } from '@/lib/spClient';
import { useCallback, useMemo } from 'react';
import type { Fetcher } from './types';

export function useFetcher() {
  const { acquireToken } = useAuth();
  const cfg = useMemo(() => ensureConfig(), []);

  const getFetcher = useCallback(async (): Promise<Fetcher> => {
    const { spFetch } = createSpClient(acquireToken, cfg.baseUrl);
    return spFetch;
  }, [acquireToken, cfg.baseUrl]);

  return { getFetcher };
}
