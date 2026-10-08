/** Shared route boundary for diagnostics and its SharePoint transport. */
export function isDiagnosticReadonlyPath(pathname: string): boolean {
  let path: string;
  try {
    path = decodeURIComponent(pathname).toLowerCase().replace(/\/+$/, '');
  } catch {
    // Malformed routing input must not enable background writes.
    return true;
  }
  return path === '/admin/status' || path.startsWith('/admin/status/');
}

export function isReadonlyHttpMethod(method: string): boolean {
  return ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

export const DIAGNOSTIC_READONLY_PROXY_HEADER = 'X-Diagnostic-Readonly-Proxy';
export class DiagnosticReadonlyTransportUnsupportedError extends Error {
  constructor() { super('DIAGNOSTIC_READONLY_TRANSPORT_UNSUPPORTED'); }
}

// Router notifications update this SSOT synchronously, before React effects.
let active = typeof window !== 'undefined' && isDiagnosticReadonlyPath(window.location.pathname);
let epoch = 0;
const listeners = new Set<() => void>();
export const getDiagnosticReadonlyBoundary = () => active;
export const getDiagnosticReadonlyBoundaryEpoch = () => epoch;
export const subscribeDiagnosticReadonlyBoundary = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export function updateDiagnosticReadonlyNavigation(committedPath: string, pendingPath?: string): void {
  const next = isDiagnosticReadonlyPath(committedPath) || Boolean(pendingPath && isDiagnosticReadonlyPath(pendingPath));
  if (next === active) return;
  active = next;
  if (active) epoch++;
  listeners.forEach((listener) => listener());
}

type BoundaryRouter = {
  state: { location: { pathname: string }; navigation: { location?: { pathname: string } } };
  subscribe: (listener: () => void) => () => void;
};
const bindings = new WeakMap<BoundaryRouter, () => void>();
export function bindDiagnosticReadonlyRouter(router: BoundaryRouter): () => void {
  const existing = bindings.get(router);
  if (existing) return existing;
  const sync = () => updateDiagnosticReadonlyNavigation(router.state.location.pathname, router.state.navigation.location?.pathname);
  sync();
  const stop = router.subscribe(sync);
  const disconnect = () => { stop(); bindings.delete(router); };
  bindings.set(router, disconnect);
  return disconnect;
}
