import {
    Autocomplete,
    Box,
    CircularProgress,
    TextField,
    Typography,
} from '@mui/material';
import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { buildSupportPlanMonitoringUrl } from '@/app/links/navigationLinks';

import { useFeatureFlag } from '@/config/featureFlags';
import { canAccessDashboardAudience, isDashboardAudience, useAuthStore } from '@/features/auth/store';
import { useUsersStore } from '@/features/users/store';
import { getEnv } from '@/lib/runtimeEnv';
import { TESTIDS } from '@/testids';
import { toLocalDateISO } from '@/utils/getNow';

import { IcebergPdcaFormSection } from './IcebergPdcaFormSection';
import { IcebergPdcaMetrics } from './IcebergPdcaMetrics';
import { IcebergPdcaEmptyState } from './components/IcebergPdcaEmptyState';
import type { IcebergPdcaEmptyContext } from './components/icebergPdcaEmptyCopy';
import {
    getDailySubmissionMetrics,
    getMonthlyMetrics,
    getStoredDailySubmissionEvents,
    getWeeklyMetrics,
} from './dailyMetricsAdapter';
import { resolveDailyMetrics } from './icebergPdcaHelpers';
import { useCreatePdca, useDeletePdca, useIcebergPdcaList, useUpdatePdca } from './queries';
import { readDailySnapshot, type DailySnapshotMetrics } from './readDailySnapshot';
import type { IcebergPdcaItem, IcebergPdcaPhase } from './types';

type IcebergPdcaPageProps = {
  writeEnabled?: boolean;
};

export const IcebergPdcaPage: React.FC<IcebergPdcaPageProps> = ({ writeEnabled: writeEnabledProp }) => {
  const role = useAuthStore((s) => s.currentUserRole);
  const icebergPdca = useFeatureFlag('icebergPdca');
  const { data: users = [], status: usersStatus } = useUsersStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const userFilterRef = React.useRef<HTMLInputElement | null>(null);
  const [trendPeriod, setTrendPeriod] = React.useState<'weekly' | 'monthly'>('weekly');

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
  const today = React.useMemo(() => toLocalDateISO(), []);
  const [dailySnapshotMetrics, setDailySnapshotMetrics] = React.useState<DailySnapshotMetrics | null>(null);
  const [snapshotWarning, setSnapshotWarning] = React.useState<string | null>(null);
  const orgId = getEnv('VITE_FIREBASE_ORG_ID') ?? 'demo-org';
  const templateId = 'daily-support.v1';
  const supportRecordJumpTo = React.useMemo(() => {
    const params = new URLSearchParams({ date: today });
    if (selectedUserId) {
      params.set('userId', selectedUserId);
    }
    return `/daily/support?${params.toString()}`;
  }, [selectedUserId, today]);
  const targetUserIds = React.useMemo(
    () => (selectedUserId
      ? [selectedUserId]
      : users.filter((u) => u.IsActive !== false).map((u) => u.UserID ?? String(u.Id))),
    [selectedUserId, users],
  );
  const dailyMetrics = React.useMemo(
    () => getDailySubmissionMetrics({ recordDate: today, targetUserIds }),
    [today, targetUserIds],
  );
  React.useEffect(() => {
    let disposed = false;

    const loadSnapshot = async () => {
      if (!selectedUserId) {
        setDailySnapshotMetrics(null);
        setSnapshotWarning(null);
        return;
      }

      try {
        const snapshotResult = await readDailySnapshot({
          orgId,
          templateId,
          targetDate: today,
          targetUserId: selectedUserId,
        });

        if (!disposed) {
          if (snapshotResult.status === 'ok') {
            setDailySnapshotMetrics(snapshotResult.metrics);
            setSnapshotWarning(null);
            return;
          }

          setDailySnapshotMetrics(null);
          if (snapshotResult.status === 'invalid') {
            console.warn('[iceberg-pdca] invalid daily snapshot detected', {
              orgId,
              templateId,
              targetDate: today,
              targetUserId: selectedUserId,
              reason: snapshotResult.reason,
            });
            setSnapshotWarning('CHECK用スナップショットに不整合があるため、集計値を代替表示しています。');
            return;
          }

          setSnapshotWarning(null);
        }
      } catch (error) {
        if (!disposed) {
          console.error('[iceberg-pdca] daily snapshot read failed', error);
          setDailySnapshotMetrics(null);
          setSnapshotWarning('CHECK用スナップショットの取得に失敗したため、集計値を代替表示しています。');
        }
      }
    };

    void loadSnapshot();

    return () => {
      disposed = true;
    };
  }, [orgId, selectedUserId, templateId, today]);

  const resolvedDailyMetricsValue = React.useMemo(
    () => resolveDailyMetrics(dailyMetrics, dailySnapshotMetrics),
    [dailyMetrics, dailySnapshotMetrics],
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

  const isAdmin = canAccessDashboardAudience(role, 'admin');
  const writeEnabledRaw = writeEnabledProp ?? getEnv('VITE_WRITE_ENABLED');
  const writeEnabled = writeEnabledRaw === '1' || writeEnabledRaw === 'true' || writeEnabledRaw === true;
  const canWrite = isAdmin || (isDashboardAudience(role, 'staff') && writeEnabled);
  const isMutating =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const [deleteTarget, setDeleteTarget] = React.useState<IcebergPdcaItem | null>(null);
  const [snackbar, setSnackbar] = React.useState<string | null>(null);

  const debugEnabled = getEnv('VITE_AUDIT_DEBUG') === '1';
  if (import.meta.env.DEV && debugEnabled) {
    // eslint-disable-next-line no-console
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

      <IcebergPdcaMetrics
        resolvedDailyMetrics={resolvedDailyMetricsValue}
        weeklyMetrics={weeklyMetrics}
        monthlyMetrics={monthlyMetrics}
        trendPeriod={trendPeriod}
        setTrendPeriod={setTrendPeriod}
        supportRecordJumpTo={supportRecordJumpTo}
        today={today}
      />

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
        sx={{ mb: 2 }}
      />

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
        <IcebergPdcaFormSection
          items={items}
          canWrite={canWrite}
          selectedUserId={selectedUserId}
          isMutating={isMutating}
          formState={formState}
          setFormState={setFormState}
          onSubmit={handleSubmit}
          onStartEdit={startEdit}
          onDelete={askDelete}
          deleteTarget={deleteTarget}
          onCloseDelete={closeDelete}
          onConfirmDelete={handleDelete}
          isDeleting={deleteMutation.isPending}
          snackbar={snackbar}
          onCloseSnackbar={() => setSnackbar(null)}
          snapshotWarning={snapshotWarning}
          onCloseSnapshotWarning={() => setSnapshotWarning(null)}
          onNavigateToMonitoring={(userId) => navigate(buildSupportPlanMonitoringUrl(userId))}
        />
      )}
    </Box>
  );
};

export default IcebergPdcaPage;
