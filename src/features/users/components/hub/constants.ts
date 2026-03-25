export const URGENCY_COLORS: Record<string, string> = {
  high: '#d32f2f',
  medium: '#ed6c02',
  low: '#388e3c',
};

export const PLAN_TYPE_COLORS: Record<string, string> = {
  long: '#1e88e5',
  short: '#43a047',
  support: '#f4511e',
};

export const PLAN_TYPE_LABELS: Record<string, string> = {
  long: '長期',
  short: '短期',
  support: '支援',
};

export const URGENCY_PALETTE = {
  critical: { border: '#d32f2f', bg: '#fff5f5', text: '#b71c1c', icon: '🔴' },
  high:     { border: '#ed6c02', bg: '#fff8f0', text: '#e65100', icon: '🟠' },
  medium:   { border: '#1976d2', bg: '#f0f7ff', text: '#0d47a1', icon: '🔵' },
  low:      { border: '#388e3c', bg: '#f0fff4', text: '#1b5e20', icon: '✅' },
} as const;
