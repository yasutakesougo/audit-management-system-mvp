/**
 * IRC — Calendar CSS variables and inline style block.
 *
 * Kept separate so the container and calendar grid remain style-free.
 */
import type { Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';
import React from 'react';

/**
 * MUI テーマから FullCalendar 用 CSS custom properties を生成
 */
export function buildIrcCssVars(theme: Theme): React.CSSProperties {
  return {
    '--irc-visit-bg': alpha(theme.palette.primary.main, 0.12),
    '--irc-visit-border': theme.palette.primary.main,
    '--irc-travel-bg': alpha('#9C27B0', 0.08),
    '--irc-travel-border': '#9C27B0',
    '--irc-break-bg': alpha(theme.palette.success?.main ?? '#4caf50', 0.10),
    '--irc-break-border': theme.palette.success?.dark ?? '#388e3c',
    '--irc-in-progress': theme.palette.primary.main,
    '--irc-completed': theme.palette.success?.main ?? '#4caf50',
    '--irc-delayed': theme.palette.warning.main,
    '--irc-delayed-bg': alpha(theme.palette.warning.main, 0.12),
    '--irc-cancelled-bg': alpha(theme.palette.error.main, 0.08),
    '--irc-pulse-mid': theme.palette.primary.light ?? theme.palette.primary.main,
  } as React.CSSProperties;
}

/**
 * FullCalendar イベント用インライン CSS
 */
export const IRC_CALENDAR_CSS = `
  .unified-event {
    border-radius: 4px;
    overflow: hidden;
  }

  .event-type-visit {
    background-color: var(--irc-visit-bg);
    border-left: 4px solid var(--irc-visit-border);
  }

  .event-type-travel {
    background-color: var(--irc-travel-bg);
    border-left: 4px solid var(--irc-travel-border);
  }

  .event-type-break {
    background-color: var(--irc-break-bg);
    border-left: 4px solid var(--irc-break-border);
  }

  .event-status-waiting {
    opacity: 0.7;
  }

  .event-status-in-progress {
    border: 2px solid var(--irc-in-progress);
    animation: pulse 2s infinite;
  }

  .event-status-completed {
    border: 2px solid var(--irc-completed);
  }

  .event-status-delayed {
    border: 2px solid var(--irc-delayed);
    background-color: var(--irc-delayed-bg) !important;
  }

  .event-status-cancelled {
    background-color: var(--irc-cancelled-bg) !important;
    opacity: 0.5;
    text-decoration: line-through;
  }

  .fc-event-warning-bg {
    background-color: rgba(255, 0, 0, 0.15) !important;
    border: none !important;
  }

  .fc-event-warning-bg:hover {
    background-color: rgba(255, 0, 0, 0.25) !important;
  }

  @keyframes pulse {
    0% { border-color: var(--irc-in-progress); }
    50% { border-color: var(--irc-pulse-mid); }
    100% { border-color: var(--irc-in-progress); }
  }
`;
