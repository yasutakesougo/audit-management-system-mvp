/**
 * @fileoverview 通知監査ログ Viewer のための ViewModel と Selector
 */
import type { 
  NotificationAuditLog, 
  NotificationAuditStatus 
} from './notificationAuditTypes';
import type { NotificationChannel } from './notificationTypes';
import type { EscalationLevel } from './escalationTypes';

/**
 * フィルター状態
 */
export interface NotificationAuditFilterState {
  status: NotificationAuditStatus | 'all';
  channel: NotificationChannel | 'all';
  level: EscalationLevel | 'all';
  userId?: string;
  sourceExceptionId?: string;
  traceId?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * 表示用行モデル
 */
export interface NotificationAuditRowModel {
  id: string;
  traceId: string;
  createdAt: string;
  status: NotificationAuditStatus;
  channel: NotificationChannel;
  level: EscalationLevel;
  userName: string;
  title: string;
  reasons: string[];
  isFailed: boolean;
  isSuppressed: boolean;
  original: NotificationAuditLog; // 詳細表示用
}

/**
 * 統計サマリ
 */
export interface NotificationAuditSummary {
  total: number;
  sentCount: number;
  failedCount: number;
  suppressedCount: number;
  channelStats: Record<NotificationChannel, number>;
  latestTimestamp?: string;
}

/**
 * ログの絞り込み (Pure Selector)
 */
export function filterAuditLogs(
  logs: NotificationAuditLog[], 
  filters: NotificationAuditFilterState
): NotificationAuditLog[] {
  return logs.filter(log => {
    if (filters.status !== 'all' && log.status !== filters.status) return false;
    if (filters.channel !== 'all' && log.channel !== filters.channel) return false;
    if (filters.level !== 'all' && log.escalationLevel !== filters.level) return false;
    if (filters.userId && log.userId !== filters.userId) return false;
    if (filters.traceId && log.traceId !== filters.traceId) return false;
    if (filters.sourceExceptionId && log.sourceExceptionId !== filters.sourceExceptionId) return false;
    
    if (filters.startDate) {
      if (new Date(log.createdAt) < new Date(filters.startDate)) return false;
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      if (new Date(log.createdAt) > end) return false;
    }
    
    return true;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * 統計情報の計算
 */
export function calculateAuditSummary(logs: NotificationAuditLog[]): NotificationAuditSummary {
  const summary: NotificationAuditSummary = {
    total: logs.length,
    sentCount: 0,
    failedCount: 0,
    suppressedCount: 0,
    channelStats: { 'in-app': 0, teams: 0, push: 0, email: 0 },
    latestTimestamp: logs.length > 0 ? logs[0].createdAt : undefined
  };

  for (const log of logs) {
    if (log.status === 'sent') summary.sentCount++;
    else if (log.status === 'failed') summary.failedCount++;
    else if (log.status === 'suppressed') summary.suppressedCount++;

    summary.channelStats[log.channel]++;
  }

  return summary;
}
