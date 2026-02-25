import { Alert, AlertTitle, Button, Typography } from '@mui/material';
import type { SchedulesErrorInfo } from '../errors';

export interface ScheduleReadOnlyAlertProps {
  readOnlyReason?: SchedulesErrorInfo | null;
}

/**
 * ScheduleReadOnlyAlert - Alert banner for read-only mode
 * 
 * Displays an info/warning alert when schedules are in read-only mode,
 * with optional action button for resolving the issue.
 */
export function ScheduleReadOnlyAlert({ readOnlyReason }: ScheduleReadOnlyAlertProps) {
  if (!readOnlyReason) {
    return null;
  }

  return (
    <Alert
      severity={readOnlyReason.kind === 'WRITE_DISABLED' ? 'info' : 'warning'}
      sx={{ mb: 2 }}
      action={
        readOnlyReason.action ? (
          <Button
            color="inherit"
            size="small"
            onClick={readOnlyReason.action.onClick}
            href={readOnlyReason.action.href}
          >
            {readOnlyReason.action.label}
          </Button>
        ) : undefined
      }
    >
      <AlertTitle>{readOnlyReason.title}</AlertTitle>
      {readOnlyReason.message}
      {readOnlyReason.details && readOnlyReason.details.length > 0 && (
        <Typography variant="caption" component="div" sx={{ mt: 1, opacity: 0.8 }}>
          {readOnlyReason.details.join(' / ')}
        </Typography>
      )}
    </Alert>
  );
}
