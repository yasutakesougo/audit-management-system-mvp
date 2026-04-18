/**
 * Remediation Executor — RemediationPlan を実行する副作用レイヤー
 *
 * 設計原則:
 * - SharePoint 呼び出しはここに閉じ込める
 * - plan.action ごとに分岐可能な dispatcher
 * - 結果を構造化して返す（成功/スキップ/エラー）
 * - UI と Nightly の両方から再利用しやすい API
 * - retry / throttle / error normalization を将来集約できる形
 *
 * 禁止:
 * - UI コンポーネントから直接 spFetch を呼びに行く構造へ戻さない
 * - planner に副作用を混ぜない
 */

import type { SpListOperations } from '@/lib/sp/spLists';
import type { RemediationPlan, RemediationResult } from './types';
import { emitExecutionCompleted } from './audit';

// ── Executor dependencies ────────────────────────────────────────────────────

/** executor が必要とする SP クライアントの最小インターフェース */
export type RemediationSpClient = Pick<SpListOperations, 'updateField'>;

/** executor のオプション（将来の retry / throttle 拡張点） */
export interface ExecutorOptions {
  /** 日時生成（テスト時の deterministic 化） */
  now?: () => string;
}

// ── Action handlers ──────────────────────────────────────────────────────────

async function handleDeleteIndex(
  spClient: RemediationSpClient,
  plan: RemediationPlan,
): Promise<RemediationResult> {
  const { listKey, fieldName } = plan.target;
  if (!listKey || !fieldName) {
    return makeError(plan.id, 'INVALID_TARGET', 'delete_index requires listKey and fieldName', false);
  }

  const result = await spClient.updateField(listKey, fieldName, { Indexed: false });
  if (result === 'error') {
    return makeError(plan.id, 'SP_API_ERROR', `SharePoint returned "error" for ${listKey}.${fieldName}`, true);
  }

  return makeSuccess(plan.id);
}

async function handleCreateIndex(
  spClient: RemediationSpClient,
  plan: RemediationPlan,
): Promise<RemediationResult> {
  const { listKey, fieldName } = plan.target;
  if (!listKey || !fieldName) {
    return makeError(plan.id, 'INVALID_TARGET', 'create_index requires listKey and fieldName', false);
  }

  const result = await spClient.updateField(listKey, fieldName, { Indexed: true });
  if (result === 'error') {
    return makeError(plan.id, 'SP_API_ERROR', `SharePoint returned "error" for ${listKey}.${fieldName}`, true);
  }

  return makeSuccess(plan.id);
}

// ── Result builders ──────────────────────────────────────────────────────────

let _nowFn: () => string = () => new Date().toISOString();

function makeSuccess(planId: string): RemediationResult {
  return { planId, status: 'success', executedAt: _nowFn() };
}

function makeSkipped(planId: string, code: string, message: string): RemediationResult {
  return { planId, status: 'skipped', error: { code, message, retryable: false }, executedAt: _nowFn() };
}

function makeError(planId: string, code: string, message: string, retryable: boolean): RemediationResult {
  return { planId, status: 'error', error: { code, message, retryable }, executedAt: _nowFn() };
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

/** action → handler のディスパッチテーブル */
const ACTION_HANDLERS: Record<
  string,
  ((spClient: RemediationSpClient, plan: RemediationPlan) => Promise<RemediationResult>) | undefined
> = {
  delete_index: handleDeleteIndex,
  create_index: handleCreateIndex,
};

/**
 * RemediationPlan を実行する
 *
 * - requiresApproval=true の plan は approved=true を明示しない限りスキップする
 * - 未対応の action は安全にスキップする
 * - エラーは構造化して返す（throw しない）
 */
export async function executeRemediation(
  spClient: RemediationSpClient,
  plan: RemediationPlan,
  options: ExecutorOptions & { approved?: boolean } = {},
): Promise<RemediationResult> {
  // 日時関数の注入
  const prevNow = _nowFn;
  if (options.now) {
    _nowFn = options.now;
  }

  try {
    let result: RemediationResult;

    // ── 承認チェック ─────────────────────────────────────────────────────
    if (plan.requiresApproval && !options.approved) {
      result = makeSkipped(plan.id, 'APPROVAL_REQUIRED', `Plan "${plan.id}" requires approval before execution`);
      emitExecutionCompleted(plan, result);
      return result;
    }

    // ── Action dispatch ──────────────────────────────────────────────────
    const handler = ACTION_HANDLERS[plan.action];
    if (!handler) {
      result = makeSkipped(plan.id, 'UNSUPPORTED_ACTION', `Action "${plan.action}" is not yet implemented`);
      emitExecutionCompleted(plan, result);
      return result;
    }

    result = await handler(spClient, plan);
    emitExecutionCompleted(plan, result);
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const result = makeError(plan.id, 'UNEXPECTED_ERROR', message, true);
    emitExecutionCompleted(plan, result);
    return result;
  } finally {
    _nowFn = prevNow;
  }
}

/**
 * 複数の RemediationPlan を順次実行する
 *
 * 将来の拡張点: 並列実行 / throttle / batch audit emission
 */
export async function executeRemediationBatch(
  spClient: RemediationSpClient,
  plans: RemediationPlan[],
  options: ExecutorOptions & { approved?: boolean } = {},
): Promise<RemediationResult[]> {
  const results: RemediationResult[] = [];
  for (const plan of plans) {
    results.push(await executeRemediation(spClient, plan, options));
  }
  return results;
}
