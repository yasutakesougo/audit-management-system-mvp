export type Severity = 'info' | 'warning' | 'error';

export interface DashboardAlert {
  id: string;
  module: 'attendance' | 'activity' | 'irc' | 'cross';
  severity: Severity;
  title: string;
  message: string;
  href?: string; // クリックで飛ぶURL（/daily/..., /admin/...）
}

export interface ModuleSummary {
  name: 'attendance' | 'activity' | 'irc';
  label: string;
  total: number;
  done: number;
  rate: number; // 0–100
}

export interface DashboardSummary {
  modules: ModuleSummary[];
  alerts: DashboardAlert[];
  generatedAt: string;
}