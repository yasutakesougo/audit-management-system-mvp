/**
 * SpHealthSignalStore — SharePoint 運用状態の単一シグナル管理
 *
 * 設計方針:
 * - モジュールレベルのシングルトン（Reactに依存しない）
 * - 常に「最も優先度の高い1つのシグナル」を保持
 * - 低優先度シグナルは無視（既存シグナルを保護）
 * - 同一課題（reasonCode + listName）の繰り返しは occurrenceCount に圧縮
 * - 24時間 TTL で自動失効
 * - Nightly Patrol (バッチ) と Realtime (即時) の両方を受け付ける
 * - actionUrl / actionType で復旧導線を構造化
 * - 例外を外部に投げない（fail-open）
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type SpHealthSeverity = 'watch' | 'warning' | 'action_required' | 'critical';

/**
 * Nightly Patrol / Realtime で共通利用するreasonCode
 * src/features/sp/health/mapping.ts の変換ロジックと対応
 */
export type SpHealthReasonCode =
  | 'sp_index_pressure'    // インデックス数が上限に近い
  | 'sp_limit_reached'     // 8KB行サイズ / インデックス上限に到達
  | 'sp_bootstrap_blocked' // プロビジョニングがブロック済み
  | 'sp_auth_failed'       // 認証失敗 / 401
  | 'sp_list_unreachable'  // リストが見つからない / 到達不能
  | 'sp_schema_drift'      // スキーマ・ドリフト（列名の不一致）が検出された
  | 'sp_gate_escape_hatch'; // ガードレール（タイムアウト）の強制バイパス

export type SpHealthSignalSource = 'nightly_patrol' | 'realtime';

/**
 * actionUrl の種別
 * - internal : アプリ内ルート（RouterLink で遷移）
 * - doc      : 静的ドキュメント（別タブで開く）
 * - tool     : 管理ツール画面（別タブで開く）
 */
export type SpHealthActionType = 'internal' | 'doc' | 'tool';

export interface SpHealthRemediation {
  summary: string;
  commands: string[];
  caution?: string;
  isDestructive?: boolean;
}

export interface SpHealthSignal {
  severity: SpHealthSeverity;
  reasonCode: SpHealthReasonCode;
  listName?: string;
  message: string;
  actionGuide?: string;
  /** 復旧導線 URL（内部ルートまたは外部リンク）*/
  actionUrl?: string;
  /** actionUrl の種別（遷移方法の決定に使用）*/
  actionType?: SpHealthActionType;
  /** 推奨される修復アクション */
  remediation?: SpHealthRemediation;
  /**
   * 同一課題の検知累計回数（圧縮）
   * - 1 = 初回検知
   * - 2以上 = 繰り返し発生中
   */
  occurrenceCount: number;
  occurredAt: string;
  source: SpHealthSignalSource;
}

// ─── reasonCode → Action mapping ──────────────────────────────────────────────

interface ActionSpec {
  actionUrl: string;
  actionType: SpHealthActionType;
  actionGuide: string;
}

const REASON_ACTION_MAP: Record<SpHealthReasonCode, ActionSpec> = {
  sp_limit_reached: {
    actionUrl: '/admin/status?highlight=sp_limit_reached',
    actionType: 'internal',
    actionGuide: '管理画面でリスト構造を確認し、不要フィールドの削除またはリスト分割を検討してください。',
  },
  sp_index_pressure: {
    actionUrl: '/admin/status?highlight=sp_index_pressure',
    actionType: 'internal',
    actionGuide: 'インデックス数が上限（20）に近づいています。使用頻度の低いインデックスを削除してください。',
  },
  sp_bootstrap_blocked: {
    actionUrl: '/admin/status?highlight=sp_bootstrap_blocked',
    actionType: 'internal',
    actionGuide: '起動時プロビジョニングが停止しています。管理画面の診断結果を確認してください。',
  },
  sp_auth_failed: {
    actionUrl: '/admin/status?highlight=sp_auth_failed',
    actionType: 'internal',
    actionGuide: '認証エラーが発生しています。MSAL設定・テナントURL・権限を確認してください。',
  },
  sp_list_unreachable: {
    actionUrl: '/admin/status?highlight=sp_list_unreachable',
    actionType: 'internal',
    actionGuide: 'SharePoint リストへの到達に失敗しています。リストの存在・権限設定を確認してください。',
  },
  sp_schema_drift: {
    actionUrl: '/admin/status?highlight=sp_schema_drift',
    actionType: 'internal',
    actionGuide: '列名に微細な不整合（末尾 host _0 付与等）が検出されました。放置すると 8KB 制限の原因となるため、クリーンアップが必要です。',
  },
  sp_gate_escape_hatch: {
    actionUrl: '/admin/status?highlight=sp_gate_escape_hatch',
    actionType: 'internal',
    actionGuide: 'リストの存在確認がタイムアウトしたため、一時的にチェックをバイパスしました。ネットワーク遅延か、SharePointの応答性能を確認してください。',
  },
};

/**
 * reasonCode に対応する actionUrl / actionType / actionGuide を付与する
 */
function enrichWithAction(signal: Omit<SpHealthSignal, 'occurrenceCount'>): SpHealthSignal {
  const spec = REASON_ACTION_MAP[signal.reasonCode];
  let actionUrl = signal.actionUrl ?? spec?.actionUrl;

  // リスト名が指定されている場合、クエリパラメータに付与して「直接その場所へ」飛ばす導線を強化
  if (actionUrl && signal.listName && !actionUrl.includes('list=')) {
    const connector = actionUrl.includes('?') ? '&' : '?';
    actionUrl += `${connector}list=${encodeURIComponent(signal.listName)}`;
  }

  return {
    ...signal,
    actionUrl,
    actionType: signal.actionType ?? spec?.actionType,
    actionGuide: signal.actionGuide ?? spec?.actionGuide,
    occurrenceCount: 1,
  };
}

// ─── Priority ─────────────────────────────────────────────────────────────────

const SEVERITY_PRIORITY: Record<SpHealthSeverity, number> = {
  watch: 0,
  warning: 1,
  action_required: 2,
  critical: 3,
};

function isHigherPriority(incoming: SpHealthSeverity, current: SpHealthSeverity): boolean {
  return SEVERITY_PRIORITY[incoming] > SEVERITY_PRIORITY[current];
}

// ─── Compression ─────────────────────────────────────────────────────────────

/**
 * 同一課題かどうかを判定する（reasonCode + listName の一致）
 */
function isSameIssue(a: SpHealthSignal, b: Omit<SpHealthSignal, 'occurrenceCount'>): boolean {
  return a.reasonCode === b.reasonCode && (a.listName ?? '') === (b.listName ?? '');
}

// ─── TTL ──────────────────────────────────────────────────────────────────────

const SIGNAL_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function isExpired(occurredAt: string): boolean {
  try {
    const age = Date.now() - new Date(occurredAt).getTime();
    return age > SIGNAL_TTL_MS;
  } catch {
    return true;
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

type Subscriber = (signal: SpHealthSignal | null) => void;

let _current: SpHealthSignal | null = null;
const _subscribers: Set<Subscriber> = new Set();

function _notify(): void {
  _subscribers.forEach((fn) => {
    try { fn(_current); } catch { /* fail-open */ }
  });
}

const ESCALATION_THRESHOLD = 3;

/**
 * シグナルを報告する。
 */
export function reportSpHealthEvent(signal: Omit<SpHealthSignal, 'occurrenceCount'>): void {
  try {
    if (isExpired(signal.occurredAt)) return;

    const enriched = enrichWithAction(signal);

    if (_current === null || isExpired(_current.occurredAt)) {
      _current = enriched;
      _notify();
      return;
    }

    // ── 同一課題の圧縮 ──────────────────────────────────────────────────────
    if (isSameIssue(_current, signal)) {
      const prevCount = _current.occurrenceCount;
      const nextCount = prevCount + 1;
      
      const incomingIsHigher = isHigherPriority(signal.severity, _current.severity);
      const isRealtimeOverNightly =
        signal.source === 'realtime' &&
        _current.source === 'nightly_patrol' &&
        SEVERITY_PRIORITY[signal.severity] >= SEVERITY_PRIORITY[_current.severity];

      // 回数による自動昇格 (warning -> action_required)
      let finalSeverity = signal.severity;
      if (finalSeverity === 'warning' && nextCount >= ESCALATION_THRESHOLD) {
        finalSeverity = 'action_required';
      }

      if (incomingIsHigher || isRealtimeOverNightly || finalSeverity !== signal.severity) {
        _current = { 
          ...enriched, 
          severity: finalSeverity as SpHealthSeverity, 
          occurrenceCount: nextCount 
        };
      } else {
        _current = { ..._current, occurrenceCount: nextCount };
      }
      _notify();
      return;
    }

    // ── 別課題の優先度比較 ────────────────────────────────────────────────────
    const incomingPriority = SEVERITY_PRIORITY[signal.severity];
    const currentPriority = SEVERITY_PRIORITY[_current.severity];
    const shouldOverrideBySource =
      signal.source === 'realtime' &&
      _current.source === 'nightly_patrol' &&
      incomingPriority >= currentPriority;

    if (!isHigherPriority(signal.severity, _current.severity) && !shouldOverrideBySource) {
      return;
    }

    _current = enriched;
    _notify();
  } catch {
    // fail-open
  }
}

/**
 * シグナルを明示的に消去する（修復完了時など）
 * これにより、次に同じ課題が検知された際はカウントが 1 からリセットされます。
 */
export function clearSpHealthSignal(): void {
  _current = null;
  _notify();
}

/**
 * 特定の課題（reasonCode + listName）が解消された場合に消去する
 * 自動回復（transient_failure）の検知時に使用。
 */
export function revokeSpHealthSignal(reasonCode: SpHealthReasonCode, listName?: string): void {
  if (_current && 
      _current.reasonCode === reasonCode && 
      (_current.listName ?? '') === (listName ?? '')) {
    clearSpHealthSignal();
  }
}

/**
 * 特定のリソース（リスト名等）に関するすべてのシグナルを消去する
 * 「対象リストの通信が回復した」場合など、具体的な reasonCode が特定できない回復時に使用。
 */
export function revokeSpHealthSignalByResource(listName: string): void {
  if (_current && (_current.listName === listName)) {
    clearSpHealthSignal();
  }
}

/**
 * 現在の最高優先シグナルを取得する（TTL 失効分は null を返す）
 */
export function getSpHealthSignal(): SpHealthSignal | null {
  if (_current === null) return null;
  if (isExpired(_current.occurredAt)) {
    _current = null;
    _notify();
    return null;
  }
  return _current;
}

/**
 * シグナル変化の購読（UI コンポーネント用）
 * @returns unsubscribe 関数
 */
export function subscribeSpHealthSignal(fn: Subscriber): () => void {
  _subscribers.add(fn);
  return () => { _subscribers.delete(fn); };
}

/**
 * テスト用リセット（本番コードからは呼ばない）
 * @internal
 */
export function _resetSpHealthSignalStore(): void {
  _current = null;
  _subscribers.clear();
}
