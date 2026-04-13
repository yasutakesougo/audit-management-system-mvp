import type { TodaySignalCode, TodaySignalPriority, SignalAudience } from '../types/todaySignal.types';

export type TodaySignalSeverity = 'danger' | 'warning' | 'info';
export type TodaySignalGroup = 'daily' | 'planning' | 'analytics';

export interface SignalDisplayConfig {
  prefix: string;
  defaultActionLabel: string;
  priority: TodaySignalPriority;
  audience: SignalAudience[];
  severity: TodaySignalSeverity;
  group: TodaySignalGroup;
}

export const TODAY_SIGNAL_DISPLAY_CONFIG: Record<TodaySignalCode, SignalDisplayConfig> = {
  daily_record_missing: {
    prefix: '【未記録】',
    defaultActionLabel: '日々の記録へ',
    priority: 'P0',
    audience: ['staff'],
    severity: 'danger',
    group: 'daily',
  },
  health_record_missing: {
    prefix: '【入力待ち】',
    defaultActionLabel: '健康記録へ',
    priority: 'P1',
    audience: ['staff'],
    severity: 'warning',
    group: 'daily',
  },
  handoff_unread: {
    prefix: '【未読の申し送り】',
    defaultActionLabel: '申し送りを確認',
    priority: 'P1',
    audience: ['all'],
    severity: 'warning',
    group: 'daily',
  },
  monitoring_overdue: {
    prefix: '【期限超過】',
    defaultActionLabel: 'モニタリングへ',
    priority: 'P0',
    audience: ['admin'],
    severity: 'danger',
    group: 'planning',
  },
  monitoring_due_soon: {
    prefix: '【期日接近】',
    defaultActionLabel: 'モニタリングへ',
    priority: 'P1',
    audience: ['admin'],
    severity: 'warning',
    group: 'planning',
  },
  isp_renew_suggest: {
    prefix: '【計画見直し】',
    defaultActionLabel: 'ISP見直しへ',
    priority: 'P2',
    audience: ['admin'],
    severity: 'info',
    group: 'planning',
  },
  risk_health_alert: {
    prefix: '【要配慮】',
    defaultActionLabel: '詳細を見る',
    priority: 'P0',
    audience: ['all'],
    severity: 'danger',
    group: 'analytics',
  },
};
