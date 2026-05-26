import React from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { toLocalDateISO } from '@/utils/getNow';
import { useUsers } from '@/features/users/useUsers';
import type { IUserMaster } from '@/features/users/types';
import { appendKioskSearchParams } from '../utils/navigation';
import {
  TOILET_AMOUNT_LABELS,
  TOILET_TYPE_LABELS,
  type ToiletAmount,
  type ToiletRecord,
  type ToiletType,
} from './types';
import { useToiletRecords } from './useToiletRecords';

type FormState = {
  occurredAt: string;
  toiletType: ToiletType;
  amount: ToiletAmount;
  memo: string;
};

const toMinuteInputValue = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
};

const formatRecordTime = (occurredAt: string): string => {
  const date = new Date(occurredAt);
  if (Number.isNaN(date.getTime())) return occurredAt.slice(11, 16);
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
};

const resolveUserKey = (user: IUserMaster): string => user.UserID || String(user.Id);

const findLatestRecord = (records: ToiletRecord[], userId: string): ToiletRecord | undefined =>
  records.find((record) => record.userId === userId);

export const ToiletDailyBoard: React.FC = () => {
  const location = useLocation();
  const todayIso = toLocalDateISO(new Date());
  const { data: users, isLoading: isUsersLoading } = useUsers({ selectMode: 'core' });
  const { records, create, isLoading: isRecordsLoading } = useToiletRecords(todayIso);
  const isLoading = isUsersLoading || isRecordsLoading;
  const [selectedUser, setSelectedUser] = React.useState<IUserMaster | null>(null);
  const [form, setForm] = React.useState<FormState>({
    occurredAt: toMinuteInputValue(new Date()),
    toiletType: 'urination',
    amount: 'normal',
    memo: '',
  });

  const targetUsers = React.useMemo(
    () =>
      users
        .filter((user) => user.IsActive !== false)
        .filter((user) => user.RequiresToiletGuidance === true),
    [users],
  );

  const rows = React.useMemo(
    () =>
      targetUsers.map((user) => {
        const latestRecord = findLatestRecord(records, resolveUserKey(user));
        return { user, latestRecord, recorded: Boolean(latestRecord) };
      }),
    [records, targetUsers],
  );

  const recordedCount = rows.filter((row) => row.recorded).length;
  const unrecordedCount = rows.length - recordedCount;
  const recordsByUserKey = React.useMemo(() => {
    const grouped = new Map<string, ToiletRecord[]>();
    records.forEach((record) => {
      const existing = grouped.get(record.userId) ?? [];
      grouped.set(record.userId, [...existing, record]);
    });
    return grouped;
  }, [records]);

  const openForm = (user: IUserMaster) => {
    setSelectedUser(user);
    setForm({
      occurredAt: toMinuteInputValue(new Date()),
      toiletType: 'urination',
      amount: 'normal',
      memo: '',
    });
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    try {
      await create({
        userId: resolveUserKey(selectedUser),
        occurredAt: new Date(form.occurredAt).toISOString(),
        toiletType: form.toiletType,
        amount: form.amount,
        memo: form.memo,
        recorderName: 'kiosk',
      });
    } catch (err) {
      console.error('[ToiletDailyBoard] Failed to save record:', err);
    } finally {
      setSelectedUser(null);
    }
  };

  return (
    <Box data-testid="toilet-daily-board" sx={{ p: { xs: 2, md: 4 }, pb: 16, maxWidth: 1040, mx: 'auto' }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <IconButton
          component={RouterLink}
          to={appendKioskSearchParams('/kiosk', location.search)}
          sx={{ bgcolor: 'action.hover' }}
          data-testid="toilet-board-back"
          aria-label="キオスクへ戻る"
        >
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 900 }}>
            本日のトイレ確認
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {todayIso}
          </Typography>
        </Box>
        <Chip
          data-testid="toilet-board-summary"
          color={unrecordedCount > 0 ? 'warning' : 'success'}
          label={`未記録 ${unrecordedCount}名 / 記録済み ${recordedCount}名`}
          sx={{ height: 40, borderRadius: 2, fontWeight: 800, fontSize: '0.95rem' }}
        />
      </Stack>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={48} />
        </Box>
      ) : (
        <Stack spacing={3}>
          <Grid container spacing={1.5}>
            {rows.map(({ user, latestRecord, recorded }) => (
              <Grid key={user.Id} size={12}>
                <Paper
                  data-testid={`toilet-user-row-${resolveUserKey(user)}`}
                  variant="outlined"
                  sx={{
                    p: { xs: 1.5, md: 2 },
                    borderRadius: 2,
                    borderColor: recorded ? 'success.light' : 'warning.light',
                    bgcolor: recorded ? 'rgba(46, 125, 50, 0.06)' : 'rgba(237, 108, 2, 0.08)',
                  }}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
                    <Chip
                      icon={recorded ? <CheckCircleIcon /> : <ErrorOutlineIcon />}
                      color={recorded ? 'success' : 'warning'}
                      label={recorded ? '済' : '未'}
                      sx={{ width: 72, borderRadius: 2, fontWeight: 900 }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                        {user.FullName}
                      </Typography>
                      <Typography data-testid={`toilet-user-latest-${resolveUserKey(user)}`} color="text.secondary" sx={{ mt: 0.5 }}>
                        {latestRecord
                          ? `${formatRecordTime(latestRecord.occurredAt)} ${TOILET_TYPE_LABELS[latestRecord.toiletType]} ${TOILET_AMOUNT_LABELS[latestRecord.amount]}`
                          : '最終記録なし'}
                      </Typography>
                    </Box>
                    <Button
                      data-testid={`toilet-record-button-${resolveUserKey(user)}`}
                      variant={recorded ? 'outlined' : 'contained'}
                      color={recorded ? 'primary' : 'warning'}
                      startIcon={<AddCircleOutlineIcon />}
                      onClick={() => openForm(user)}
                      sx={{ minHeight: 48, px: 3, borderRadius: 2, fontWeight: 900 }}
                    >
                      {recorded ? '追加記録' : '記録する'}
                    </Button>
                  </Stack>
                </Paper>
              </Grid>
            ))}

            {rows.length === 0 && (
              <Grid size={12}>
                <Paper variant="outlined" sx={{ p: 5, textAlign: 'center', borderRadius: 2 }}>
                  <Typography color="text.secondary">トイレ誘導対象の利用者がいません</Typography>
                </Paper>
              </Grid>
            )}
          </Grid>

          <Paper data-testid="toilet-record-history" variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
              <Typography variant="h6" component="h2" sx={{ fontWeight: 900 }}>
                本日の全記録（個人別）
              </Typography>
              <Chip label={`${records.length}件`} size="small" sx={{ borderRadius: 1, fontWeight: 800 }} />
            </Stack>
            <Stack spacing={1.25}>
              {targetUsers.map((user) => {
                const userKey = resolveUserKey(user);
                const userRecords = recordsByUserKey.get(userKey) ?? [];

                return (
                  <Box
                    key={userKey}
                    data-testid={`toilet-history-user-${userKey}`}
                    sx={{
                      p: 1.25,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1.5,
                    }}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: userRecords.length > 0 ? 1 : 0 }}>
                      <Typography sx={{ fontWeight: 900 }}>{user.FullName}</Typography>
                      <Chip label={`${userRecords.length}件`} size="small" variant="outlined" sx={{ borderRadius: 1, fontWeight: 800 }} />
                    </Stack>

                    {userRecords.length === 0 ? (
                      <Typography color="text.secondary">記録なし</Typography>
                    ) : (
                      <Stack spacing={0.75}>
                        {userRecords.map((record) => (
                          <Box
                            key={record.id}
                            data-testid={`toilet-history-record-${record.id}`}
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: { xs: '1fr', sm: '96px 120px 120px 1fr' },
                              gap: { xs: 0.5, sm: 1.5 },
                              alignItems: 'center',
                              p: 1,
                              borderRadius: 1.25,
                              bgcolor: 'action.hover',
                            }}
                          >
                            <Typography sx={{ fontWeight: 900 }}>{formatRecordTime(record.occurredAt)}</Typography>
                            <Typography color="text.secondary">{TOILET_TYPE_LABELS[record.toiletType]}</Typography>
                            <Typography color="text.secondary">{TOILET_AMOUNT_LABELS[record.amount]}</Typography>
                            <Typography color="text.secondary">{record.memo || 'メモなし'}</Typography>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Box>
                );
              })}
            </Stack>
          </Paper>
        </Stack>
      )}

      <Dialog open={Boolean(selectedUser)} onClose={() => setSelectedUser(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>
          {selectedUser ? `${selectedUser.FullName}さんのトイレ記録` : 'トイレ記録'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="利用者"
              value={selectedUser?.FullName ?? ''}
              InputProps={{ readOnly: true }}
              fullWidth
            />
            <TextField
              label="時間"
              type="datetime-local"
              value={form.occurredAt}
              onChange={(event) => setForm((prev) => ({ ...prev, occurredAt: event.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <FormControl fullWidth>
              <InputLabel id="toilet-type-label">種類</InputLabel>
              <Select
                labelId="toilet-type-label"
                label="種類"
                value={form.toiletType}
                onChange={(event) => setForm((prev) => ({ ...prev, toiletType: event.target.value as ToiletType }))}
              >
                {Object.entries(TOILET_TYPE_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="toilet-amount-label">量</InputLabel>
              <Select
                labelId="toilet-amount-label"
                label="量"
                value={form.amount}
                onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value as ToiletAmount }))}
              >
                {Object.entries(TOILET_AMOUNT_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="メモ"
              value={form.memo}
              onChange={(event) => setForm((prev) => ({ ...prev, memo: event.target.value }))}
              multiline
              minRows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setSelectedUser(null)}>キャンセル</Button>
          <Button data-testid="toilet-record-save" variant="contained" onClick={handleSave}>
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
