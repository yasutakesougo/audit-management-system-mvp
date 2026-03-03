/**
 * IRC — Filter bar with unrecorded-only toggle and event count chips.
 */
import {
    Chip,
    FormControlLabel,
    Paper,
    Stack,
    Switch,
    Typography,
} from '@mui/material';
import React from 'react';

export interface IrcFilterBarProps {
  showOnlyUnrecorded: boolean;
  onToggleUnrecorded: (checked: boolean) => void;
  totalEvents: number;
  recordedEvents: number;
  visibleEvents: number;
}

export const IrcFilterBar: React.FC<IrcFilterBarProps> = ({
  showOnlyUnrecorded,
  onToggleUnrecorded,
  totalEvents,
  recordedEvents,
  visibleEvents,
}) => (
  <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="subtitle2" component="span" color="text.secondary">
          表示設定
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={showOnlyUnrecorded}
              onChange={(_event, checked) => onToggleUnrecorded(checked)}
              color="primary"
              data-testid="irc-filter-toggle"
            />
          }
          label="未記録のみ表示"
        />
      </Stack>
      <Stack direction="row" spacing={2} alignItems="center">
        <Chip
          label={`総イベント: ${totalEvents}件`}
          size="small"
          variant="outlined"
          color="default"
          data-testid="irc-total-events"
        />
        <Chip
          label={`記録済み: ${recordedEvents}件`}
          size="small"
          variant="outlined"
          color="success"
          data-testid="irc-recorded-events"
        />
        <Chip
          label={`表示中: ${visibleEvents}件`}
          size="small"
          variant="filled"
          color="primary"
          data-testid="irc-visible-events"
        />
      </Stack>
    </Stack>
  </Paper>
);

export default IrcFilterBar;
