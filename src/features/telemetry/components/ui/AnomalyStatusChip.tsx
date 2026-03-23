export type AnomalyStatus = 'ok' | 'warning' | 'unknown';

type AnomalyStatusChipProps = {
  status: AnomalyStatus;
  count?: number;
  label?: string;
};

type DeriveStatusInput = {
  totalEvents: number;
  warningCount: number;
};

export function deriveAnomalyUiStatus({
  totalEvents,
  warningCount,
}: DeriveStatusInput): AnomalyStatus {
  if (totalEvents <= 0) return 'unknown';
  if (warningCount > 0) return 'warning';
  return 'ok';
}

export function AnomalyStatusChip({
  status,
  count,
  label = 'Anomaly',
}: AnomalyStatusChipProps) {
  const isWarning = status === 'warning';
  const isUnknown = status === 'unknown';

  const icon = isWarning ? '⚠️' : isUnknown ? '❔' : '✅';
  const text = isWarning ? 'warning' : isUnknown ? 'unknown' : 'ok';
  const bg = isWarning ? '#fff7ed' : isUnknown ? '#f8fafc' : '#ecfdf5';
  const fg = isWarning ? '#b45309' : isUnknown ? '#64748b' : '#065f46';
  const border = isWarning ? '#fdba74' : isUnknown ? '#cbd5e1' : '#86efac';
  const countLabel = isWarning && typeof count === 'number' ? ` (${count})` : '';

  return (
    <span
      aria-label={`${label} ${text}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        borderRadius: 999,
        border: `1px solid ${border}`,
        background: bg,
        color: fg,
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{label}: {text}{countLabel}</span>
    </span>
  );
}
