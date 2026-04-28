import {
    Autocomplete,
    Box,
    CircularProgress,
    Tab,
    Tabs,
    TextField,
    Typography,
} from '@mui/material';
import LandscapeRoundedIcon from '@mui/icons-material/LandscapeRounded';
import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { buildSupportPlanMonitoringUrl } from '@/app/links/navigationLinks';

import { useFeatureFlag } from '@/config/featureFlags';
import { canAccessDashboardAudience, isDashboardAudience, useAuthStore } from '@/features/auth/store';
import { useUsersStore } from '@/features/users/store';
import { isDebugFlag } from '@/lib/debugFlag';
import { getMsalInstance } from '@/lib/msal';
import { getEnv } from '@/lib/runtimeEnv';
import { TESTIDS } from '@/testids';
import { toLocalDateISO } from '@/utils/getNow';

import { IcebergPdcaFormSection } from './IcebergPdcaFormSection';
import { IcebergPdcaMetrics } from './IcebergPdcaMetrics';
import { AbcEvidencePanel } from './components/AbcEvidencePanel';
import { IcebergPdcaEmptyState } from './components/IcebergPdcaEmptyState';
import { IcebergStructureTab } from './components/IcebergStructureTab';
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
import type { IcebergPdcaItem, IcebergPdcaPhase, PhaseChangeTrace } from './types';

// ============================================================================
// Constants
// ============================================================================

const TAB_KEYS = ['trend', 'iceberg', 'pdca'] as const;
type TabKey = (typeof TAB_KEYS)[number];

const TAB_LABELS: Record<TabKey, string> = {
  trend: '傾向',
  iceberg: '氷山構造',
  pdca: '改善サイクル',
};

function isValidTab(v: string | null): v is TabKey {
  return TAB_KEYS.includes(v as TabKey);
}

// ============================================================================
// Component
// ============================================================================

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

  // ── Tab state (URL synced) ──
  const rawTab = searchParams.get('tab');
  const activeTab: TabKey = isValidTab(rawTab) ? rawTab : 'trend';

  const handleTabChange = (_: React.SyntheticEvent, newValue: TabKey) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', newValue);
    setSearchParams(next, { replace: true });
  };

  // ── User options ──
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
  const urlPlanningSheetId = searchParams.get('planningSheetId') ?? undefined;
  const urlPdcaId = searchParams.get('pdcaId') ?? undefined;
  const urlSource = searchParams.get('source') ?? undefined;
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
    selectedUserId
      ? { userId: selectedUserId, planningSheetId: urlPlanningSheetId }
      : undefined,
  );

  // Merge phase change traces from ref into items (in-memory only)
  const phaseTraceRef = React.useRef<Map<string, PhaseChangeTrace>>(new Map());
  const itemsWithTrace = React.useMemo(() => {
    if (phaseTraceRef.current.size === 0) return items;
    return items.map((item) => {
      const trace = phaseTraceRef.current.get(item.id);
      if (!trace) return item;
      return { ...item, lastPhaseChange: trace };
    });
  }, [items]);

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

  const createMutation = useCreatePdca(selectedUserId, urlPlanningSheetId);
  const updateMutation = useUpdatePdca(selectedUserId, urlPlanningSheetId);
  const deleteMutation = useDeletePdca(selectedUserId, urlPlanningSheetId);

  const isAdmin = canAccessDashboardAudience(role, 'admin');
  const writeEnabledRaw = writeEnabledProp ?? getEnv('VITE_WRITE_ENABLED');
  const writeEnabled = writeEnabledRaw === '1' || writeEnabledRaw === 'true' || writeEnabledRaw === true;
  const canWrite = isAdmin || (isDashboardAudience(role, 'staff') && writeEnabled);
  const isMutating =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const [deleteTarget, setDeleteTarget] = React.useState<IcebergPdcaItem | null>(null);
  const [snackbar, setSnackbar] = React.useState<string | null>(null);

  const debugEnabled = isDebugFlag(getEnv('VITE_AUDIT_DEBUG'));
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
      // Check if phase changed during edit — record trace
      const existing = itemsWithTrace.find((i) => i.id === formState.id);
      if (existing && existing.phase !== formState.phase) {
        phaseTraceRef.current.set(formState.id, {
          from: existing.phase,
          to: formState.phase,
          at: new Date().toISOString(),
          by: getCurrentUserName(),
        });
      }

      await updateMutation.mutateAsync({
        id: formState.id,
        planningSheetId: urlPlanningSheetId,
        title: formState.title.trim(),
        summary: formState.summary,
        phase: formState.phase,
      });
    } else {
      await createMutation.mutateAsync({
        userId: selectedUserId,
        planningSheetId: urlPlanningSheetId,
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

  const PHASE_LABELS: Record<IcebergPdcaPhase, string> = {
    PLAN: 'Plan',
    DO: 'Do',
    CHECK: 'Check',
    ACT: 'Act',
  };

  // ── Helper: get current user name from MSAL ──
  const getCurrentUserName = React.useCallback((): string => {
    try {
      const instance = getMsalInstance();
      const account = instance.getActiveAccount() as { name?: string; username?: string } | null;
      return account?.name ?? account?.username ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }, []);


  const handleAdvancePhase = async (item: IcebergPdcaItem, nextPhase: IcebergPdcaPhase) => {
    const trace: PhaseChangeTrace = {
      from: item.phase,
      to: nextPhase,
      at: new Date().toISOString(),
      by: getCurrentUserName(),
    };

    // Store trace in ref for persistence across cache invalidations
    phaseTraceRef.current.set(item.id, trace);

    await updateMutation.mutateAsync({
      id: item.id,
      phase: nextPhase,
    });
    setSnackbar(`「${item.title}」を ${PHASE_LABELS[nextPhase]} へ移動しました`);
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
    : status === 'success' && itemsWithTrace.length === 0 && !canWrite
      ? isAdmin
        ? 'no-items-admin'
        : 'no-items-staff'
      : null;

  // ── PDCA tab content ──
  const renderPdcaContent = () => {
    if (context) {
      return (
        <IcebergPdcaEmptyState
          context={context}
          role={role}
          onSelectUser={() => {
            focusUserFilter();
          }}
        />
      );
    }
    if (status === 'loading') {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={20} />
          <Typography variant="body2">読み込み中…</Typography>
        </Box>
      );
    }
    return (
      <IcebergPdcaFormSection
        items={itemsWithTrace}
        canWrite={canWrite}
        selectedUserId={selectedUserId}
        isMutating={isMutating}
        formState={formState}
        setFormState={setFormState}
        onSubmit={handleSubmit}
        onStartEdit={startEdit}
        onDelete={askDelete}
        onAdvancePhase={handleAdvancePhase}
        deleteTarget={deleteTarget}
        onCloseDelete={closeDelete}
        onConfirmDelete={handleDelete}
        isDeleting={deleteMutation.isPending}
        snackbar={snackbar}
        onCloseSnackbar={() => setSnackbar(null)}
        snapshotWarning={snapshotWarning}
        onCloseSnapshotWarning={() => setSnapshotWarning(null)}
        onNavigateToMonitoring={(userId) => navigate(buildSupportPlanMonitoringUrl(userId))}
        highlightPdcaId={urlPdcaId}
        source={urlSource}
      />
    );
  };

  return (
    <Box data-testid={TESTIDS['iceberg-pdca-root']} sx={{ py: 2 }}>
      {/* ── Page Header (共通コンテキスト帯) ── */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <LandscapeRoundedIcon color="primary" />
          <Typography variant="h5" component="h1" fontWeight={700}>
            氷山分析
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          行動の背景を構造化し、支援を設計する
        </Typography>

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
      </Box>

      {/* ── Tab Navigation ── */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            '& .MuiTab-root': {
              fontWeight: 600,
              textTransform: 'none',
              fontSize: '0.9rem',
            },
          }}
        >
          {TAB_KEYS.map((key) => (
            <Tab key={key} value={key} label={TAB_LABELS[key]} />
          ))}
        </Tabs>
      </Box>

      {/* ── Tab Content ── */}

      {/* Tab 1: 傾向 */}
      {activeTab === 'trend' && (
        <Box>
          {selectedUserId ? (
            <AbcEvidencePanel userId={selectedUserId} />
          ) : (
            <IcebergPdcaEmptyState
              context="no-user-selected"
              role={role}
              onSelectUser={focusUserFilter}
            />
          )}
        </Box>
      )}

      {/* Tab 2: 氷山構造 */}
      {activeTab === 'iceberg' && (
        <Box>
          {selectedUserId ? (
            <IcebergStructureTab userId={selectedUserId} />
          ) : (
            <IcebergPdcaEmptyState
              context="no-user-selected"
              role={role}
              onSelectUser={focusUserFilter}
            />
          )}
        </Box>
      )}

      {/* Tab 3: 改善サイクル */}
      {activeTab === 'pdca' && (
        <Box>
          {/* KPIカード — 改善サイクル側に配置 */}
          <IcebergPdcaMetrics
            resolvedDailyMetrics={resolvedDailyMetricsValue}
            weeklyMetrics={weeklyMetrics}
            monthlyMetrics={monthlyMetrics}
            trendPeriod={trendPeriod}
            setTrendPeriod={setTrendPeriod}
            supportRecordJumpTo={supportRecordJumpTo}
            today={today}
          />
          {renderPdcaContent()}
        </Box>
      )}
    </Box>
  );
};

export default IcebergPdcaPage;
