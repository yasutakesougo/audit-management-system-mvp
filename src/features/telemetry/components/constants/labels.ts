import type { DateRange } from '../../hooks/useTelemetryDashboard';

export const PHASE_LABELS: Record<string, string> = {
  'am-operation': '午前活動',
  'pm-operation': '午後活動',
  'night-operation': '夜間対応',
  'reception': '受入・送迎',
  'lunch': '昼食',
  'break': '休憩',
};

export const TYPE_LABELS: Record<string, string> = {
  todayops_landing: '📍 ランディング',
  todayops_cta_click: '👆 CTAクリック',
  todayops_first_navigation: '🧭 初回ナビ',
  operational_phase_event: '⚡ フェーズイベント',
};

export const TYPE_SHORT: Record<string, string> = {
  todayops_landing: 'landing',
  todayops_cta_click: 'cta',
  todayops_first_navigation: 'nav',
  operational_phase_event: 'phase',
};

export const TYPE_COLORS: Record<string, string> = {
  todayops_landing: '#3b82f6',
  todayops_cta_click: '#f59e0b',
  todayops_first_navigation: '#10b981',
  operational_phase_event: '#8b5cf6',
};

export const RANGE_LABELS: Record<DateRange, string> = {
  today: '今日',
  '7d': '7日間',
  '30d': '30日間',
};
