/* 朝会・夕会システム専用 ログユーティリティ */

export type MeetingLogLevel = 'info' | 'warn' | 'error';

export type MeetingLogModule =
  | 'MeetingSession'
  | 'MeetingSteps'
  | 'MeetingPriority';

export interface MeetingLogEvent {
  timestamp: string; // ISO文字列
  level: MeetingLogLevel;
  module: MeetingLogModule;
  action: string; // 例: "session.upsert", "step.toggle"
  message: string; // 人間向け1行メッセージ
  context?: Record<string, unknown>; // 追加情報（構造化）
}

// ログ出力のON/OFF（本番でも残したければVITE側で制御）
const ENABLE_MEETING_LOG =
  import.meta.env.VITE_ENABLE_MEETING_LOG === '1' || import.meta.env.DEV;

// 個人情報マスキングの有無（監査要件しだいで調整）
const MASK_USER_ID = import.meta.env.VITE_MEETING_LOG_MASK_USER === '1';

/** userIdをそのまま出すか、ゆるくマスクするか */
function formatUserId(userId: string | undefined | null): string | undefined {
  if (!userId) return undefined;
  if (!MASK_USER_ID) return userId;
  // 簡易マスク（本格的にやるならハッシュ関数を注入してもよい）
  if (userId.length <= 2) return '***';
  return `${userId.slice(0, 2)}***`;
}

/** ISO → 人間向けタイムスタンプ（ローカル時間） */
function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

/** 1行テキストログの整形 */
function formatLogLine(evt: MeetingLogEvent): string {
  const ts = formatTimestamp(evt.timestamp);
  return `[${ts}] [${evt.module}] [${evt.level}] ${evt.action} - ${evt.message}`;
}

/** 実際の出力処理（console.log / warn / error） */
function emitLog(evt: MeetingLogEvent): void {
  if (!ENABLE_MEETING_LOG) return;

  const line = formatLogLine(evt);

  switch (evt.level) {
    case 'error':
      console.error(line, evt.context ?? {});
      break;
    case 'warn':
      console.warn(line, evt.context ?? {});
      break;
    default:
      console.log(line, evt.context ?? {});
      break;
  }
}

/** 呼び出し側から使うファサード */
export const meetingLogger = {
  /** セッション作成 or 更新 */
  sessionUpserted(params: {
    sessionKey: string;
    kind: 'morning' | 'evening';
    userId?: string;
    stepCount: number;
    completedCount: number;
    isNew: boolean;
  }) {
    const timestamp = new Date().toISOString();
    const userId = formatUserId(params.userId);

    const message = params.isNew
      ? `created meeting session "${params.sessionKey}" (${params.kind}), steps: ${params.completedCount}/${params.stepCount} completed`
      : `updated meeting session "${params.sessionKey}" (${params.kind}), steps: ${params.completedCount}/${params.stepCount} completed`;

    emitLog({
      timestamp,
      level: 'info',
      module: 'MeetingSession',
      action: params.isNew ? 'session.create' : 'session.update',
      message,
      context: {
        sessionKey: params.sessionKey,
        kind: params.kind,
        userId,
        stepCount: params.stepCount,
        completedCount: params.completedCount,
        isNew: params.isNew,
      },
    });
  },

  /** ステップのON/OFF */
  stepToggled(params: {
    sessionKey: string;
    kind: 'morning' | 'evening';
    stepId: string;
    stepTitle: string;
    completed: boolean;
    userId?: string;
  }) {
    const timestamp = new Date().toISOString();
    const userId = formatUserId(params.userId);

    const message = `step "${params.stepTitle}" (${params.stepId}) set to ${params.completed ? 'completed' : 'pending'} in "${params.sessionKey}" (${params.kind})`;

    emitLog({
      timestamp,
      level: 'info',
      module: 'MeetingSteps',
      action: 'step.toggle',
      message,
      context: {
        sessionKey: params.sessionKey,
        kind: params.kind,
        stepId: params.stepId,
        stepTitle: params.stepTitle,
        completed: params.completed,
        userId,
      },
    });
  },

  /** 重点フォロー一覧の取得完了 */
  priorityUsersLoaded(params: {
    sessionKey: string;
    kind: 'morning' | 'evening';
    count: number;
  }) {
    const timestamp = new Date().toISOString();

    const message = `loaded ${params.count} priority users for "${params.sessionKey}" (${params.kind})`;

    emitLog({
      timestamp,
      level: 'info',
      module: 'MeetingPriority',
      action: 'priority.load',
      message,
      context: {
        sessionKey: params.sessionKey,
        kind: params.kind,
        count: params.count,
      },
    });
  },

  /** SharePoint同期成功（任意） */
  sharePointSyncSucceeded(params: {
    sessionKey: string;
    operation: 'create' | 'update' | 'steps' | 'priority';
  }) {
    const timestamp = new Date().toISOString();

    const message = `SharePoint sync succeeded for "${params.sessionKey}" (${params.operation})`;

    emitLog({
      timestamp,
      level: 'info',
      module: 'MeetingSession',
      action: 'sharepoint.sync.ok',
      message,
      context: {
        sessionKey: params.sessionKey,
        operation: params.operation,
      },
    });
  },

  /** SharePoint同期失敗（重要） */
  sharePointSyncFailed(params: {
    sessionKey: string;
    operation: 'create' | 'update' | 'steps' | 'priority';
    error: unknown;
  }) {
    const timestamp = new Date().toISOString();

    const message = `SharePoint sync FAILED for "${params.sessionKey}" (${params.operation})`;

    emitLog({
      timestamp,
      level: 'error',
      module: 'MeetingSession',
      action: 'sharepoint.sync.error',
      message,
      context: {
        sessionKey: params.sessionKey,
        operation: params.operation,
        error: params.error,
      },
    });
  },
};