import type { Page } from '@playwright/test';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'MERGE', 'DELETE']);
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export type XHttpMethodType = 'none' | 'MERGE' | 'DELETE' | 'other';

export type MutationAttemptSummary = {
  phase: string;
  method: string;
  host: string;
  path: string;
  xHttpMethodPresent: boolean;
  xHttpMethodType: XHttpMethodType;
};

export type ProductionReadOnlyGuardDiagnostics = {
  readRequests: number;
  mutationAttempts: number;
  mutationAttemptsBlocked: number;
  mutationAttemptSummaries: MutationAttemptSummary[];
};

export type SafeMsalSnapshot = {
  accountCount: number;
  activeAccountPresent: boolean;
};

type GuardOptions = {
  productionOrigin: string;
  getPhase: () => string;
};

export function isAuthRedirect(rawURL: string, productionOrigin: string): boolean {
  try {
    const url = new URL(rawURL);
    return (
      url.host === 'login.microsoftonline.com' ||
      (url.origin === productionOrigin && ['/auth/callback', '/callback'].includes(url.pathname))
    );
  } catch {
    return true;
  }
}

function isSharePointHost(host: string): boolean {
  return host.endsWith('.sharepoint.com');
}

function isSpProxy(url: URL, productionOrigin: string): boolean {
  return url.origin === productionOrigin && url.pathname === '/api/sp-proxy';
}

function isFirebaseExchange(url: URL, productionOrigin: string): boolean {
  return url.origin === productionOrigin && url.pathname === '/api/firebase/exchange';
}

function isFirestoreReadChannel(url: URL): boolean {
  return (
    url.host === 'firestore.googleapis.com' &&
    url.pathname === '/google.firestore.v1.Firestore/Write/channel'
  );
}

function getXHttpMethodType(headers: Record<string, string>): XHttpMethodType {
  const value = headers['x-http-method']?.trim().toUpperCase();
  if (!value) return 'none';
  if (value === 'MERGE') return 'MERGE';
  if (value === 'DELETE') return 'DELETE';
  return 'other';
}

function isMutation(method: string, xHttpMethodType: XHttpMethodType): boolean {
  return MUTATION_METHODS.has(method) || xHttpMethodType === 'MERGE' || xHttpMethodType === 'DELETE';
}

export async function installProductionReadOnlyGuard(
  page: Page,
  options: GuardOptions,
): Promise<{ getDiagnostics: () => ProductionReadOnlyGuardDiagnostics }> {
  const diagnostics: ProductionReadOnlyGuardDiagnostics = {
    readRequests: 0,
    mutationAttempts: 0,
    mutationAttemptsBlocked: 0,
    mutationAttemptSummaries: [],
  };

  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();
    const headers = request.headers();
    const xHttpMethodType = getXHttpMethodType(headers);

    // Authentication and Firebase/Firestore transport are not SharePoint writes.
    if (
      url.host === 'login.microsoftonline.com' ||
      isFirebaseExchange(url, options.productionOrigin) ||
      isFirestoreReadChannel(url)
    ) {
      await route.continue();
      return;
    }

    const isSharePointRequest =
      isSpProxy(url, options.productionOrigin) || isSharePointHost(url.host);

    if (!isSharePointRequest) {
      await route.continue();
      return;
    }

    if (isMutation(method, xHttpMethodType)) {
      diagnostics.mutationAttempts += 1;
      diagnostics.mutationAttemptsBlocked += 1;
      diagnostics.mutationAttemptSummaries.push({
        phase: options.getPhase(),
        method,
        host: url.host,
        path: url.pathname,
        xHttpMethodPresent: xHttpMethodType !== 'none',
        xHttpMethodType,
      });
      await route.abort('blockedbyclient');
      return;
    }

    if (READ_METHODS.has(method) && xHttpMethodType === 'none') {
      diagnostics.readRequests += 1;
    }

    await route.continue();
  });

  return {
    getDiagnostics: () => ({
      ...diagnostics,
      mutationAttemptSummaries: [...diagnostics.mutationAttemptSummaries],
    }),
  };
}

export async function readSafeMsalSnapshot(page: Page): Promise<SafeMsalSnapshot> {
  return page.evaluate(() => {
    const carrier = globalThis as typeof globalThis & {
      __MSAL_PUBLIC_CLIENT__?: {
        getAllAccounts?: () => unknown[];
        getActiveAccount?: () => unknown;
      };
    };
    const instance = carrier.__MSAL_PUBLIC_CLIENT__;
    const accounts = instance?.getAllAccounts?.() ?? [];
    return {
      accountCount: accounts.length,
      activeAccountPresent: Boolean(instance?.getActiveAccount?.()),
    };
  });
}

export function mergeProductionReadOnlyGuardDiagnostics(
  ...snapshots: ProductionReadOnlyGuardDiagnostics[]
): ProductionReadOnlyGuardDiagnostics {
  return snapshots.reduce<ProductionReadOnlyGuardDiagnostics>(
    (merged, snapshot) => ({
      readRequests: merged.readRequests + snapshot.readRequests,
      mutationAttempts: merged.mutationAttempts + snapshot.mutationAttempts,
      mutationAttemptsBlocked: merged.mutationAttemptsBlocked + snapshot.mutationAttemptsBlocked,
      mutationAttemptSummaries: [
        ...merged.mutationAttemptSummaries,
        ...snapshot.mutationAttemptSummaries,
      ],
    }),
    {
      readRequests: 0,
      mutationAttempts: 0,
      mutationAttemptsBlocked: 0,
      mutationAttemptSummaries: [],
    },
  );
}
