declare global {
  interface Window {
    __ORG_NAME__?: string;
    __ORG_ADDRESS__?: string;
    __ORG_TEL__?: string;
    __ORG_FAX__?: string;
    __AVAILABLE_ROUTES__?: string[];
  }
}
import { canAccess } from '@/auth/roles';
import { useAuth } from '@/auth/useAuth';
import { useUserAuthz } from '@/auth/useUserAuthz';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useIspRepositories } from '@/features/support-plan-guide/hooks/useIspRepositories';
import { useRegulatorySummary } from '@/features/support-plan-guide/hooks/useRegulatorySummary';
import { useSupportPlanBundle } from '@/features/support-plan-guide/hooks/useSupportPlanBundle';
import { useSupportPlanForm } from '@/features/support-plan-guide/hooks/useSupportPlanForm';
import { useSuggestionDecisionPersistence } from '@/features/support-plan-guide/hooks/useSuggestionDecisionPersistence';
import { usePlanRole } from '@/features/support-plan-guide/hooks/usePlanRole';
import { useIcebergPdcaList } from '@/features/ibd/analysis/pdca/queries/useIcebergPdcaList';

import { useIcebergEvidence } from '@/features/ibd/analysis/pdca/queries/useIcebergEvidence';
import type {
    SectionKey,
    SupportPlanDraft
} from '@/features/support-plan-guide/types';
import {
    FIELD_KEYS,
} from '@/features/support-plan-guide/types';
import { computeRequiredCompletion } from '@/features/support-plan-guide/domain/progress';
import { getAllSubsFlat } from '@/features/support-plan-guide/domain/tabRoute';
import { findSectionKeyByFieldKey } from '@/features/support-plan-guide/domain/sectionMeta';
import SupportPlanTabHeader from '@/features/support-plan-guide/components/SupportPlanTabHeader';
import { useUsersStore } from '@/features/users/store';
import { HYDRATION_FEATURES, startFeatureSpan } from '@/hydration/features';
import { TESTIDS, tid } from '@/testids';
import { cancelIdle, runOnIdle } from '@/utils/runOnIdle';
import CloudDoneRoundedIcon from '@mui/icons-material/CloudDoneRounded';
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded';
import CloudSyncRoundedIcon from '@mui/icons-material/CloudSyncRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';

import React, { Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Lazy-loaded tab components (code-split to stay under 70 kB budget)
const OverviewTab = React.lazy(() => import('@/features/support-plan-guide/components/tabs/OverviewTab'));
const AssessmentTab = React.lazy(() => import('@/features/support-plan-guide/components/tabs/AssessmentTab'));
const SmartTab = React.lazy(() => import('@/features/support-plan-guide/components/tabs/SmartTab'));
const SupportsTab = React.lazy(() => import('@/features/support-plan-guide/components/tabs/SupportsTab'));
const DecisionTab = React.lazy(() => import('@/features/support-plan-guide/components/tabs/DecisionTab'));
const ComplianceTab = React.lazy(() => import('@/features/support-plan-guide/components/tabs/ComplianceTab'));
const MonitoringTab = React.lazy(() => import('@/features/support-plan-guide/components/tabs/MonitoringTab'));
const RiskTab = React.lazy(() => import('@/features/support-plan-guide/components/tabs/RiskTab'));
const ExcellenceTab = React.lazy(() => import('@/features/support-plan-guide/components/tabs/ExcellenceTab'));
const PreviewTab = React.lazy(() => import('@/features/support-plan-guide/components/tabs/PreviewTab'));

// Lazy-loaded regulatory section (code-split to stay under 80 kB budget)
const RegulatorySection = React.lazy(() => import('@/features/support-plan-guide/components/RegulatorySection'));
const NextActionPanelContainer = React.lazy(() => import('@/features/support-plan-guide/components/planner-assist/NextActionPanelContainer'));

const TabFallback = <CircularProgress size={20} sx={{ m: 2 }} />;

// ────────────────────────────────────────────
// TabPanel (internal)
// ────────────────────────────────────────────

const TabPanel: React.FC<{ current: SectionKey; value: SectionKey; children: React.ReactNode }> = ({
  current,
  value,
  children,
}) => (
  <Box
    role="tabpanel"
    hidden={current !== value}
    id={`support-plan-tabpanel-${value}`}
    aria-labelledby={`support-plan-tab-${value}`}
    sx={{ mt: 2 }}
  >
    {current === value ? <Suspense fallback={TabFallback}>{children}</Suspense> : null}
  </Box>
);

// ────────────────────────────────────────────
// Page Component
// ────────────────────────────────────────────

export default function SupportPlanGuidePage() {
  // ── Auth ──
  const { role } = useUserAuthz();
  const { account } = useAuth();
  const isAdmin = canAccess(role, 'admin');
  const approverUpn = account?.username ?? '';

  // ── P4: Role-based visibility ──
  const { role: planRole, can } = usePlanRole({ isAdmin });

  // ── Data sources ──
  const { data: userList = [] } = useUsersStore();
  const location = useLocation();
  const navigate = useNavigate();

  // ── Core form logic (hook) ──
  const hook = useSupportPlanForm({
    isAdmin,
    locationSearch: location.search,
    userList,
  });

  const {
    // Sync State
    isFetching,
    isSaving,
    syncError,

    // State
    drafts,
    activeDraftId,
    activeTab,
    previewMode,
    toast: _toast,
    liveMessage,

    // Derived
    draftList,
    activeDraft,
    form,
    markdown,
    deadlines,
    auditAlertCount,
    filledCount,
    completionPercent,
    groupStatus,
    exportValidation,

    // Actions
    setActiveTab,
    setActiveDraftId,
    setPreviewMode,
    setToast,
    handleFieldChange,
    handleAppendPhrase,
    handleCopyMarkdown,
    handleDownloadMarkdown,
    handleMasterUserChange,

    // Derived
    userOptions,

    // Goal Actions (Phase 3)
    handleGoalChange,
    handleToggleDomain,
    handleAddGoal,
    handleDeleteGoal,
    handleAcceptSuggestion,
    setDrafts,

    // Compliance (A-2)
    complianceForm,

    // Confirm Dialogs
    resetConfirmDialog,
  } = hook;
  const regulatoryUserId = activeDraft?.userId != null ? String(activeDraft.userId) : null;
  const activeDraftNumericUserId =
    activeDraft?.userId == null ? null : Number.isFinite(Number(activeDraft.userId)) ? Number(activeDraft.userId) : null;

  // ── P5-B: Evidence Traceability Jump ──
  const handleJumpToEvidence = React.useCallback((sourceType: string, value: unknown) => {
    const evidence = value as { pdcaId?: string; fieldKey?: string } | null;
    // 1. Iceberg ページへジャンプ
    if (sourceType === 'iceberg_finding' && evidence?.pdcaId) {
      navigate(`/ibd/analysis/${regulatoryUserId}?pdcaId=${evidence.pdcaId}`);
      return;
    }

    // 2. 計画内のフィールドへジャンプ
    let targetField: string | null = null;
    if (sourceType === 'summary_kpi' && value === 'period') targetField = 'planPeriod';
    if (sourceType === 'diff_safety') targetField = 'riskManagement';
    if (sourceType === 'guidance_item' && evidence?.fieldKey) targetField = evidence.fieldKey;

    if (targetField) {
      const sectionKey = findSectionKeyByFieldKey(targetField);
      if (sectionKey) {
        setActiveTab(sectionKey);
        // DOMレンダリング待ちの後にスクロール
        setTimeout(() => {
          const el = document.getElementById(`field-card-${targetField}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.style.transition = 'background-color 0.5s';
            el.style.backgroundColor = 'rgba(25, 118, 210, 0.12)';
            setTimeout(() => {
              el.style.backgroundColor = '';
            }, 2000);
          }
        }, 150);
      }
    }
  }, [navigate, regulatoryUserId, setActiveTab]);

  // ── P5-C: Executable DES Action Click ──
  const handleActionClick = React.useCallback((action: { cta?: { params?: { tab?: string } } }) => {
    const targetTab = action.cta?.params?.tab as SectionKey;
    if (targetTab) {
      setActiveTab(targetTab);
    }
  }, [setActiveTab]);
  

  // ── P3-D/E/F: Suggestion Decision Persistence + Metrics ──
  const {
    smartInitialDecisions,
    memoInitialActions,
    onDecisionChange,
    onDecisionUndo,
    suggestionMetrics,
    currentDecisions,
  } = useSuggestionDecisionPersistence({ drafts, activeDraftId, setDrafts });

  // ── selectUser: Autocomplete → SelectChangeEvent adapter ──
  const selectUser = React.useCallback(
    (userId: string) => {
      // handleMasterUserChange expects a SelectChangeEvent<string>
      const syntheticEvent = { target: { value: userId } } as import('@mui/material/Select').SelectChangeEvent<string>;
      handleMasterUserChange(syntheticEvent);
    },
    [handleMasterUserChange],
  );

  // ── guardAdmin (UI-only helper) ──
  const guardAdmin = <T,>(fn: (...args: unknown[]) => T) => (...args: unknown[]): T | undefined => {
    if (!isAdmin) {
      setToast({ open: true, message: '閲覧のみです（編集は管理者権限が必要）', severity: 'info' });
      return;
    }
    return fn(...args);
  };

  // ── Hydration telemetry ──
  const markdownSpanRef = React.useRef<ReturnType<typeof startFeatureSpan> | null>(null);
  if (!markdownSpanRef.current) {
    markdownSpanRef.current = startFeatureSpan(HYDRATION_FEATURES.supportPlanGuide.markdown, {
      status: 'pending',
    });
  }

  // ── Prefetch (idle) ──
  React.useEffect(() => {
    const handle = runOnIdle(() => {
      void import('@/prefetch/routes').then(({ warmRoute, PREFETCH_KEYS }) => (
        warmRoute(() => import('@/features/audit/AuditPanel'), PREFETCH_KEYS.audit, { source: 'idle' })
      ));
    });
    return () => cancelIdle(handle);
  }, []);
  React.useEffect(() => {
    const handle = runOnIdle(() => {
      void import('@/prefetch/routes').then(({ prefetchByKey, PREFETCH_KEYS }) => {
        prefetchByKey(PREFETCH_KEYS.supportPlanGuideMarkdown, 'idle');
      });
    }, 200);
    return () => cancelIdle(handle);
  }, []);

  // ── P5-D: URL Anchor Jump ──
  React.useEffect(() => {
    if (isFetching || !activeDraftId) return;
    
    const params = new URLSearchParams(location.search);
    const anchor = params.get('anchor');
    if (!anchor) return;

    // Wait for tab content to render (lazy components)
    const timer = setTimeout(() => {
      const el = document.getElementById(`field-card-${anchor}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Visual cue: temporary highlight
        el.style.transition = 'background-color 0.5s';
        el.style.backgroundColor = 'rgba(25, 118, 210, 0.12)';
        setTimeout(() => {
          el.style.backgroundColor = '';
        }, 2000);
      }
    }, 600); // Slightly longer for safe lazy-load measure

    return () => clearTimeout(timer);
  }, [activeDraftId, location.search, isFetching]);

  // ── Shared section tab props ──
  const sectionTabProps = {
    form,
    isAdmin,
    onFieldChange: handleFieldChange,
    onAppendPhrase: handleAppendPhrase,
    guardAdmin,
    // Goal Actions (Phase 3)
    onGoalChange: handleGoalChange,
    onToggleDomain: handleToggleDomain,
    onAddGoal: handleAddGoal,
    onDeleteGoal: handleDeleteGoal,
    // User Link (利用者マスタ紐付け)
    userOptions,
    linkedUserId: activeDraft?.userId,
    linkedUserCode: activeDraft?.userCode,
    onSelectUser: selectUser,
    // P3-D: Suggestion Decision Persistence
    smartInitialDecisions,
    memoInitialActions,
    onDecisionChange,
    onDecisionUndo,
    // P3-E: Suggestion Decision Metrics
    suggestionMetrics,
    // P3-F: Raw decisions for rule-level metrics
    suggestionDecisions: currentDecisions,
    // P4: Role-based visibility
    planRole,
    can,
  };

  // ── Draft progress chip (render helper) ──
  const getDraftProgressChip = (draft: SupportPlanDraft) => {
    const progress = computeRequiredCompletion(draft.data);
    const lastUpdated = draft.updatedAt ? new Date(draft.updatedAt).toLocaleString('ja-JP') : '未記録';
    const displayName = draft.name.trim() || '未設定の利用者';
    const code = draft.userCode?.trim();
    const chipLabel = `${displayName}${code ? ` / ${code}` : ''} (${progress}%)`;
    const tooltipParts = [`必須達成: ${progress}%`, `最終更新: ${lastUpdated}`];
    if (code) {
      tooltipParts.push(`利用者コード: ${code}`);
    }
    if (draft.userId != null) {
      tooltipParts.push(`レコードID: ${draft.userId}`);
    }
    const linkedToMaster = draft.userId != null;

    return (
      <Tooltip key={draft.id} title={tooltipParts.join(' ・ ')} arrow>
        <Chip
          icon={linkedToMaster ? <VerifiedUserRoundedIcon fontSize="small" /> : undefined}
          clickable
          color={draft.id === activeDraftId ? 'primary' : 'default'}
          label={chipLabel}
          onClick={() => {
            setActiveDraftId(draft.id);
            setActiveTab('overview');
          }}
        />
      </Tooltip>
    );
  };

  // ── Tab content renderer ──
  const renderTabContent = (tabKey: SectionKey): React.ReactNode => {
    switch (tabKey) {
      case 'overview':
        return <OverviewTab {...sectionTabProps} />;
      case 'assessment':
        return <AssessmentTab {...sectionTabProps} />;
      case 'smart':
        return <SmartTab {...sectionTabProps} bundle={mergedBundle} onAcceptSuggestion={handleAcceptSuggestion} />;
      case 'supports':
        return <SupportsTab {...sectionTabProps} />;
      case 'decision':
        return <DecisionTab {...sectionTabProps} />;
      case 'compliance':
        return (
          <ComplianceTab
            isAdmin={isAdmin}
            complianceForm={complianceForm}
            approverUpn={approverUpn}
          />
        );
      case 'monitoring':
        return (
          <MonitoringTab
            {...sectionTabProps}
            userId={activeDraft?.userId}
            userName={activeDraft?.name ?? ''}
            setToast={setToast}
          />
        );
      case 'risk':
        return <RiskTab {...sectionTabProps} />;
      case 'excellence':
        return (
          <ExcellenceTab
            {...sectionTabProps}
            userId={activeDraft?.userId}
            setToast={setToast}
            memoBundle={mergedBundle}
            onPromoteToGoal={handleAcceptSuggestion}
          />
        );
      case 'preview':
        return (
          <PreviewTab
            form={form}
            markdown={markdown}
            previewMode={previewMode}
            onPreviewModeChange={setPreviewMode}
            activeDraftName={activeDraft?.name}
            isAdmin={isAdmin}
            onCopyMarkdown={handleCopyMarkdown}
            onDownloadMarkdown={handleDownloadMarkdown}
            guardAdmin={guardAdmin}
            markdownSpan={markdownSpanRef.current}
            approvalState={complianceForm.approvalState}
            groupStatus={groupStatus}
            exportValidation={exportValidation}
            userId={activeDraftNumericUserId}
            icebergItems={icebergItems}
            onJumpToEvidence={handleJumpToEvidence}
            onActionClick={handleActionClick}
          />
        );
      default:
        return null;
    }
  };

  // ════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════

  // ── Regulatory Summary (Phase E → Repository 結線) ──
  const ispRepos = useIspRepositories();
  const { bundle: realBundle } = useSupportPlanBundle(regulatoryUserId, ispRepos);

  // ── Phase D: Iceberg 実データ接続 — Dashboard と同じ evidence source を使用 ──
  // 背景分析（Iceberg）の取得
  const { data: icebergItems } = useIcebergPdcaList({ userId: regulatoryUserId });

  const { data: icebergEvidence } = useIcebergEvidence(regulatoryUserId);
  const mergedBundle = React.useMemo(() => {
    if (!realBundle) return null;
    // Iceberg 分析の実データがあれば sessionCount で上書き
    if (icebergEvidence) {
      return {
        ...realBundle,
        icebergCountBySheet: icebergEvidence.sessionCount,
      };
    }
    return realBundle;
  }, [realBundle, icebergEvidence]);

  const { bundle: regulatoryBundle, userId: linkedUserId, isAvailable: regulatoryAvailable } = useRegulatorySummary(activeDraft, mergedBundle);

  // ── P5-A: Planner Assist data resolution ──
  const icebergTotalForHud = React.useMemo(() => {
    if (!icebergEvidence?.sessionCount) return 0;
    return Object.values(icebergEvidence.sessionCount).reduce((a: number, b: number) => a + b, 0);
  }, [icebergEvidence]);

  const regulatoryHudInput = React.useMemo(() => {
    if (!regulatoryBundle || !regulatoryAvailable) return null;
    const resolvedDeadlines = deadlines ?? {
      creation: { label: '作成期限', color: 'default' as const },
      monitoring: { label: 'モニタ期限', color: 'default' as const },
    };
    return {
      ispStatus: regulatoryBundle.isp.status,
      compliance: complianceForm.compliance ?? null,
      deadlines: resolvedDeadlines,
      latestMonitoring: regulatoryBundle.latestMonitoring,
      icebergTotal: icebergTotalForHud,
    };
  }, [regulatoryBundle, regulatoryAvailable, deadlines, complianceForm.compliance, icebergTotalForHud]);

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 }, pb: 4 }}>
      <Stack spacing={2}>
        {!isAdmin && (
          <Alert severity="info" sx={{ mb: 1 }}>
            このページは閲覧のみです。編集・保存は管理者（サビ管）権限が必要です。
          </Alert>
        )}

        {/* ── P5-A: Planner Assist — Next Action Panel ── */}
        {can('plannerAssist.view') && (
          <Suspense fallback={TabFallback}>
            <NextActionPanelContainer
              bundle={mergedBundle}
              form={form}
              goals={form.goals ?? []}
              decisions={currentDecisions ?? []}
              regulatoryInput={regulatoryHudInput}
              onNavigate={(tab) => setActiveTab(tab as SectionKey)}
            />
          </Suspense>
        )}


        <Paper
          variant="outlined"
          sx={{ px: { xs: 1.5, md: 2 }, py: { xs: 1, md: 1.25 } }}
          {...tid(TESTIDS['support-plan-hud'])}
        >
          <Stack spacing={1}>
            {/* ── 制度サマリー帯（ドラフトHUD内に統合） ── */}
            {can('regulatoryHud.view') && regulatoryAvailable && (
              <Suspense fallback={TabFallback}>
                <RegulatorySection
                  bundle={regulatoryBundle}
                  linkedUserId={linkedUserId}
                  onNavigate={(url) => navigate(url)}
                  compliance={complianceForm.compliance}
                  deadlines={deadlines}
                  icebergTotal={icebergEvidence?.sessionCount ? Object.values(icebergEvidence.sessionCount).reduce((a, b) => a + b, 0) : undefined}
                  onNavigateToTab={setActiveTab}
                />
              </Suspense>
            )}

            {/* ── ドラフト一覧 + 進捗状況（1行） ── */}
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
            >
              {draftList.length > 0 ? (
                draftList.map(getDraftProgressChip)
              ) : (
                <Chip size="small" variant="outlined" label="ドラフト未作成" />
              )}
              <Chip size="small" variant="outlined" label={`必須達成: ${completionPercent}%`} />
              <Chip
                size="small"
                variant="outlined"
                label={`入力済み: ${filledCount}/${FIELD_KEYS.length}`}
              />
              {auditAlertCount > 0 && (
                <Chip
                  size="small"
                  color="warning"
                  variant="filled"
                  label={`期限超過: ${auditAlertCount}件`}
                />
              )}
              <Box sx={{ flex: 1 }} />
              {isFetching ? (
                <Chip
                  size="small"
                  icon={<CircularProgress size={14} />}
                  label="読み込み中..."
                  color="default"
                />
              ) : syncError ? (
                <Chip
                  size="small"
                  icon={<CloudOffRoundedIcon />}
                  label="通信エラー"
                  color="warning"
                />
              ) : isSaving ? (
                <Chip
                  size="small"
                  icon={<CloudSyncRoundedIcon />}
                  label="保存中..."
                  color="info"
                />
              ) : (
                <Chip
                  size="small"
                  icon={<CloudDoneRoundedIcon />}
                  label={liveMessage || '最新の状態です'}
                  color="success"
                  variant="outlined"
                />
              )}
            </Stack>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ px: { xs: 1, md: 1.5 }, py: { xs: 0.5, md: 1 } }}>
          <SupportPlanTabHeader
            activeTab={activeTab}
            onTabChange={setActiveTab}
            groupStatus={groupStatus}
          />
          {getAllSubsFlat().map((sub) => (
            <TabPanel key={sub} current={activeTab} value={sub}>
              {renderTabContent(sub)}
            </TabPanel>
          ))}
        </Paper>
      </Stack>
      <ConfirmDialog {...resetConfirmDialog} />
    </Box>
  );
}
