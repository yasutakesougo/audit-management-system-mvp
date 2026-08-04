import type { BrowserContext, Page } from '@playwright/test';

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
  xHttpMethodOverridePresent: boolean;
  xHttpMethodOverrideType: XHttpMethodType;
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
  return host.toLowerCase().endsWith('.sharepoint.com');
}

function normalizePath(pathname: string): string {
  const normalized = pathname.toLowerCase().replace(/\/+$/, '');
  return normalized || '/';
}

function isSpProxy(url: URL, productionOrigin: string): boolean {
  const pathname = normalizePath(url.pathname);
  const proxyPath = '/api/sp-proxy';
  return (
    url.origin === productionOrigin &&
    (pathname === proxyPath || pathname.startsWith(`${proxyPath}/`))
  );
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

export function isProductionSharePointRequest(
  rawURL: string,
  productionOrigin: string,
): boolean {
  try {
    const url = new URL(rawURL);
    return isSpProxy(url, productionOrigin) || isSharePointHost(url.host);
  } catch {
    return false;
  }
}

type MethodOverride = {
  present: boolean;
  type: XHttpMethodType;
};

function getMethodOverride(headers: Record<string, string>, headerName: string): MethodOverride {
  const present = Object.prototype.hasOwnProperty.call(headers, headerName);
  const value = headers[headerName]?.trim().toUpperCase();
  if (!value) return { present, type: 'none' };
  if (value === 'MERGE') return { present, type: 'MERGE' };
  if (value === 'DELETE') return { present, type: 'DELETE' };
  return { present, type: 'other' };
}

function isMutation(method: string, ...overrides: MethodOverride[]): boolean {
  return MUTATION_METHODS.has(method) || overrides.some(({ type }) => type !== 'none');
}

export async function installProductionReadOnlyGuard(
  context: BrowserContext,
  options: GuardOptions,
): Promise<{ getDiagnostics: () => ProductionReadOnlyGuardDiagnostics }> {
  const diagnostics: ProductionReadOnlyGuardDiagnostics = {
    readRequests: 0,
    mutationAttempts: 0,
    mutationAttemptsBlocked: 0,
    mutationAttemptSummaries: [],
  };

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();
    const headers = request.headers();
    const xHttpMethod = getMethodOverride(headers, 'x-http-method');
    const xHttpMethodOverride = getMethodOverride(headers, 'x-http-method-override');

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
      isProductionSharePointRequest(url.toString(), options.productionOrigin);

    if (!isSharePointRequest) {
      await route.continue();
      return;
    }

    if (isMutation(method, xHttpMethod, xHttpMethodOverride)) {
      diagnostics.mutationAttempts += 1;
      diagnostics.mutationAttemptsBlocked += 1;
      diagnostics.mutationAttemptSummaries.push({
        phase: options.getPhase(),
        method,
        host: url.host,
        path: url.pathname,
        xHttpMethodPresent: xHttpMethod.present,
        xHttpMethodType: xHttpMethod.type,
        xHttpMethodOverridePresent: xHttpMethodOverride.present,
        xHttpMethodOverrideType: xHttpMethodOverride.type,
      });
      await route.abort('blockedbyclient');
      return;
    }

    if (
      READ_METHODS.has(method) &&
      xHttpMethod.type === 'none' &&
      xHttpMethodOverride.type === 'none'
    ) {
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
