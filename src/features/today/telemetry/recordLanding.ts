/**
 * TodayOps Landing Telemetry
 *
 * 試運用期間中、/today ページへの初回着地を Firestore に記録する。
 * 1ページロードにつき1回のみ（useRef ガード）。
 * Fire-and-forget — 書き込み失敗は無視し、UI をブロックしない。
 */
import { db } from '@/infra/firestore/client';
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
  const payload = {
    ...event,
    type: 'todayops_landing' as const,
    ts: serverTimestamp(),
    clientTs: new Date().toISOString(),
  };

  addDoc(collection(db, 'telemetry'), payload).catch((err) => {
    // Fire-and-forget: ログだけ残して握りつぶす
    // eslint-disable-next-line no-console
    console.warn('[todayops:landing] telemetry write failed', err);
  });
}
