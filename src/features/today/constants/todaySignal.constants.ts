import type { TodaySignalCode, TodaySignalPriority, SignalAudience } from '../types/todaySignal.types';

export interface SignalDisplayConfig {
  prefix: string;
  defaultActionLabel: string;
  priority: TodaySignalPriority;
  audience: SignalAudience[];
}

export const TODAY_SIGNAL_DISPLAY_CONFIG: Record<TodaySignalCode, SignalDisplayConfig> = {
  daily_record_missing: {
    prefix: '【未記録】',
    defaultActionLabel: '日々の記録へ',
    priority: 'P0',
    audience: ['staff'],
  },
  health_record_missing: {
    prefix: '【入力待ち】',
    defaultActionLabel: '健康記録へ',
    priority: 'P1',
    audience: ['staff'],
  },
  handoff_unread: {
    prefix: '【未読の申し送り】',
    defaultActionLabel: '申し送りを確認',
    priority: 'P1',
    audience: ['all'],
  },
  monitoring_overdue: {
    prefix: '【期限超過】',
    defaultActionLabel: 'モニタリングへ',
    priority: 'P0',
    audience: ['admin'],
  },
  monitoring_due_soon: {
    prefix: '【期日接近】',
    defaultActionLabel: 'モニタリングへ',
    priority: 'P1',
    audience: ['admin'],
  },
  risk_health_alert: {
    prefix: '【要配慮】',
    defaultActionLabel: '詳細を見る',
    priority: 'P0',
    audience: ['all'],
  },
};
