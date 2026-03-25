/**
 * TodayOps Landing Telemetry
 *
 * 試運用期間中、/today ページへの初回着地を Firestore に記録する。
 * 1ページロードにつき1回のみ（useRef ガード）。
 * Fire-and-forget — 書き込み失敗は無視し、UI をブロックしない。
 */
import { getDb, isFirestoreWriteAvailable } from '@/infra/firestore/client';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

export type LandingEvent = {
  path: string;
  search: string;
  role: string;
  referrer: string;
  userAgent: string;
};

/**
 * Fire-and-forget: Firestore `telemetry` コレクションに着地イベントを書き込む。
 * エラーは console.warn のみ。UI に影響を与えない。
 */
export function recordLanding(event: LandingEvent): void {
  if (!isFirestoreWriteAvailable()) {
    return;
  }

  const payload = {
    ...event,
    type: 'todayops_landing' as const,
    ts: serverTimestamp(),
    clientTs: new Date().toISOString(),
  };

  try {
    // Guard: db may be a noop Proxy (E2E / unconfigured Firebase)
    // Firebase SDK's collection() validates the first arg with instanceof —
    // a Proxy object will fail this check and throw a FirebaseError.
    addDoc(collection(getDb(), 'telemetry'), payload).catch((err) => {
      // Fire-and-forget: ログだけ残して握りつぶす
      // eslint-disable-next-line no-console
      console.warn('[todayops:landing] telemetry write failed', err);
    });
  } catch (err) {
    // Synchronous throw from collection() when db is invalid (noop Proxy, undefined, etc.)
    // eslint-disable-next-line no-console
    console.warn('[todayops:landing] telemetry skipped (db not ready)', err);
  }
}
