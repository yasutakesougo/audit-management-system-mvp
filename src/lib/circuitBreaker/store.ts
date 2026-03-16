/**
 * Circuit Breaker Store — スパン蓄積 + 状態管理
 *
 * fetchSpan が記録したデータを BreakerSample に変換し、
 * evaluator の pure function で判定した結果を保持する。
 *
 * Shadow Breaker: HUD に表示するだけで、リクエストは止めない。
 */

import type { HydrationSpan } from '@/lib/hydrationHud';
import { subscribeHydrationSpans } from '@/lib/hydrationHud';
import type { FetchSpanLayer } from '@/telemetry/fetchSpan';
import {
  evaluateBreakerState,
  DEFAULT_THRESHOLDS,
  type BreakerPreviousState,
  type BreakerSample,
  type BreakerSnapshot,
  type BreakerThresholds,
} from './evaluator';

// ─── Internal state ─────────────────────────────────────────────────────────

const samples: Record<FetchSpanLayer, BreakerSample[]> = {
  sp: [],
  graph: [],
};

const previousStates: Record<FetchSpanLayer, BreakerPreviousState> = {
  sp: { state: 'CLOSED', openedAt: null },
  graph: { state: 'CLOSED', openedAt: null },
};

let currentSnapshots: Record<FetchSpanLayer, BreakerSnapshot> = {
  sp: { layer: 'sp', state: 'CLOSED', reason: null, stats: emptyStat(), openedAt: null },
  graph: { layer: 'graph', state: 'CLOSED', reason: null, stats: emptyStat(), openedAt: null },
};

const MAX_SAMPLES = 100;
let _thresholds: BreakerThresholds = DEFAULT_THRESHOLDS;
let _subscribed = false;

const listeners = new Set<(snapshots: Record<FetchSpanLayer, BreakerSnapshot>) => void>();

// ─── Public API ─────────────────────────────────────────────────────────────

/** 最新のスナップショット取得 */
export function getBreakerSnapshots(): Record<FetchSpanLayer, BreakerSnapshot> {
  return { ...currentSnapshots };
}

/** 特定レイヤーのスナップショット */
export function getBreakerSnapshot(layer: FetchSpanLayer): BreakerSnapshot {
  return currentSnapshots[layer];
}

/** スナップショットの変化をサブスクライブ */
export function subscribeBreakerSnapshots(
  listener: (snapshots: Record<FetchSpanLayer, BreakerSnapshot>) => void,
): () => void {
  listeners.add(listener);
  listener({ ...currentSnapshots });
  return () => {
    listeners.delete(listener);
  };
}

/** HydrationSpan の subscribe を開始する（アプリ起動時に1度呼ぶ） */
export function initBreakerStore(thresholds?: Partial<BreakerThresholds>): () => void {
  if (thresholds) {
    _thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  if (_subscribed) {
    return () => { /* already subscribed */ };
  }

  _subscribed = true;
  const unsubscribe = subscribeHydrationSpans((allSpans) => {
    const fetchSpans = allSpans.filter(isFetchSpan);
    ingestSpans(fetchSpans);
  });

  return () => {
    unsubscribe();
    _subscribed = false;
  };
}

/** @internal テスト用リセット */
export function _resetBreakerStore(): void {
  samples.sp = [];
  samples.graph = [];
  previousStates.sp = { state: 'CLOSED', openedAt: null };
  previousStates.graph = { state: 'CLOSED', openedAt: null };
  currentSnapshots = {
    sp: { layer: 'sp', state: 'CLOSED', reason: null, stats: emptyStat(), openedAt: null },
    graph: { layer: 'graph', state: 'CLOSED', reason: null, stats: emptyStat(), openedAt: null },
  };
  _subscribed = false;
  listeners.clear();
}

// ─── Internal ───────────────────────────────────────────────────────────────

function isFetchSpan(span: HydrationSpan): boolean {
  return span.group === 'fetch:sp' || span.group === 'fetch:graph';
}

function spanToSample(span: HydrationSpan): BreakerSample | null {
  if (!span.meta || span.end === undefined) return null;
  const layer = span.meta.layer;
  if (layer !== 'sp' && layer !== 'graph') return null;

  const status = typeof span.meta.status === 'number' ? span.meta.status : 0;
  const retryCount = typeof span.meta.retryCount === 'number' ? span.meta.retryCount : 0;
  const ok = !span.error && status >= 200 && status < 300;

  return {
    status,
    durationMs: span.duration ?? 0,
    ok,
    retryCount,
    timestamp: span.end,
  };
}

function ingestSpans(fetchSpans: HydrationSpan[]): void {
  // 完了済みスパンだけ取り込む
  const completed = fetchSpans.filter((s) => s.end !== undefined);

  // snapshot ids we already have
  const spIds = new Set(samples.sp.map((_, i) => i));
  const graphIds = new Set(samples.graph.map((_, i) => i));
  void spIds; void graphIds;

  // 全件再構築（span store は immutable snapshot なので差分は取りにくい）
  const newSp: BreakerSample[] = [];
  const newGraph: BreakerSample[] = [];

  for (const span of completed) {
    const sample = spanToSample(span);
    if (!sample) continue;
    const layer = span.meta?.layer as FetchSpanLayer;
    if (layer === 'sp') newSp.push(sample);
    else if (layer === 'graph') newGraph.push(sample);
  }

  // cap
  samples.sp = newSp.slice(-MAX_SAMPLES);
  samples.graph = newGraph.slice(-MAX_SAMPLES);

  // evaluate
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const spSnap = evaluateBreakerState('sp', samples.sp, previousStates.sp, now, _thresholds);
  const graphSnap = evaluateBreakerState('graph', samples.graph, previousStates.graph, now, _thresholds);

  previousStates.sp = { state: spSnap.state, openedAt: spSnap.openedAt };
  previousStates.graph = { state: graphSnap.state, openedAt: graphSnap.openedAt };

  currentSnapshots = { sp: spSnap, graph: graphSnap };

  // notify
  for (const listener of listeners) {
    try {
      listener({ ...currentSnapshots });
    } catch {
      // ignore
    }
  }
}

function emptyStat() {
  return {
    total: 0,
    successCount: 0,
    errorCount: 0,
    slowCount: 0,
    avgDurationMs: 0,
    p95DurationMs: 0,
    consecutiveFailures: 0,
    totalRetries: 0,
    successRate: 1,
  };
}
