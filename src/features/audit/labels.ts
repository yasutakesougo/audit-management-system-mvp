// Centralized labels for audit metric pills (future i18n hook point)
export const auditMetricLabels = {
  new: '新規',
  duplicates: '重複',
  failed: '失敗'
} as const;

export type AuditMetricKey = keyof typeof auditMetricLabels;
