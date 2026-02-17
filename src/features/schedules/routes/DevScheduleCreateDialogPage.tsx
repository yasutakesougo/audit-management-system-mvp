import ScheduleCreateDialog from './ScheduleCreateDialog';
import type { CreateScheduleEventInput } from '../data';
import type { ScheduleUserOption } from '@/features/schedules/domain';
import { TESTIDS } from '@/testids';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useCallback, useMemo, useState } from 'react';

const DEMO_USERS: ScheduleUserOption[] = [
  { id: 'dev-user-1', name: '開発用 利用者A', lookupId: '9001' },
  { id: 'dev-user-2', name: '開発用 利用者B', lookupId: '9002' },
];

const DEV_INITIAL_DATE = '2025-11-24';

export default function DevScheduleCreateDialogPage() {
  const [open, setOpen] = useState(false);
  const [lastPayload, setLastPayload] = useState<CreateScheduleEventInput | null>(null);

  const defaultUser = useMemo(() => DEMO_USERS[0], []);

  const handleSubmit = useCallback(async (input: CreateScheduleEventInput) => {
    setLastPayload(input);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <Stack spacing={3} sx={{ p: 3 }} data-testid={TESTIDS['dev-schedule-dialog-page']}>
      <div>
        <Typography variant="overline" color="text.secondary">
          Dev Harness
        </Typography>
        <Typography variant="h5" component="h1">
          ScheduleCreateDialog
        </Typography>
        <Typography variant="body2" color="text.secondary">
          開発・E2E 検証専用のダイアログ単体テストページです。
        </Typography>
      </div>

      <Button
        variant="contained"
        size="large"
        onClick={() => setOpen(true)}
        data-testid={TESTIDS['dev-schedule-dialog-open']}
      >
        予定を追加（DEV）
      </Button>

      {lastPayload && (
        <Paper component="pre" sx={{ p: 2, maxWidth: 480, overflowX: 'auto' }} aria-live="polite">
          {JSON.stringify(lastPayload, null, 2)}
        </Paper>
      )}

      <ScheduleCreateDialog
        open={open}
        onClose={handleClose}
        onSubmit={handleSubmit}
        users={DEMO_USERS}
        initialDate={DEV_INITIAL_DATE}
        defaultUser={defaultUser}
        mode="create"
      />
    </Stack>
  );
}
