import { formatLastSyncCaption, type LastSyncState, type SyncSource, type SyncStatus } from '@/features/nurse/state/useLastSync';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

const buildState = (status: SyncStatus, source: SyncSource, completedAt: number, sent: number, remaining: number, error?: string): LastSyncState => ({
  status,
  source,
  sent,
  remaining,
  error: error ?? undefined,
  summary: undefined,
  updatedAt: new Date(completedAt).toISOString(),
});

const parseMinuteLabel = (label: string): number => {
  const [hours, minutes] = label.split(':').map((value) => Number.parseInt(value, 10));
  const base = new Date();
  base.setHours(Number.isNaN(hours) ? 0 : hours, Number.isNaN(minutes) ? 0 : minutes, 0, 0);
  return base.getTime();
};

type SyncCaptionDemoProps = {
  ok: boolean;
  partial: boolean;
  count: number;
  remaining: number;
  source: SyncSource;
  minuteLabel: string;
  errorMessage: string;
  timeZone?: string;
};

const SyncCaptionDemo: React.FC<SyncCaptionDemoProps> = ({
  ok,
  partial,
  count,
  remaining,
  source,
  minuteLabel,
  errorMessage,
  timeZone: _timeZone,
}) => {
  const completedAt = parseMinuteLabel(minuteLabel);
  let status: SyncStatus;
  if (!ok) {
    status = 'error';
  } else if (partial) {
    status = 'success';
  } else if (count > 0) {
    status = 'success';
  } else {
    status = 'idle';
  }
  const state = buildState(status, source, completedAt, count, remaining, ok ? undefined : errorMessage);
  const caption = formatLastSyncCaption(state);
  return (
    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, maxWidth: 320 }}>
      <Typography variant="caption" role="status" data-testid="nurse-sync-status">
        {caption}
      </Typography>
    </Box>
  );
};

const meta = {
  title: 'Nurse/Status/SyncCaption',
  component: SyncCaptionDemo,
  tags: ['autodocs'],
  args: {
    ok: true,
    partial: false,
    count: 3,
    remaining: 0,
    source: 'manual',
    minuteLabel: '09:12',
    errorMessage: 'NETWORK',
    timeZone: 'Asia/Tokyo',
  },
  parameters: {
    a11y: { disable: false },
  },
} satisfies Meta<typeof SyncCaptionDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Partial: Story = {
  args: {
    ok: true,
    partial: true,
    count: 2,
    remaining: 1,
  },
};

export const Empty: Story = {
  args: {
    ok: true,
    partial: false,
    count: 0,
    remaining: 0,
  },
};

export const Error: Story = {
  args: {
    ok: false,
    partial: false,
    count: 0,
    remaining: 0,
    errorMessage: 'Timeout while flushing',
  },
};
