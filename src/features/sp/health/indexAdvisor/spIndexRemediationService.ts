import { useSP } from '@/lib/spClient';
import { emitIndexRemediationRecord } from '@/features/diagnostics/drift/domain/driftLogic';
import { findListEntry } from '@/sharepoint/spListRegistry';

export type IndexRemediationAction = 'create' | 'delete';

export interface IndexRemediationInput {
  listTitle: string;
  internalName: string;
  action: IndexRemediationAction;
}

export type RemediationResult =
  | {
      ok: true;
      message: string;
      action: IndexRemediationAction;
      listTitle: string;
      internalName: string;
      timestamp: string;
    }
  | {
      ok: false;
      code:
        | 'daily_limit_exceeded'
        | 'duplicate_action'
        | 'delete_disabled'
        | 'registry_not_found'
        | 'update_failed'
        | 'validation_error';
      message: string;
      action: IndexRemediationAction;
      listTitle: string;
      internalName: string;
      timestamp: string;
    };

// ── Guard constants ────────────────────────────────────────────────────────────

/** 1日あたりの修復実行上限 */
const DAILY_LIMIT = 5;

const EXECUTED_SET_KEY = 'sp-index-remediation:executed';

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function dailyCountStorageKey(): string {
  return `sp-index-remediation:${todayDateKey()}:count`;
}

function actionKey(listTitle: string, internalName: string, action: IndexRemediationAction): string {
  return `${listTitle}::${internalName}::${action}`;
}

// ── sessionStorage helpers (fail-open for SSR / private browsing) ─────────────

function getDailyCount(): number {
  try {
    return parseInt(sessionStorage.getItem(dailyCountStorageKey()) ?? '0', 10);
  } catch {
    return 0;
  }
}

function incrementDailyCount(): void {
  try {
    sessionStorage.setItem(dailyCountStorageKey(), String(getDailyCount() + 1));
  } catch {
    // fail open
  }
}

function getExecutedSet(): Set<string> {
  try {
    const raw = sessionStorage.getItem(EXECUTED_SET_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function addToExecutedSet(key: string): void {
  try {
    const set = getExecutedSet();
    set.add(key);
    sessionStorage.setItem(EXECUTED_SET_KEY, JSON.stringify([...set]));
  } catch {
    // fail open
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * SharePoint インデックスの自動修復（追加のみ）を実行するサービス層
 *
 * ガードレール（優先順）:
 * 1. delete アクションは現フェーズで封印
 * 2. 入力値の妥当性検証
 * 3. SSOT (Registry) による存在確認
 * 4. 1日あたりの実行上限（DAILY_LIMIT 件）
 * 5. 同一フィールド連続実行禁止（セッション内）
 * 6. 実行 → 監査ログ（DriftEventsLog）記録
 *
 * 返り値は必ず RemediationResult — 失敗時は code で理由が分かる。
 */
export async function executeIndexRemediation(
  sp: ReturnType<typeof useSP>,
  input: IndexRemediationInput,
): Promise<RemediationResult> {
  const { listTitle, internalName, action } = input;
  const timestamp = new Date().toISOString();
  const base = { action, listTitle, internalName, timestamp };

  // Guard 1: delete は現フェーズで封印（UI側が誤って露出しても安全に止まる）
  if (action === 'delete') {
    return {
      ok: false,
      code: 'delete_disabled',
      message: 'インデックス削除は現フェーズでは無効です。SharePoint 管理センターから手動で行ってください。',
      ...base,
    };
  }

  // Guard 2: 入力値検証
  if (!listTitle || !internalName) {
    return {
      ok: false,
      code: 'validation_error',
      message: 'リストタイトルまたは内部名が指定されていません。',
      ...base,
    };
  }

  // Guard 3: SSOT (Registry) による存在確認
  const entry = findListEntry(listTitle);
  if (!entry) {
    const message = `リスト "${listTitle}" はレジストリで見つかりません。`;
    emitIndexRemediationRecord(listTitle, internalName, action, 'error', message);
    return { ok: false, code: 'registry_not_found', message, ...base };
  }

  // Guard 4: 1日あたりの実行上限
  if (getDailyCount() >= DAILY_LIMIT) {
    return {
      ok: false,
      code: 'daily_limit_exceeded',
      message: `本日の修復上限（${DAILY_LIMIT}件）に達しました。翌日以降に再試行してください。`,
      ...base,
    };
  }

  // Guard 5: 同一フィールド連続実行禁止（セッション内）
  const execKey = actionKey(listTitle, internalName, action);
  if (getExecutedSet().has(execKey)) {
    return {
      ok: false,
      code: 'duplicate_action',
      message: `${internalName} への "${action}" は既にこのセッションで実行済みです。`,
      ...base,
    };
  }

  // 実行
  try {
    const status = await sp.updateField(listTitle, internalName, { Indexed: true });

    if (status === 'error') {
      throw new Error('SharePoint 内部エラーによりフィールドの更新に失敗しました。');
    }

    // 成功後にのみカウント・実行済みセットを更新
    incrementDailyCount();
    addToExecutedSet(execKey);
    emitIndexRemediationRecord(listTitle, internalName, action, 'success');

    return {
      ok: true,
      message: `${internalName} のインデックスを作成しました。`,
      ...base,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emitIndexRemediationRecord(listTitle, internalName, action, 'error', message);
    return {
      ok: false,
      code: 'update_failed',
      message: `インデックス作成に失敗しました: ${message}`,
      ...base,
    };
  }
}
