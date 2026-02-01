// src/features/auth/diagnostics/collector.ts
/* eslint-disable no-console */

export type AuthDiagnosticOutcome = 'blocked' | 'recovered' | 'manual-fix';

/**
 * Phase 3.6 系の reason code をそのまま流用できるように `string` で受けます。
 * 例: 'MSAL_IN_PROGRESS' | 'TOKEN_ACQUIRE_PENDING' | ...
 */
export type AuthDiagnosticReason = string;

export type AuthDiagnosticEvent = {
  timestamp: string; // ISO 8601
  route: string;
  reason: AuthDiagnosticReason;
  outcome: AuthDiagnosticOutcome;
  correlationId: string;

  // 任意で後から拡張しやすいように
  userId?: string;
  detail?: Record<string, unknown>;
};

export type AuthDiagnosticCollectInput = Omit<AuthDiagnosticEvent, 'timestamp' | 'correlationId'> & {
  // corrId を外部で持っている場合に上書きできる（例: 3.6-B の corrId）
  correlationId?: string;
  // timestamp も必要なら上書き可能
  timestamp?: string;
};

const nowIso = () => new Date().toISOString();

const createCorrId = (prefix = 'AUTH'): string => {
  // 既存の createAuthCorrId と衝突しない・でも同等の可読性
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(
    2,
    '0',
  )}`;
  const time = `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(
    d.getSeconds(),
  ).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${date}${time}-${rand}`;
};

type SnapshotStats = {
  total: number;
  byReason: Record<string, number>;
  byOutcome: Record<AuthDiagnosticOutcome, number>;
  recoveryRate: number; // recovered / (blocked + recovered)
};

export class AuthDiagnosticsCollector {
  private readonly maxSize: number;
  private events: AuthDiagnosticEvent[] = [];
  private lastKey: string | null = null;
  private lastKeyAt = 0;

  constructor(maxSize: number = 100) {
    this.maxSize = Math.max(10, maxSize);
  }

  private makeKey(e: AuthDiagnosticEvent): string {
    return `${e.route}::${e.reason}::${e.outcome}`;
  }

  /** 収集（リングバッファ: 最新 maxSize 件保持） */
  collect(input: AuthDiagnosticCollectInput): AuthDiagnosticEvent {
    const evt: AuthDiagnosticEvent = {
      timestamp: input.timestamp ?? nowIso(),
      correlationId: input.correlationId ?? createCorrId('AUTH'),
      route: input.route,
      reason: input.reason,
      outcome: input.outcome,
      userId: input.userId,
      detail: input.detail,
    };

    // dedupe: 短時間で同一キー（route+reason+outcome）は保存しない
    const key = this.makeKey(evt);
    const t = Date.now();
    if (this.lastKey === key && t - this.lastKeyAt < 1500) {
      return evt; // 連打抑止（保存しないが返す）
    }
    this.lastKey = key;
    this.lastKeyAt = t;

    this.events.push(evt);
    if (this.events.length > this.maxSize) {
      // 古いものから捨てる
      this.events = this.events.slice(this.events.length - this.maxSize);
    }
    return evt;
  }

  /** 直近イベント（新しい順で返す） */
  getRecent(limit: number = 50): AuthDiagnosticEvent[] {
    const n = Math.max(1, limit);
    const start = Math.max(0, this.events.length - n);
    return this.events.slice(start).reverse();
  }

  /** reason ごとの件数（全保持分） */
  groupByReason(): Record<string, number> {
    const acc: Record<string, number> = {};
    for (const e of this.events) {
      acc[e.reason] = (acc[e.reason] ?? 0) + 1;
    }
    return acc;
  }

  /** outcome ごとの件数（全保持分） */
  groupByOutcome(): Record<AuthDiagnosticOutcome, number> {
    const acc: Record<AuthDiagnosticOutcome, number> = {
      blocked: 0,
      recovered: 0,
      'manual-fix': 0,
    };
    for (const e of this.events) acc[e.outcome] += 1;
    return acc;
  }

  /** recovered / (blocked + recovered) */
  getRecoveryRate(): number {
    const byOutcome = this.groupByOutcome();
    const denom = byOutcome.blocked + byOutcome.recovered;
    if (denom <= 0) return 1;
    return byOutcome.recovered / denom;
  }

  snapshot(): SnapshotStats {
    const byReason = this.groupByReason();
    const byOutcome = this.groupByOutcome();
    return {
      total: this.events.length,
      byReason,
      byOutcome,
      recoveryRate: this.getRecoveryRate(),
    };
  }

  clear(): void {
    this.events = [];
  }
}

/**
 * シングルトン（ブラウザ内メモリ）
 * - SSR では使わない前提（呼ばれても安全に動く）
 * - 以後 UI / Admin ページで import するだけでOK
 */
export const authDiagnostics = new AuthDiagnosticsCollector(100);

/**
 * 便利関数：現在の route を安全に取る（テストでも落ちない）
 */
export const getSafeRoute = (): string => {
  if (typeof window === 'undefined') return '';
  return window.location?.pathname ?? '';
};

/**
 * 便利関数：console で即確認したい時用
 * 例: window.__authDiag?.recent(10)
 */
export const exposeAuthDiagnosticsToWindow = (): void => {
  if (typeof window === 'undefined') return;
  const w = window as unknown as {
    __authDiag?: {
      recent: (n?: number) => AuthDiagnosticEvent[];
      stats: () => SnapshotStats;
      clear: () => void;
    };
  };
  if (w.__authDiag) return;

  w.__authDiag = {
    recent: (n?: number) => authDiagnostics.getRecent(n ?? 20),
    stats: () => authDiagnostics.snapshot(),
    clear: () => authDiagnostics.clear(),
  };
};
