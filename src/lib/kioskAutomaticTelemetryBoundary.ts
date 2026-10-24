/** Only automatic telemetry uses this boundary; business writes remain separate. */
export const isKioskTelemetryPath = (pathname: string): boolean =>
  pathname === '/kiosk' || pathname.startsWith('/kiosk/');

let committedPath = '';
let pendingPath: string | undefined;
let epoch = 0;
const active = () => isKioskTelemetryPath(committedPath) || Boolean(pendingPath && isKioskTelemetryPath(pendingPath));

/** A per-operation guard: an entry into Kiosk invalidates already-prepared work. */
export function automaticTelemetryWriteGuard(eventPath?: string): () => boolean {
  const startEpoch = epoch;
  return () => !active() && startEpoch === epoch &&
    !isKioskTelemetryPath(eventPath ?? '') &&
    !(typeof window !== 'undefined' && isKioskTelemetryPath(window.location.pathname));
}

type BoundaryRouter = {
  state: { location: { pathname: string }; navigation: { location?: { pathname: string } } };
  subscribe: (listener: () => void) => () => void;
};
const bindings = new WeakMap<BoundaryRouter, () => void>();
export function bindKioskAutomaticTelemetryRouter(router: BoundaryRouter): () => void {
  const existing = bindings.get(router);
  if (existing) return existing;
  const sync = () => {
    const wasActive = active();
    committedPath = router.state.location.pathname;
    pendingPath = router.state.navigation.location?.pathname;
    if (active() && !wasActive) epoch++;
  };
  sync();
  const stop = router.subscribe(sync);
  const disconnect = () => { stop(); bindings.delete(router); };
  bindings.set(router, disconnect);
  return disconnect;
}
