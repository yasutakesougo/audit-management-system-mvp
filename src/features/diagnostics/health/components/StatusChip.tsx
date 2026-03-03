/**
 * StatusChip — Extracted from HealthDiagnosisPage for reusability.
 */
import { Chip } from '@mui/material';
import type { HealthStatus } from '../types';

export const statusColor = (s: HealthStatus): 'success' | 'warning' | 'error' => {
  switch (s) {
    case 'pass':
      return 'success';
    case 'warn':
      return 'warning';
    case 'fail':
    default:
      return 'error';
  }
};

export function StatusChip({ status }: { status: HealthStatus }) {
  return (
    <Chip
      size="small"
      label={status.toUpperCase()}
      color={statusColor(status)}
    />
  );
}
