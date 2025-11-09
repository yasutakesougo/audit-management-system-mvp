import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { expect, screen, userEvent, within } from '@storybook/test';
import type { FlushEntrySummary, FlushSummary } from '@/features/nurse/state/useNurseSync';
import SyncNowButton from './SyncNowButton';

const meta: Meta<typeof SyncNowButton> = {
  title: 'Nurse/Components/SyncNowButton',
  component: SyncNowButton,
};

export default meta;

type Story = StoryObj<typeof SyncNowButton>;

const createEntry = (userId: string, status: FlushEntrySummary['status'], error?: string): FlushEntrySummary => ({
  userId,
  status,
  kind: 'observation',
  ...(error ? { error } : {}),
});

const makeSummary = (overrides: Partial<FlushSummary>, source: FlushSummary['source'] = 'manual'): FlushSummary => {
  const entries = overrides.entries ?? [];
  const totalCount = overrides.totalCount ?? entries.length;
  return {
    sent: overrides.sent ?? 0,
    remaining: overrides.remaining ?? 0,
    okCount: overrides.okCount ?? 0,
    errorCount: overrides.errorCount ?? 0,
    partialCount: overrides.partialCount ?? 0,
    entries,
    totalCount,
    source,
    bpSent: overrides.bpSent ?? 0,
    durationMs: overrides.durationMs ?? 0,
    attempts: overrides.attempts ?? 0,
    failureSamples: overrides.failureSamples ?? [],
  };
};

export const SlowSuccess: Story = {
  name: 'Success (600ms latency)',
  render: () => (
    <Box sx={{ display: 'grid', gap: 2, width: 420 }}>
      <Typography variant="body2" color="text.secondary">
        600msの遅延後、3件送信・残り0件の成功トーストを表示します。
      </Typography>
      <SyncNowButton
        runFlush={async (_sp, _options) => {
          await new Promise((resolve) => setTimeout(resolve, 600));
          const source = _options?.source ?? 'manual';
          return makeSummary({
            sent: 3,
            remaining: 0,
            okCount: 3,
            entries: [
              createEntry('I101', 'ok'),
              createEntry('I102', 'ok'),
              createEntry('I103', 'ok'),
            ],
          }, source);
        }}
      />
    </Box>
  ),
};

export const Partial: Story = {
  name: 'Partial (1 sent, 2 remaining)',
  render: () => (
    <Box sx={{ display: 'grid', gap: 2, width: 420 }}>
      <Typography variant="body2" color="text.secondary">
        一部のみ送信できたケースのトーストと文言確認用。
      </Typography>
      <SyncNowButton
        runFlush={async (_sp, _options) => {
          await new Promise((resolve) => setTimeout(resolve, 300));
          const source = _options?.source ?? 'manual';
          return makeSummary({
            sent: 1,
            remaining: 2,
            okCount: 1,
            partialCount: 1,
            errorCount: 1,
            entries: [
              createEntry('I201', 'ok'),
              createEntry('I202', 'partial'),
              createEntry('I203', 'error', 'SharePoint timeout'),
            ],
          }, source);
        }}
      />
    </Box>
  ),
};

export const ErrorCase: Story = {
  name: 'Network Error',
  render: () => (
    <Box sx={{ display: 'grid', gap: 2, width: 420 }}>
      <Typography variant="body2" color="text.secondary">
        ネットワークエラー（例外）を投げ、エラートーストを表示します。
      </Typography>
      <SyncNowButton
        runFlush={async (_sp, _options) => {
          await new Promise((resolve) => setTimeout(resolve, 300));
          throw new Error('Network unreachable');
        }}
      />
    </Box>
  ),
};

export const DisabledEmptyQueue: Story = {
  name: 'Disabled (empty queue)',
  render: () => (
    <Box sx={{ display: 'grid', gap: 2, width: 420 }}>
      <Typography variant="body2" color="text.secondary">
        保留データがない場合。ボタンは非活性で、トーストは表示されません。
      </Typography>
      <SyncNowButton
        runFlush={async (_sp, _options) => makeSummary({ sent: 0, remaining: 0 }, _options?.source ?? 'manual')}
        disabled
      />
    </Box>
  ),
};

export const Offline: Story = {
  name: 'Offline (disabled)',
  render: () => (
    <Box sx={{ display: 'grid', gap: 2, width: 420 }}>
      <Alert severity="info" role="status">
        オフライン中：再接続後に同期を再開できます。
      </Alert>
      <SyncNowButton
        runFlush={async (_sp, _options) => makeSummary({ sent: 0, remaining: 0 }, _options?.source ?? 'manual')}
        disabled
      />
    </Box>
  ),
};

export const SlowSuccessPlay: Story = {
  name: 'Success (play: focus & toast)',
  render: SlowSuccess.render,
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button', { name: /同期/ });
    await userEvent.click(button);
    const toast = await screen.findByText(/全3件を同期しました/);
    expect(toast).toBeInTheDocument();
    expect(button).toHaveFocus();
  },
};
