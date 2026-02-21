import * as React from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Snackbar,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSearchParams } from 'react-router-dom';

import { useFeatureFlag } from '@/config/featureFlags';
import { useAuthStore } from '@/features/auth/store';
import { useUsersStore } from '@/features/users/store';
import { getEnv } from '@/lib/runtimeEnv';
import { TESTIDS } from '@/testids';

import { IcebergPdcaEmptyState } from './components/IcebergPdcaEmptyState';
import type { IcebergPdcaEmptyContext } from './components/icebergPdcaEmptyCopy';
import {
  getDailySubmissionMetrics,
  getMonthlyMetrics,
  getStoredDailySubmissionEvents,
  getWeeklyMetrics,
  type TrendDirection,
} from './dailyMetricsAdapter';
import { useIcebergPdcaList, useCreatePdca, useUpdatePdca, useDeletePdca } from './queries';
import type { IcebergPdcaItem, IcebergPdcaPhase } from './types';

type IcebergPdcaPageProps = {
  writeEnabled?: boolean;
};

export const IcebergPdcaPage: React.FC<IcebergPdcaPageProps> = ({ writeEnabled: writeEnabledProp }) => {
  const role = useAuthStore((s) => s.currentUserRole);
  const icebergPdca = useFeatureFlag('icebergPdca');
  const { data: users = [], status: usersStatus } = useUsersStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const userFilterRef = React.useRef<HTMLInputElement | null>(null);

  const userOptions = React.useMemo(
    () =>
      users
        .filter((u) => (u.IsActive ?? true) && (u.FullName ?? '').trim().length > 0)
        .map((u) => ({
          id: u.UserID ?? String(u.Id),
          label: u.FullName ?? '',
        })),
    [users],
  );

  const selectedUserId = searchParams.get('userId') ?? undefined;
  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const targetUserIds = React.useMemo(
    () => users.filter((u) => u.IsActive !== false).map((u) => u.UserID ?? String(u.Id)),
    [users],
  );
  const dailyMetrics = React.useMemo(
    () => getDailySubmissionMetrics({ recordDate: today, targetUserIds }),
    [today, targetUserIds],
  );
  const allSubmissionEvents = React.useMemo(() => getStoredDailySubmissionEvents(), [today]);
  const weeklyMetrics = React.useMemo(
    () => getWeeklyMetrics({ events: allSubmissionEvents, targetUserIds, referenceDate: new Date(today) }),
    [allSubmissionEvents, targetUserIds, today],
  );
  const monthlyMetrics = React.useMemo(
    () => getMonthlyMetrics({ events: allSubmissionEvents, targetUserIds, referenceDate: new Date(today) }),
    [allSubmissionEvents, targetUserIds, today],
  );
  const completionRateLabel = `${Math.round(dailyMetrics.completionRate * 100)}%`;
  const leadTimeLabel = `${dailyMetrics.averageLeadTimeMinutes}分`;
  const weeklyCompletionLabel = `${Math.round(weeklyMetrics.current.completionRate * 100)}%`;
  const monthlyCompletionLabel = `${Math.round(monthlyMetrics.current.completionRate * 100)}%`;
  const weeklyLeadTimeLabel = `${weeklyMetrics.current.averageLeadTimeMinutes}分`;
  const monthlyLeadTimeLabel = `${monthlyMetrics.current.averageLeadTimeMinutes}分`;
  const trendLabel = (trend: TrendDirection): string => {
    if (trend === 'up') return '↑';
    if (trend === 'down') return '↓';
    return '→';
  };
  const selectedOption = React.useMemo(
    () => userOptions.find((opt) => opt.id === selectedUserId) ?? null,
    [selectedUserId, userOptions],
  );

  const handleUserChange = (_: unknown, option: { id: string; label: string } | null) => {
    const next = new URLSearchParams(searchParams);
    if (option?.id) {
      next.set('userId', option.id);
    } else {
      next.delete('userId');
    }
    setSearchParams(next, { replace: true });
  };

  const focusUserFilter = () => {
    userFilterRef.current?.focus();
  };

  const { data: items = [], status } = useIcebergPdcaList(
    selectedUserId ? { userId: selectedUserId } : undefined,
  );

  const [formState, setFormState] = React.useState<{
    mode: 'create' | 'edit';
    id?: string;
    title: string;
    summary: string;
    phase: IcebergPdcaPhase;
  }>({ mode: 'create', title: '', summary: '', phase: 'PLAN' });

  React.useEffect(() => {
    setFormState({ mode: 'create', title: '', summary: '', phase: 'PLAN' });
  }, [selectedUserId]);

  const createMutation = useCreatePdca(selectedUserId);
  const updateMutation = useUpdatePdca(selectedUserId);
  const deleteMutation = useDeletePdca(selectedUserId);

  const isAdmin = role === 'admin';
  const writeEnabledRaw = writeEnabledProp ?? getEnv('VITE_WRITE_ENABLED');
  const writeEnabled = writeEnabledRaw === '1' || writeEnabledRaw === 'true' || writeEnabledRaw === true;
  const canWrite = isAdmin || (role === 'staff' && writeEnabled);
  const isMutating =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const [deleteTarget, setDeleteTarget] = React.useState<IcebergPdcaItem | null>(null);
  const [snackbar, setSnackbar] = React.useState<string | null>(null);

  const debugEnabled = getEnv('VITE_AUDIT_DEBUG') === '1';
  if (import.meta.env.DEV && debugEnabled) {
    console.log('[iceberg-pdca]', {
      role,
      isAdmin,
      writeEnabled,
      canWrite,
      selectedUserId,
    });
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedUserId) return;
    if (!formState.title.trim()) return;

    if (formState.mode === 'edit' && formState.id) {
      await updateMutation.mutateAsync({
        id: formState.id,
        title: formState.title.trim(),
        summary: formState.summary,
        phase: formState.phase,
      });
    } else {
      await createMutation.mutateAsync({
        userId: selectedUserId,
        title: formState.title.trim(),
        summary: formState.summary,
        phase: formState.phase,
      });
    }

    setFormState({ mode: 'create', title: '', summary: '', phase: 'PLAN' });
  };

  const startEdit = (item: IcebergPdcaItem) => {
    setFormState({
      mode: 'edit',
      id: item.id,
      title: item.title,
      summary: item.summary,
      phase: item.phase,
    });
  };

  const askDelete = (item: IcebergPdcaItem) => setDeleteTarget(item);
  const closeDelete = () => setDeleteTarget(null);
  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync({ id: deleteTarget.id });
    setDeleteTarget(null);
    setSnackbar('削除しました');
  };

  if (!icebergPdca) {
    return (
      <Box data-testid={TESTIDS['iceberg-pdca-root']} sx={{ py: 2 }}>
        <IcebergPdcaEmptyState context="flag-off" role={role} />
      </Box>
    );
  }

  const context: IcebergPdcaEmptyContext | null = !selectedUserId
    ? 'no-user-selected'
    : status === 'success' && items.length === 0 && !canWrite
      ? isAdmin
        ? 'no-items-admin'
        : 'no-items-staff'
      : null;

  return (
    <Box data-testid={TESTIDS['iceberg-pdca-root']} sx={{ py: 2 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
        氷山PDCA
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        行動の背景・気づき・改善を「見える化」する支援設計ツール
      </Typography>

      <Stack spacing={2} sx={{ mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Paper variant="outlined" sx={{ p: 1.5, minWidth: 220 }} data-testid={TESTIDS['pdca-daily-completion-card']}>
            <Typography variant="caption" color="text.secondary">当日入力完了率</Typography>
            <Typography variant="h6" data-testid={TESTIDS['pdca-daily-completion-value']}>
              {completionRateLabel}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {dailyMetrics.submittedCount}/{dailyMetrics.targetCount} 名
            </Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 1.5, minWidth: 220 }} data-testid={TESTIDS['pdca-daily-leadtime-card']}>
            <Typography variant="caption" color="text.secondary">未送信解消リードタイム</Typography>
            <Typography variant="h6" data-testid={TESTIDS['pdca-daily-leadtime-value']}>
              {leadTimeLabel}
            </Typography>
            <Typography variant="caption" color="text.secondary">平均</Typography>
          </Paper>
        </Stack>

        <Paper variant="outlined" sx={{ p: 1.5 }} data-testid={TESTIDS['pdca-daily-trend-card']}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>週次 / 月次トレンド</Typography>
          <Stack spacing={0.5}>
            <Typography variant="body2" data-testid={TESTIDS['pdca-weekly-completion-trend']}>
              週次完了率 {weeklyCompletionLabel} {trendLabel(weeklyMetrics.completionTrend)}
            </Typography>
            <Typography variant="body2" data-testid={TESTIDS['pdca-monthly-completion-trend']}>
              月次完了率 {monthlyCompletionLabel} {trendLabel(monthlyMetrics.completionTrend)}
            </Typography>
            <Typography variant="body2" data-testid={TESTIDS['pdca-weekly-leadtime-trend']}>
              週次平均リードタイム {weeklyLeadTimeLabel} {trendLabel(weeklyMetrics.leadTimeTrend)}
            </Typography>
            <Typography variant="body2" data-testid={TESTIDS['pdca-monthly-leadtime-trend']}>
              月次平均リードタイム {monthlyLeadTimeLabel} {trendLabel(monthlyMetrics.leadTimeTrend)}
            </Typography>
          </Stack>
        </Paper>

        <Autocomplete
          options={userOptions}
          value={selectedOption}
          loading={usersStatus === 'idle' || usersStatus === 'loading'}
          onChange={handleUserChange}
          getOptionLabel={(opt) => opt.label}
          isOptionEqualToValue={(opt, val) => opt.id === val.id}
          renderInput={(params) => (
            <TextField
              {...params}
              label="利用者で絞り込み"
              placeholder="田中 太郎"
              size="small"
              inputRef={(node) => {
                const ref = params.InputProps.ref;
                if (typeof ref === 'function') {
                  ref(node);
                } else if (ref) {
                  (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
                }
                userFilterRef.current = node;
              }}
            />
          )}
        />
      </Stack>

      {context ? (
        <IcebergPdcaEmptyState
          context={context}
          role={role}
          onSelectUser={() => {
            focusUserFilter();
          }}
        />
      ) : status === 'loading' ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={20} />
          <Typography variant="body2">読み込み中…</Typography>
        </Box>
      ) : (
        <Box>
          {canWrite && selectedUserId && (
            <Paper sx={{ p: 2, mb: 2 }} variant="outlined" component="form" onSubmit={handleSubmit}>
              <Stack spacing={1.5}>
                <Typography variant="subtitle1">
                  {formState.mode === 'edit' ? 'PDCAを編集' : 'PDCAを新規作成'}
                </Typography>
                <TextField
                  label="タイトル"
                  size="small"
                  value={formState.title}
                  onChange={(e) => setFormState((prev) => ({ ...prev, title: e.target.value }))}
                  required
                />
                <TextField
                  label="概要"
                  size="small"
                  multiline
                  minRows={2}
                  value={formState.summary}
                  onChange={(e) => setFormState((prev) => ({ ...prev, summary: e.target.value }))}
                />
                <FormControl size="small">
                  <InputLabel id="pdca-phase-label">Phase</InputLabel>
                  <Select
                    labelId="pdca-phase-label"
                    label="Phase"
                    value={formState.phase}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, phase: e.target.value as IcebergPdcaPhase }))
                    }
                  >
                    <MenuItem value="PLAN">PLAN</MenuItem>
                    <MenuItem value="DO">DO</MenuItem>
                    <MenuItem value="CHECK">CHECK</MenuItem>
                    <MenuItem value="ACT">ACT</MenuItem>
                  </Select>
                </FormControl>
                <Stack direction="row" spacing={1}>
                  <Button
                    type="submit"
                    variant="contained"
                    size="small"
                    disabled={!selectedUserId || !formState.title.trim() || isMutating}
                  >
                    {formState.mode === 'edit' ? '保存' : '作成'}
                  </Button>
                  {formState.mode === 'edit' && (
                    <Button
                      type="button"
                      variant="text"
                      size="small"
                      onClick={() => setFormState({ mode: 'create', title: '', summary: '', phase: 'PLAN' })}
                      disabled={isMutating}
                    >
                      キャンセル
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Paper>
          )}

          <Stack spacing={1.5}>
            {items.map((item) => (
              <Paper key={item.id} sx={{ p: 2 }} variant="outlined">
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      {item.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                      Phase: {item.phase} / 更新: {item.updatedAt}
                    </Typography>
                    {item.summary ? (
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {item.summary}
                      </Typography>
                    ) : null}
                  </Box>
                  {canWrite && (
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => startEdit(item)}
                        disabled={isMutating}
                      >
                        編集
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        onClick={() => askDelete(item)}
                        disabled={isMutating}
                      >
                        削除
                      </Button>
                    </Stack>
                  )}
                </Stack>
              </Paper>
            ))}
            {items.length === 0 && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                PDCA項目はまだありません。
              </Typography>
            )}
          </Stack>

          <Dialog open={Boolean(deleteTarget)} onClose={closeDelete} fullWidth maxWidth="xs">
            <DialogTitle>この記録を削除しますか？</DialogTitle>
            <DialogContent>
              <DialogContentText>削除すると元に戻せません。</DialogContentText>
              {deleteTarget ? (
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="subtitle2">{deleteTarget.title}</Typography>
                  {deleteTarget.summary ? (
                    <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                      {deleteTarget.summary}
                    </Typography>
                  ) : null}
                </Box>
              ) : null}
            </DialogContent>
            <DialogActions>
              <Button onClick={closeDelete} disabled={deleteMutation.isPending}>
                キャンセル
              </Button>
              <Button
                color="error"
                variant="contained"
                onClick={handleDelete}
                disabled={!deleteTarget || deleteMutation.isPending}
              >
                削除
              </Button>
            </DialogActions>
          </Dialog>

          <Snackbar
            open={Boolean(snackbar)}
            autoHideDuration={4000}
            onClose={() => setSnackbar(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert severity="success" onClose={() => setSnackbar(null)} sx={{ width: '100%' }}>
              {snackbar}
            </Alert>
          </Snackbar>
        </Box>
      )}
    </Box>
  );
};

export default IcebergPdcaPage;
