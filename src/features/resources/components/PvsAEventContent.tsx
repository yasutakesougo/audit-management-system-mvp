/**
 * PvsA Event Content — cell renderer for FullCalendar events.
 *
 * Pure presentational: receives an EventContentArg and renders the
 * status icon, time range, progress bar, and status chip.
 */
import type { EventContentArg } from '@fullcalendar/core';
import { Box, Chip, LinearProgress, Typography } from '@mui/material';
import React from 'react';

import { formatTime, getStatusIcon } from '../ircEventLogic';
import type { UnifiedResourceEvent } from '../types';

export interface PvsAEventContentProps extends EventContentArg {}

export const PvsAEventContent: React.FC<PvsAEventContentProps> = ({ event }) => {
  const props = event.extendedProps as UnifiedResourceEvent['extendedProps'];
  const { status, actualStart, actualEnd, percentComplete, diffMinutes } = props;

  return (
    <Box
      className="pvsA-event-content"
      sx={{
        p: 0.5,
        fontSize: '11px',
        lineHeight: 1.2,
        overflow: 'hidden',
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block' }}>
        {getStatusIcon(status)} {event.title}
      </Typography>

      <Box className="time-info">
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
          計画: {formatTime(event.startStr)} - {formatTime(event.endStr || '')}
        </Typography>

        {actualStart && actualEnd && (
          <Typography variant="caption" sx={{ display: 'block', color: 'primary.main' }}>
            実績: {formatTime(actualStart)} - {formatTime(actualEnd)}
          </Typography>
        )}
      </Box>

      {status === 'in-progress' && percentComplete !== undefined && (
        <Box sx={{ mt: 0.5 }}>
          <LinearProgress
            variant="determinate"
            value={percentComplete}
            sx={{ height: 3 }}
          />
          <Typography variant="caption" sx={{ fontSize: '10px' }}>
            {percentComplete}%
          </Typography>
        </Box>
      )}

      {status === 'delayed' && diffMinutes && diffMinutes > 0 && (
        <Chip
          label={`+${diffMinutes}分`}
          size="small"
          color="warning"
          sx={{ fontSize: '9px', height: 16, mt: 0.5 }}
        />
      )}

      {status === 'completed' && (
        <Chip
          label="完了"
          size="small"
          color="success"
          sx={{ fontSize: '9px', height: 16, mt: 0.5 }}
        />
      )}
    </Box>
  );
};

export default PvsAEventContent;
