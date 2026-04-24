/**
 * buildTransportExceptions — Transport Alert → ExceptionItem 変換
 *
 * Transport テレメトリの KpiAlert[] を ExceptionCenter の ExceptionItem[] に変換する。
 * 各アラートを具体的な「対応行動」+ deep link に紐づける。
 *
 * ## v2 追加: per-user enrichment
 * stale / sync-failed については、per-user 詳細が提供されている場合
 * 集約 Exception に加えて **個別 Exception** を生成する。
 * これにより「誰の・どの方向が・何分停滞しているか」まで表示できる。
 *
 * ## 設計意図
 * - KpiAlert は「判定結果」（facts → judgment）
 * - ExceptionItem は「行動指示」（judgment → action）
 * - TransportDetails は「具体的な対象者」（enrichment）
 * - この変換で「検知 → 可視化 → 対応」のループが閉じる
 */

import type { KpiAlert } from '@/features/telemetry/domain/computeCtaKpiDiff';
import type { ExceptionItem, ExceptionSeverity } from './exceptionLogic';
import type { TransportDetails } from './extractTransportDetails';

// ── Alert → Exception Mapping ───────────────────────────────────────────────

type AlertMapping = {
  severity: ExceptionSeverity;
  title: string;
  actionLabel: string;
  actionPath: string;
};

export type MissingDriverDetail = {
  userCode: string;
  userName?: string;
  direction: 'to' | 'from';
  vehicleId: string;
};

const ALERT_MAPPINGS: Record<string, AlertMapping> = {
  'transport-sync-fail-count': {
    severity: 'critical',
    title: '送迎実績の同期に失敗があります',
    actionLabel: '送迎状況を確認',
    actionPath: '/today',
  },
  'transport-fallback-active': {
    severity: 'high',
    title: '送迎対象フィルタが無効です',
    actionLabel: '送迎対象者を確認',
    actionPath: '/today',
  },
  'transport-stale-count': {
    severity: 'medium',
    title: '送迎ステータスが長時間停滞中',
    actionLabel: '停滞中の送迎を確認',
    actionPath: '/today',
  },
  'transport-low-completion': {
    severity: 'medium',
    title: '送迎完了率が閾値を下回っています',
    actionLabel: '未到着者を確認',
    actionPath: '/today',
  },
  'transport-missing-driver-assignment': {
    severity: 'high',
    title: '運転者未設定の送迎車両があります',
    actionLabel: '配車ボードを確認',
    actionPath: '/today',
  },
};

// ── Direction Label Utility ─────────────────────────────────────────────────

const DIRECTION_LABEL: Record<string, string> = {
  to: '迎え',
  from: '送り',
};

function dirLabel(direction: string): string {
  return DIRECTION_LABEL[direction] ?? direction;
}

// ── User Name Resolver ──────────────────────────────────────────────────────

type UserNameMap = Record<string, string>;

function resolveName(userCode: string, names?: UserNameMap): string {
  if (names && names[userCode]) return names[userCode];
  return userCode;
}

// ── Core Function ───────────────────────────────────────────────────────────

export type AssignmentConflictEvent = {
  timestamp: number;
  reason: string;
  retryCount: number;
  itemId: string;
};

export type BuildTransportExceptionsOptions = {
  alerts: KpiAlert[];
  today: string;
  details?: TransportDetails;
  missingDriverUsers?: MissingDriverDetail[];
  userNames?: UserNameMap;
  assignmentConflictEvents?: AssignmentConflictEvent[];
};

export function buildTransportExceptions(
  options: BuildTransportExceptionsOptions,
): ExceptionItem[];

export function buildTransportExceptions(
  alerts: KpiAlert[],
  today: string,
): ExceptionItem[];

export function buildTransportExceptions(
  alertsOrOptions: KpiAlert[] | BuildTransportExceptionsOptions,
  todayLegacy?: string,
): ExceptionItem[] {
  const opts: BuildTransportExceptionsOptions =
    Array.isArray(alertsOrOptions)
      ? { alerts: alertsOrOptions, today: todayLegacy! }
      : alertsOrOptions;

  const { alerts, today, details, userNames, assignmentConflictEvents } = opts;
  const missingDriverUsers = opts.missingDriverUsers ?? [];
  const conflicts = assignmentConflictEvents ?? [];

  const items: ExceptionItem[] = [];
  const MAX_PER_USER = 5;

  for (const alert of alerts) {
    const mapping = ALERT_MAPPINGS[alert.id];
    if (!mapping) continue;

    const aggregateId = `transport-${alert.id}-${today}`;

    items.push({
      id: aggregateId,
      category: 'transport-alert',
      severity: mapping.severity,
      title: mapping.title,
      description: alert.message,
      targetDate: today,
      updatedAt: today,
      actionLabel: mapping.actionLabel,
      actionPath: mapping.actionPath,
    });

    if (alert.id === 'transport-stale-count' && details) {
      const staleSlice = details.staleUsers.slice(0, MAX_PER_USER);
      for (const stale of staleSlice) {
        const name = resolveName(stale.userCode, userNames);
        items.push({
          id: `transport-stale-${stale.userCode}-${stale.direction}-${today}`,
          parentId: aggregateId,
          category: 'transport-alert',
          severity: stale.minutesElapsed >= 60 ? 'high' : 'medium',
          title: `${name}（${dirLabel(stale.direction)}）が${stale.minutesElapsed}分以上停滞中`,
          description: `「移動中」のまま ${stale.minutesElapsed} 分が経過しています。ステータスの更新漏れがないか確認してください。`,
          targetUser: name,
          targetUserId: stale.userCode,
          targetDate: today,
          updatedAt: today,
          actionLabel: `${name}の${dirLabel(stale.direction)}タブを開く`,
          actionPath: `/today?highlight=${encodeURIComponent(stale.userCode)}&direction=${stale.direction}`,
        });
      }
    }

    if (alert.id === 'transport-sync-fail-count' && details) {
      const syncSlice = details.syncFailedUsers.slice(0, MAX_PER_USER);
      for (const sf of syncSlice) {
        const name = resolveName(sf.userCode, userNames);
        items.push({
          id: `transport-sync-${sf.userCode}-${sf.direction}-${today}`,
          parentId: aggregateId,
          category: 'transport-alert',
          severity: 'critical',
          title: `${name}（${dirLabel(sf.direction)}）の実績同期に失敗`,
          description: sf.errorMessage || 'AttendanceDaily への同期に失敗しました。',
          targetUser: name,
          targetUserId: sf.userCode,
          targetDate: today,
          updatedAt: today,
          actionLabel: `${name}の${dirLabel(sf.direction)}タブを開く`,
          actionPath: `/today?highlight=${encodeURIComponent(sf.userCode)}&direction=${sf.direction}`,
        });
      }
    }

    if (alert.id === 'transport-missing-driver-assignment') {
      const missingSlice = missingDriverUsers.slice(0, MAX_PER_USER);
      for (const missing of missingSlice) {
        const name = missing.userName ?? resolveName(missing.userCode, userNames);
        items.push({
          id: `transport-missing-driver-${missing.userCode}-${missing.direction}-${today}`,
          parentId: aggregateId,
          category: 'transport-alert',
          severity: 'high',
          title: `${name}（${dirLabel(missing.direction)}）は${missing.vehicleId}で運転者未設定`,
          description: `${missing.vehicleId} の運転者が未設定のままです。配車を確認して運転担当を設定してください。`,
          targetUser: name,
          targetUserId: missing.userCode,
          targetDate: today,
          updatedAt: today,
          actionLabel: `${name}の${dirLabel(missing.direction)}を開く`,
          actionPath: `/today?highlight=${encodeURIComponent(missing.userCode)}&direction=${missing.direction}`,
        });
      }
    }
  }

  for (const conflict of conflicts) {
    if (conflict.reason !== 'retry_exhausted' && conflict.reason !== 'item_gone') {
      continue;
    }

    const title = conflict.reason === 'retry_exhausted'
      ? '配車情報の競合を自動解決できませんでした'
      : '更新対象の配車情報が見つかりません（削除された可能性があります）';

    const description = conflict.reason === 'retry_exhausted'
      ? `他者による同時編集が繰り返されたため、自動マージに失敗しました（ID: ${conflict.itemId}）。手動で再設定してください。`
      : `更新しようとした配車情報（ID: ${conflict.itemId}）が削除されているか、別の場所に移動した可能性があります。`;

    items.push({
      id: `transport-conflict-${conflict.itemId}-${conflict.timestamp}`,
      category: 'transport-alert',
      severity: 'critical',
      title,
      description,
      targetDate: today,
      updatedAt: new Date(conflict.timestamp).toISOString(),
      actionLabel: '配車設定を確認',
      actionPath: '/today',
    });
  }

  return items;
}
