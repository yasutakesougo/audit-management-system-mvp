/**
 * fetchSpan — 通信レイヤーの構造化イベント計測
 *
 * spFetch / graphFetch に差し込み、既存の HydrationSpan パイプラインに乗せる。
 * HUD 表示 + Beacon テレメトリ送信が自動的に効く。
 *
 * ## 記録するもの
 * - layer (sp / graph)
 * - method, path (先頭80文字、クエリ除去)
 * - status, durationMs, retryCount, errorName
 *
 * ## 記録しないもの (PII 保護)
 * - リクエスト/レスポンスボディ
 * - Authorization ヘッダー
 * - ユーザー ID / 名前
 * - クエリパラメータの値
 */

import { beginHydrationSpan } from '@/lib/hydrationHud';

// ─── Types ──────────────────────────────────────────────────────────────────

export type FetchSpanLayer = 'sp' | 'graph';

export type FetchSpanOptions = {
  layer: FetchSpanLayer;
  method: string;
  path: string;
};

export type FetchSpanHandle = {
  /** 通信成功時に呼ぶ */
  succeed: (status: number, retryCount?: number) => void;
  /** 通信失敗時に呼ぶ */
  fail: (status: number, errorName: string, retryCount?: number) => void;
  /** ネットワークエラー等、HTTP レスポンスがない失敗 */
  error: (errorName: string, retryCount?: number) => void;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const PATH_MAX_LENGTH = 80;

/** クエリパラメータを除去し、80文字に制限 */
export function truncatePath(path: string): string {
  const clean = path.split('?')[0];
  return clean.length > PATH_MAX_LENGTH
    ? clean.slice(0, PATH_MAX_LENGTH) + '…'
    : clean;
}

// ─── counter for unique span IDs within a session ───────────────────────────

let _counter = 0;

/** @internal テスト用リセット */
export function _resetCounter(): void {
  _counter = 0;
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * 通信スパンを開始する。
 *
 * @example
 * ```ts
 * const span = startFetchSpan({ layer: 'sp', method: 'GET', path: '/_api/web/lists/...' });
 * try {
 *   const res = await fetch(url);
 *   span.succeed(res.status, retryCount);
 * } catch (e) {
 *   span.error(e instanceof Error ? e.name : 'Unknown');
 * }
 * ```
 */
export function startFetchSpan(options: FetchSpanOptions): FetchSpanHandle {
  const seq = ++_counter;
  const truncated = truncatePath(options.path);
  const id = `fetch:${options.layer}:${seq}`;

  const complete = beginHydrationSpan(id, {
    id,
    label: `${options.layer} ${options.method} ${truncated}`,
    group: `fetch:${options.layer}`,
    meta: {
      layer: options.layer,
      method: options.method,
      path: truncated,
    },
  });

  return {
    succeed(status: number, retryCount = 0) {
      complete({
        meta: { status, retryCount },
      });
    },
    fail(status: number, errorName: string, retryCount = 0) {
      complete({
        error: `${errorName} (${status})`,
        meta: { status, retryCount, errorName },
      });
    },
    error(errorName: string, retryCount = 0) {
      complete({
        error: errorName,
        meta: { status: 0, retryCount, errorName },
      });
    },
  };
}
