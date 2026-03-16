/**
 * Circuit Breaker — Pure evaluation logic
 *
 * 通信スパンの集計結果から CLOSED / OPEN / HALF_OPEN を判定する pure function。
 * UI や spFetch/graphFetch には一切依存しない。
 *
 * ## 設計方針
 * - Shadow Breaker として先行導入（HUD 表示のみ、実遮断なし）
 * - write 系は除外（read 系 + background 系のみ対象）
 * - 件数窓ベース（時間窓は Phase 2 で検討）
 *
 * @see docs/notes/observability-design-memo.md
 */

import type { FetchSpanLayer } from '@/telemetry/fetchSpan';

// ─── Types ──────────────────────────────────────────────────────────────────

export type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/** OPEN に移行した理由 */
export type BreakerOpenReason =
  | { kind: 'error_rate'; errorCount: number; window: number }
  | { kind: 'consecutive_failures'; count: number }
  | { kind: 'slow_rate'; slowCount: number; window: number; avgMs: number };

/** 判定に必要な1リクエスト分の情報（fetchSpan の meta から抽出） */
export type BreakerSample = {
  status: number;        // HTTP status (0 = ネットワークエラー)
  durationMs: number;    // レイテンシ
  ok: boolean;           // response.ok (status 200-299)
  retryCount: number;
  timestamp: number;     // performance.now() or Date.now()
};

/** breaker の判定閾値 */
export type BreakerThresholds = {
  /** 判定窓サイズ（直近 N 件） */
  windowSize: number;
  /** 429 + 5xx が何件以上で OPEN */
  errorCountThreshold: number;
  /** 連続失敗何件で OPEN */
  consecutiveFailureThreshold: number;
  /** "slow" とみなすレイテンシ (ms) */
  slowThresholdMs: number;
  /** 窓内の slow 件数がこれ以上なら OPEN */
  slowCountThreshold: number;
  /** OPEN → HALF_OPEN に移行するまでのクールダウン (ms) */
  cooldownMs: number;
};

/** 判定結果のスナップショット */
export type BreakerSnapshot = {
  layer: FetchSpanLayer;
  state: BreakerState;
  reason: BreakerOpenReason | null;
  /** 直近窓の統計 */
  stats: BreakerStats;
  /** OPEN に入った時刻 (null = CLOSED or まだ OPEN でない) */
  openedAt: number | null;
};

/** HUD 表示用の統計 */
export type BreakerStats = {
  /** 窓内の総リクエスト数 */
  total: number;
  /** 窓内の成功数 */
  successCount: number;
  /** 窓内の 429 + 5xx 件数 */
  errorCount: number;
  /** 窓内の slow (> threshold) 件数 */
  slowCount: number;
  /** 窓内の平均レイテンシ (ms) */
  avgDurationMs: number;
  /** 窓内の p95 レイテンシ (ms) */
  p95DurationMs: number;
  /** 直近の連続失敗数 */
  consecutiveFailures: number;
  /** 窓内のリトライ総数 */
  totalRetries: number;
  /** 成功率 (0.0-1.0) */
  successRate: number;
};

// ─── Default thresholds ─────────────────────────────────────────────────────

export const DEFAULT_THRESHOLDS: BreakerThresholds = {
  windowSize: 20,
  errorCountThreshold: 5,
  consecutiveFailureThreshold: 3,
  slowThresholdMs: 2000,
  slowCountThreshold: 8,
  cooldownMs: 30_000,
};

// ─── Stats computation (pure) ───────────────────────────────────────────────

/** 直近 N 件のサンプルから統計を計算する */
export function computeBreakerStats(
  samples: readonly BreakerSample[],
  thresholds: BreakerThresholds = DEFAULT_THRESHOLDS,
): BreakerStats {
  const window = samples.slice(-thresholds.windowSize);
  const total = window.length;

  if (total === 0) {
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

  let successCount = 0;
  let errorCount = 0;
  let slowCount = 0;
  let totalDuration = 0;
  let totalRetries = 0;

  for (const s of window) {
    if (s.ok) {
      successCount++;
    }
    if (isServerOrThrottle(s.status)) {
      errorCount++;
    }
    if (s.durationMs > thresholds.slowThresholdMs) {
      slowCount++;
    }
    totalDuration += s.durationMs;
    totalRetries += s.retryCount;
  }

  // 連続失敗: 末尾から逆順に数える
  let consecutiveFailures = 0;
  for (let i = window.length - 1; i >= 0; i--) {
    if (!window[i].ok) {
      consecutiveFailures++;
    } else {
      break;
    }
  }

  // p95
  const sorted = window.map((s) => s.durationMs).sort((a, b) => a - b);
  const p95Index = Math.min(Math.ceil(total * 0.95) - 1, total - 1);
  const p95DurationMs = sorted[p95Index] ?? 0;

  return {
    total,
    successCount,
    errorCount,
    slowCount,
    avgDurationMs: Math.round(totalDuration / total),
    p95DurationMs: Math.round(p95DurationMs),
    consecutiveFailures,
    totalRetries,
    successRate: total > 0 ? successCount / total : 1,
  };
}

// ─── State evaluation (pure) ────────────────────────────────────────────────

export type BreakerPreviousState = {
  state: BreakerState;
  openedAt: number | null;
};

/**
 * 現在の状態 + サンプル + 時刻 → 次の BreakerSnapshot を計算する。
 *
 * **完全に pure** — 状態を保持しない。
 * 呼び出し側が前回の state / openedAt を渡す責務を持つ。
 */
export function evaluateBreakerState(
  layer: FetchSpanLayer,
  samples: readonly BreakerSample[],
  previous: BreakerPreviousState,
  now: number,
  thresholds: BreakerThresholds = DEFAULT_THRESHOLDS,
): BreakerSnapshot {
  const stats = computeBreakerStats(samples, thresholds);

  // ── HALF_OPEN の後の判定 ──
  if (previous.state === 'HALF_OPEN') {
    // 最新サンプルが成功 → CLOSED
    const latest = samples[samples.length - 1];
    if (latest?.ok) {
      return { layer, state: 'CLOSED', reason: null, stats, openedAt: null };
    }
    // 失敗 → OPEN に戻る
    const reason: BreakerOpenReason = {
      kind: 'consecutive_failures',
      count: stats.consecutiveFailures,
    };
    return { layer, state: 'OPEN', reason, stats, openedAt: now };
  }

  // ── OPEN 中：cooldown 経過 → HALF_OPEN ──
  if (previous.state === 'OPEN' && previous.openedAt !== null) {
    if (now - previous.openedAt >= thresholds.cooldownMs) {
      return { layer, state: 'HALF_OPEN', reason: null, stats, openedAt: previous.openedAt };
    }
    // まだ cooldown 中
    return { layer, state: 'OPEN', reason: null, stats, openedAt: previous.openedAt };
  }

  // ── CLOSED → OPEN 判定 ──
  if (stats.total < 3) {
    // サンプル不足 — 判定見送り
    return { layer, state: 'CLOSED', reason: null, stats, openedAt: null };
  }

  // 判定1: エラー率
  if (stats.errorCount >= thresholds.errorCountThreshold) {
    const reason: BreakerOpenReason = {
      kind: 'error_rate',
      errorCount: stats.errorCount,
      window: stats.total,
    };
    return { layer, state: 'OPEN', reason, stats, openedAt: now };
  }

  // 判定2: 連続失敗
  if (stats.consecutiveFailures >= thresholds.consecutiveFailureThreshold) {
    const reason: BreakerOpenReason = {
      kind: 'consecutive_failures',
      count: stats.consecutiveFailures,
    };
    return { layer, state: 'OPEN', reason, stats, openedAt: now };
  }

  // 判定3: slow rate (補助信号)
  if (stats.slowCount >= thresholds.slowCountThreshold) {
    const reason: BreakerOpenReason = {
      kind: 'slow_rate',
      slowCount: stats.slowCount,
      window: stats.total,
      avgMs: stats.avgDurationMs,
    };
    return { layer, state: 'OPEN', reason, stats, openedAt: now };
  }

  return { layer, state: 'CLOSED', reason: null, stats, openedAt: null };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isServerOrThrottle(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600) || status === 0;
}

/** OPEN 理由を人間が読める文字列にする（HUD 用） */
export function formatBreakerReason(reason: BreakerOpenReason | null): string {
  if (!reason) return '';
  switch (reason.kind) {
    case 'error_rate':
      return `${reason.errorCount}/${reason.window} errors`;
    case 'consecutive_failures':
      return `${reason.count} consecutive failures`;
    case 'slow_rate':
      return `${reason.slowCount}/${reason.window} slow (avg ${reason.avgMs}ms)`;
  }
}
