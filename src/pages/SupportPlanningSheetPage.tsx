/**
 * SupportPlanningSheetPage — 支援計画シート画面 (L2)
 *
 * ADR-006 準拠: 画面責務境界
 *  - 読む: PlanningSheet, Iceberg PDCA
 *  - 書く: PlanningSheet
 *  - 書かない: ISP本文
 *
 * @see docs/adr/ADR-006-screen-responsibility-boundaries.md
 * @see docs/architecture/isp-three-layer-rules.md
 */
import { useAssessmentStore } from '@/features/assessment/stores/assessmentStore';
import { EditableAssessmentSection } from '@/features/planning-sheet/components/EditableAssessmentSection';
import { EditableIntakeSection } from '@/features/planning-sheet/components/EditableIntakeSection';
import { EditableOverviewSection } from '@/features/planning-sheet/components/EditableOverviewSection';
import { EditablePlanningDesignSection } from '@/features/planning-sheet/components/EditablePlanningDesignSection';
import { EditableRegulatorySection } from '@/features/planning-sheet/components/EditableRegulatorySection';
import { ImportAssessmentDialog } from '@/features/planning-sheet/components/ImportAssessmentDialog';
import { ImportMonitoringDialog } from '@/features/planning-sheet/components/ImportMonitoringDialog';
import type { MonitoringToPlanningResult } from '@/features/planning-sheet/monitoringToPlanningBridge';
import { useLatestBehaviorMonitoring } from '@/features/planning-sheet/hooks/useLatestBehaviorMonitoring';
import { createMonitoringMeetingRepository } from '@/features/monitoring/repositories/createMonitoringMeetingRepository';
import { SP_ENABLED } from '@/lib/env';
import { ImportHistoryTimeline } from '@/features/planning-sheet/components/ImportHistoryTimeline';
import { ProvenancePanel } from '@/features/planning-sheet/components/ProvenanceBadge';
import type { AssessmentBridgeResult, ProvenanceEntry } from '@/features/planning-sheet/assessmentBridge';
import { useImportAuditStore } from '@/features/planning-sheet/stores/importAuditStore';
import { useAuth } from '@/auth/useAuth';
import {
  AssessmentSection,
  IntakeSection,
  PlanningDesignSection,
} from '@/features/planning-sheet/components/ReadOnlySections';
import { useIcebergEvidence } from '@/features/ibd/analysis/pdca/queries/useIcebergEvidence';
import { usePlanningSheetData } from '@/features/planning-sheet/hooks/usePlanningSheetData';
import { usePlanningSheetForm } from '@/features/planning-sheet/hooks/usePlanningSheetForm';
import { usePlanningSheetRepositories } from '@/features/planning-sheet/hooks/usePlanningSheetRepositories';
import { NewPlanningSheetForm } from '@/features/planning-sheet/components/NewPlanningSheetForm';
import { createSharePointIspRepository } from '@/data/isp/sharepoint/SharePointIspRepository';
import { useSP } from '@/lib/spClient';
import { useUsers } from '@/features/users/useUsers';
import { TESTIDS, tid } from '@/testids';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PhaseNextStepBanner } from '@/features/planning-sheet/components/PhaseNextStepBanner';
import { determineWorkflowPhase, type WorkflowPhase } from '@/domain/bridge/workflowPhase';
import { AbcEvidencePanel } from '@/features/ibd/analysis/pdca/components/AbcEvidencePanel';
import type { EvidenceLinkMap } from '@/domain/isp/evidenceLink';
import { createEmptyEvidenceLinkMap } from '@/domain/isp/evidenceLink';
import type { AbcRecord } from '@/domain/abc/abcRecord';
import { localAbcRecordRepository } from '@/infra/localStorage/localAbcRecordRepository';
import { localEvidenceLinkRepository } from '@/infra/localStorage/localEvidenceLinkRepository';
import type { IcebergPdcaItem } from '@/features/ibd/analysis/pdca/types';
import { EvidencePatternSummaryCard } from '@/features/planning-sheet/components/EvidencePatternSummaryCard';
import { buildAbcRecordUrl, buildIcebergPdcaUrlWithHighlight } from '@/app/links/navigationLinks';
import type { EvidenceLinkType } from '@/domain/isp/evidenceLink';
import { formatDateTimeIntl } from '@/lib/dateFormat';
import { ContextPanel } from '@/features/context/components/ContextPanel';
import {
  buildContextAlerts,
  buildContextSummary,
  buildRecommendedPrompts,
  createEmptyContextData,
  prioritizeContextAlerts,
  type ContextHandoff,
  type ContextPanelData,
} from '@/features/context/domain/contextPanelLogic';
import { useHandoffData } from '@/features/handoff/hooks/useHandoffData';
import type { HandoffRecord } from '@/features/handoff/handoffTypes';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Fab from '@mui/material/Fab';
import { useTagAnalytics, TagAnalyticsSection, presetToDateRange, type PeriodPreset } from '@/features/tag-analytics';
import { useStrategyUsageCounts } from '@/features/planning-sheet/hooks/useStrategyUsageCounts';
import { useStrategyUsageTrend } from '@/features/planning-sheet/hooks/useStrategyUsageTrend';
import { TrendOverviewBar } from '@/features/planning-sheet/components/StrategyTrendIndicator';
import { filterAuditHistoryRecords, type AuditHistoryFilter } from '@/features/planning-sheet/domain/filterAuditHistory';

// ── Local (split) ──
import { type SheetTabKey, TAB_SECTIONS, TabPanel } from './support-planning-sheet/types';
import { ReadOnlyOverview, ReadOnlyRegulatory } from './support-planning-sheet/ReadOnlySections';
import SheetHeader from './support-planning-sheet/SheetHeader';

// ─────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────

export default function SupportPlanningSheetPage() {
  const { planningSheetId } = useParams<{ planningSheetId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userIdFromQuery = searchParams.get('userId');
  const tabFromQuery = searchParams.get('tab') as SheetTabKey | null;
  const validTabs: SheetTabKey[] = ['overview', 'intake', 'assessment', 'planning', 'regulatory'];
  const initialTab = tabFromQuery && validTabs.includes(tabFromQuery) ? tabFromQuery : 'overview';
  const [activeTab, setActiveTab] = React.useState<SheetTabKey>(initialTab);
  const [isEditing, setIsEditing] = React.useState(false);
  const [toast, setToast] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });
  const [importDialogOpen, setImportDialogOpen] = React.useState(false);
  const [monitoringDialogOpen, setMonitoringDialogOpen] = React.useState(false);
  const [sessionProvenance, setSessionProvenance] = React.useState<ProvenanceEntry[]>([]);
  const [contextOpen, setContextOpen] = React.useState(false);
  const [historyFilter, setHistoryFilter] = React.useState<AuditHistoryFilter>('all');

  // ── Evidence Links state (persisted to localStorage) ──
  const [evidenceLinks, setEvidenceLinksRaw] = React.useState<EvidenceLinkMap>(createEmptyEvidenceLinkMap());
  const [abcRecords, setAbcRecords] = React.useState<AbcRecord[]>([]);
  const [pdcaItems, setPdcaItems] = React.useState<IcebergPdcaItem[]>([]);

  // Restore evidence links from localStorage on mount
  React.useEffect(() => {
    if (planningSheetId && planningSheetId !== 'new') {
      const stored = localEvidenceLinkRepository.get(planningSheetId);
      setEvidenceLinksRaw(stored);
    }
  }, [planningSheetId]);

  // Auto-save wrapper: updates state + persists to localStorage
  const setEvidenceLinks = React.useCallback((updated: EvidenceLinkMap) => {
    setEvidenceLinksRaw(updated);
    if (planningSheetId && planningSheetId !== 'new') {
      localEvidenceLinkRepository.save(planningSheetId, updated);
    }
  }, [planningSheetId]);

  // ── Repository DI ──
  const planningSheetRepo = usePlanningSheetRepositories();
  const spClient = useSP();
  const ispRepo = React.useMemo(() => createSharePointIspRepository(spClient), [spClient]);

  // ── データ取得（本番 Repository 接続） ──
  const { data: sheet, isLoading, error, refetch } = usePlanningSheetData(planningSheetId, planningSheetRepo);

  // ── フォーム管理 ──
  const form = usePlanningSheetForm(sheet, planningSheetRepo, (updated) => {
    setToast({ open: true, message: `「${updated.title}」を保存しました`, severity: 'success' });
    setIsEditing(false);
    refetch();
  });

  // ── Iceberg Evidence（ADR-006 準拠: useIcebergEvidence 経由） ──
  const { data: icebergEvidence } = useIcebergEvidence(sheet?.userId ?? null);

  // ── Phase C-3a: 戦略実施回数集計 ──
  const { summary: strategyUsage, loading: strategyUsageLoading } = useStrategyUsageCounts(sheet?.userId);

  // ── Phase C-3b: 戦略トレンド（前期間比較） ──
  const {
    result: trendResult,
    days: trendDays,
    setDays: setTrendDays,
    loading: trendLoading,
  } = useStrategyUsageTrend(sheet?.userId);

  // ── ABC/PDCA データ取得（根拠選択用） ──
  React.useEffect(() => {
    let disposed = false;
    const userId = sheet?.userId;
    if (!userId) {
      setAbcRecords([]);
      setPdcaItems([]);
      return;
    }
    // ABC記録取得
    localAbcRecordRepository.getByUserId(userId).then(records => {
      if (!disposed) setAbcRecords(records);
    });
    // PDCA取得（localStorage から直接）
    try {
      const raw = localStorage.getItem('iceberg-pdca-items');
      if (raw) {
        const all: IcebergPdcaItem[] = JSON.parse(raw);
        if (!disposed) setPdcaItems(all.filter(p => p.userId === userId));
      }
    } catch {
      // ignore parse errors
    }
    return () => { disposed = true; };
  }, [sheet?.userId]);

  // ── アセスメント取込 ──
  const { getByUserId: getAssessment } = useAssessmentStore();
  const { data: users } = useUsers();
  const { account } = useAuth();
  const { saveAuditRecord, getAllProvenance, getBySheetId } = useImportAuditStore();
  const targetUser = React.useMemo(
    () => users.find((u) => u.UserID === sheet?.userId),
    [users, sheet?.userId],
  );
  const currentAssessment = React.useMemo(
    () => (sheet?.userId ? getAssessment(sheet.userId) : null),
    [sheet?.userId, getAssessment],
  );

  // 永続化された過去の provenance + セッション中の provenance を統合
  const persistedProvenance = React.useMemo(
    () => (planningSheetId ? getAllProvenance(planningSheetId) : []),
    [planningSheetId, getAllProvenance],
  );
  const allProvenanceEntries = React.useMemo(
    () => [...persistedProvenance, ...sessionProvenance],
    [persistedProvenance, sessionProvenance],
  );

  // ── 取込履歴レコード ──
  const auditRecords = React.useMemo(
    () => (planningSheetId ? getBySheetId(planningSheetId) : []),
    [planningSheetId, getBySheetId],
  );
  const filteredAuditRecords = React.useMemo(
    () => filterAuditHistoryRecords(auditRecords, historyFilter),
    [auditRecords, historyFilter],
  );

  const handleAssessmentImport = React.useCallback((result: AssessmentBridgeResult) => {
    // フォームフィールドを更新
    if (result.formPatches.observationFacts !== undefined) {
      form.setFieldValue('observationFacts', result.formPatches.observationFacts);
    }
    if (result.formPatches.collectedInformation !== undefined) {
      form.setFieldValue('collectedInformation', result.formPatches.collectedInformation);
    }
    // インテークフィールドを更新
    if (result.intakePatches.sensoryTriggers || result.intakePatches.medicalFlags) {
      form.setIntake({
        ...form.intake,
        ...(result.intakePatches.sensoryTriggers && { sensoryTriggers: result.intakePatches.sensoryTriggers }),
        ...(result.intakePatches.medicalFlags && { medicalFlags: result.intakePatches.medicalFlags }),
      });
    }
    const parts: string[] = [];
    if (result.summary.sensoryTriggersAdded > 0) parts.push(`感覚トリガー${result.summary.sensoryTriggersAdded}件`);
    if (result.summary.observationFactsAppended) parts.push('行動観察');
    if (result.summary.collectedInfoAppended) parts.push('収集情報');
    if (result.summary.medicalFlagsAdded > 0) parts.push(`医療フラグ${result.summary.medicalFlagsAdded}件`);
    const summaryText = `アセスメントから取込完了: ${parts.join('、')}`;
    setToast({ open: true, message: summaryText, severity: 'success' });
    // provenance entries をセッションに蓄積
    setSessionProvenance((prev) => [...prev, ...result.provenance]);

    // 監査メモを永続化
    if (planningSheetId && currentAssessment) {
      const affectedFields = [...new Set(result.provenance.map((p) => p.field))];
      saveAuditRecord({
        planningSheetId,
        importedAt: new Date().toISOString(),
        importedBy: (account as { name?: string })?.name ?? '不明',
        assessmentId: currentAssessment.id,
        tokuseiResponseId: null,
        mode: result.provenance.some((p) => p.source === 'tokusei_survey') ? 'with-tokusei' : 'assessment-only',
        affectedFields,
        provenance: result.provenance,
        summaryText,
      });
    }
  }, [form, planningSheetId, currentAssessment, account, saveAuditRecord]);

  // ── 行動モニタリング取込 ──
  // NOTE:
  // Repository is resolved via createMonitoringMeetingRepository factory.
  // Do not import localMonitoringMeetingRepository directly in UI components.
  // SP_ENABLED のときは sharepoint モードで SP リストから取得する。
  const monitoringRepo = React.useMemo(
    () => SP_ENABLED
      ? createMonitoringMeetingRepository('sharepoint', { spClient })
      : createMonitoringMeetingRepository('local'),
    [spClient],
  );
  const {
    record: latestMonitoringRecord,
  } = useLatestBehaviorMonitoring(sheet?.userId ?? null, {
    repository: monitoringRepo,
    planningSheetId: planningSheetId ?? 'new',
  });

  const handleMonitoringImport = React.useCallback(
    (result: MonitoringToPlanningResult, selectedCandidateIds: string[]) => {
      // 自動追記の反映
      for (const [field, value] of Object.entries(result.autoPatches)) {
        if (value !== undefined) {
          form.setFieldValue(field as keyof typeof form.values, value as string);
        }
      }
      // 選択された候補の反映
      const selectedCandidates = result.candidates.filter((c) =>
        selectedCandidateIds.includes(c.id),
      );
      for (const candidate of selectedCandidates) {
        const current = form.values[candidate.targetField] ?? '';
        const currentStr = typeof current === 'string' ? current : String(current);
        if (!currentStr.includes(candidate.text.slice(0, 30))) {
          const updated = currentStr ? `${currentStr}\n\n${candidate.text}` : candidate.text;
          form.setFieldValue(candidate.targetField, updated);
        }
      }

      // provenance 蓄積
      setSessionProvenance((prev) => [...prev, ...result.provenance]);

      // toast
      const parts: string[] = [];
      if (result.summary.autoFieldCount > 0) parts.push(`自動追記${result.summary.autoFieldCount}件`);
      if (selectedCandidates.length > 0) parts.push(`候補反映${selectedCandidates.length}件`);
      const summaryText = `行動モニタリングから反映完了: ${parts.join('、') || '変更なし'}`;
      setToast({ open: true, message: summaryText, severity: 'success' });

      // 監査ログ
      if (planningSheetId) {
        const affectedFields = [...new Set(result.provenance.map((p) => p.field))];
        saveAuditRecord({
          planningSheetId,
          importedAt: new Date().toISOString(),
          importedBy: (account as { name?: string })?.name ?? '不明',
          assessmentId: null,
          tokuseiResponseId: null,
          mode: 'behavior-monitoring',
          affectedFields,
          provenance: result.provenance,
          summaryText,
        });
      }
    },
    [form, planningSheetId, account, saveAuditRecord],
  );

  // ── Handlers ──
  const handleSave = async () => {
    const result = await form.save();
    if (!result && form.saveError) {
      setToast({ open: true, message: form.saveError, severity: 'error' });
    }
  };

  const handleReset = () => {
    form.reset();
    setIsEditing(false);
  };

  // ── Workflow Phase (Navigation Engine) ──
  const currentPhase = React.useMemo((): WorkflowPhase | null => {
    if (!sheet) return null;
    const result = determineWorkflowPhase({
      userId: sheet.userId,
      userName: (sheet as unknown as { userName?: string }).userName ?? sheet.userId,
      planningSheets: [{
        id: sheet.id,
        status: (sheet as unknown as { status?: string }).status ?? 'active',
        appliedFrom: (sheet as unknown as { supportStartDate?: string }).supportStartDate ?? null,
        reviewedAt: (sheet as unknown as { reviewedAt?: string }).reviewedAt ?? null,
        reviewCycleDays: (sheet as unknown as { monitoringCycleDays?: number }).monitoringCycleDays ?? 90,
        procedureCount: sheet.planning?.procedureSteps?.length ?? 0,
        isCurrent: true,
      }],
    });
    return result.phase;
  }, [sheet]);

  const handleBannerNavigate = React.useCallback((href: string) => {
    if (href.startsWith('#tab:')) {
      const tabKey = href.replace('#tab:', '') as SheetTabKey;
      setActiveTab(tabKey);
    } else {
      navigate(href);
    }
  }, [navigate, setActiveTab]);

  const handleJumpToMonitoringHistory = React.useCallback(() => {
    const history = document.getElementById('monitoring-history-timeline');
    history?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // ── Evidence Click Navigation (Phase 4-C) ──
  const handleEvidenceClick = React.useCallback((type: EvidenceLinkType, referenceId: string) => {
    if (!sheet?.userId) return;
    if (type === 'abc') {
      navigate(buildAbcRecordUrl(sheet.userId, { recordId: referenceId, source: 'support-planning' }));
    } else {
      navigate(buildIcebergPdcaUrlWithHighlight(sheet.userId, referenceId, { source: 'support-planning' }));
    }
  }, [navigate, sheet?.userId]);

  // ── Sprint-1 Phase C: ContextPanel データ ──
  const { repo: handoffRepo } = useHandoffData();
  const [handoffRecordsForContext, setHandoffRecordsForContext] = React.useState<HandoffRecord[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const records = await handoffRepo.getRecords('today', 'all');
        if (!cancelled) setHandoffRecordsForContext(records);
      } catch {
        if (!cancelled) setHandoffRecordsForContext([]);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [handoffRepo]);

  const contextData: ContextPanelData = React.useMemo(() => {
    if (!sheet?.userId) return createEmptyContextData();
    const isHighIntensity = targetUser?.IsHighIntensitySupportTarget ?? false;
    const isSupportProcedureTarget = targetUser?.IsSupportProcedureTarget ?? false;

    // supportPlan: Phase 3 で ISP 完全接続時にゴール表示を実装
    // 現時点では PlanningDesign に goals がないため空で初期化
    const supportPlan = {
      status: 'confirmed' as const,
      planPeriod: '',
      goals: [] as Array<{ type: 'long' | 'short' | 'support'; label: string; text: string }>,
    };

    const handoffs: ContextHandoff[] = handoffRecordsForContext
      .filter((h) => h.userCode === sheet.userId || h.userDisplayName === (targetUser?.FullName ?? ''))
      .map((h) => ({
        id: String(h.id),
        message: h.message ?? '',
        category: h.category ?? '',
        severity: h.severity ?? '',
        status: h.status ?? '',
        createdAt: h.createdAt ?? '',
      }));

    const alerts = buildContextAlerts({
      supportPlan,
      handoffs,
      recentRecords: [],
      isHighIntensity,
      isSupportProcedureTarget,
    });

    return {
      supportPlan,
      handoffs,
      recentRecords: [],
      alerts: prioritizeContextAlerts(alerts),
      summary: buildContextSummary([], handoffs),
      prompts: buildRecommendedPrompts(supportPlan, isHighIntensity, isSupportProcedureTarget),
    };
  }, [sheet, targetUser, handoffRecordsForContext]);
  const contextUserName = targetUser?.FullName ?? sheet?.userId ?? '';

  // ── Loading / Error states ──
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress />
      </Box>
    );
  }

  // ── 新規作成ルート ──
  if (planningSheetId === 'new') {
    return (
      <NewPlanningSheetForm
        planningSheetRepo={planningSheetRepo}
        ispRepo={ispRepo}
        initialUserId={userIdFromQuery ?? undefined}
      />
    );
  }

  if (error || !sheet) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || '支援計画シートが見つかりません'}</Alert>
        <Button
          startIcon={<ArrowBackRoundedIcon />}
          onClick={() => navigate('/support-plan-guide')}
          sx={{ mt: 2 }}
        >
          ISP 画面に戻る
        </Button>
      </Box>
    );
  }

  // ── Render ──
  return (
    <Box sx={{ display: 'flex', position: 'relative' }}>
      {/* メインコンテンツ */}
      <Box sx={{ flex: 1, p: { xs: 2, md: 3 }, pb: 4 }} {...tid(TESTIDS['planning-sheet-page'])}>
      <Stack spacing={3}>
        {/* ── ヘッダー ── */}
        <SheetHeader
          sheet={sheet}
          isEditing={isEditing}
          isDirty={form.isDirty}
          isSaving={form.isSaving}
          isValid={form.isValid}
          hasAssessment={!!currentAssessment}
          hasMonitoringRecord={!!latestMonitoringRecord}
          icebergEvidence={icebergEvidence}
          onBack={() => navigate('/support-plan-guide')}
          onEdit={() => setIsEditing(true)}
          onReset={handleReset}
          onSave={handleSave}
          onImportAssessment={() => setImportDialogOpen(true)}
          onImportMonitoring={() => setMonitoringDialogOpen(true)}
        />

        {/* ── 操作ガイド（履歴・手順確認・編集更新） ── */}
        <Alert severity="info" variant="outlined" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
          <Stack spacing={1}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              操作ガイド
            </Typography>
            <Typography variant="caption" color="text.secondary">
              モニタリング履歴: 「モニタリング履歴 / 取込履歴」を確認してください。
            </Typography>
            <Typography variant="caption" color="text.secondary">
              履歴の絞り込み: 「すべて / モニタリング / アセスメント」を切り替えて確認できます。
            </Typography>
            <Typography variant="caption" color="text.secondary">
              支援手順の確認・更新: 「支援設計」タブで手順を確認し、編集後に保存してください。
            </Typography>
            <Typography variant="caption" color="text.secondary">
              編集更新の確認: 保存後に画面下部の更新日・更新者を確認してください。
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button size="small" onClick={handleJumpToMonitoringHistory}>
                モニタリング履歴へ
              </Button>
              <Button size="small" onClick={() => setActiveTab('planning')}>
                支援手順を確認
              </Button>
              <Button
                size="small"
                onClick={() => setIsEditing(true)}
                disabled={isEditing}
              >
                編集を始める
              </Button>
            </Stack>
          </Stack>
        </Alert>

        {/* ── ABC根拠データ ── */}
        {sheet.userId && <AbcEvidencePanel userId={sheet.userId} />}

        {/* ── Validation エラーサマリー ── */}
        {isEditing && Object.keys(form.validationErrors).length > 0 && (
          <Alert severity="warning" variant="outlined">
            入力にエラーがあります: {Object.values(form.validationErrors).filter(Boolean).join(' / ')}
          </Alert>
        )}

        {/* ── 取込出典パネル（provenance: 永続化 + セッション） ── */}
        {isEditing && allProvenanceEntries.length > 0 && (
          <ProvenancePanel entries={allProvenanceEntries} defaultExpanded={false} />
        )}

        {/* ── モニタリング履歴 / 取込履歴タイムライン ── */}
        {auditRecords.length > 0 ? (
          <Box id="monitoring-history-timeline">
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              sx={{ mb: 1 }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                モニタリング履歴 / 取込履歴
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={historyFilter}
                onChange={(_event, next) => {
                  if (next) setHistoryFilter(next as AuditHistoryFilter);
                }}
                aria-label="履歴フィルタ"
              >
                <ToggleButton value="all">すべて</ToggleButton>
                <ToggleButton value="monitoring">モニタリング</ToggleButton>
                <ToggleButton value="assessment">アセスメント</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              モニタリング取込後の反映履歴はこのセクションで確認できます。必要に応じて履歴フィルタを切り替えてください。
            </Typography>
            {filteredAuditRecords.length > 0 ? (
              <ImportHistoryTimeline records={filteredAuditRecords} compact />
            ) : (
              <Alert severity="info" variant="outlined">
                選択した条件に一致する履歴はありません。履歴フィルタを切り替えて確認してください。
              </Alert>
            )}
          </Box>
        ) : (
          <Alert severity="info" variant="outlined" id="monitoring-history-timeline">
            モニタリング履歴はまだありません。モニタリング取込後に履歴が表示されます。
          </Alert>
        )}

        {/* ── タブ ── */}
        <Paper variant="outlined" sx={{ p: { xs: 1, md: 2 } }}>
          <Tabs
            value={activeTab}
            onChange={(_e, v) => setActiveTab(v as SheetTabKey)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="支援計画シートセクション切り替え"
            {...tid(TESTIDS['planning-sheet-tabs'])}
          >
            {TAB_SECTIONS.map((tab) => (
              <Tab
                key={tab.key}
                value={tab.key}
                label={tab.label}
                id={`planning-sheet-tab-${tab.key}`}
                aria-controls={`planning-sheet-tabpanel-${tab.key}`}
              />
            ))}
          </Tabs>

          <TabPanel current={activeTab} value="overview">
            {currentPhase && (
              <PhaseNextStepBanner
                phase={currentPhase}
                context="overview"
                onNavigate={handleBannerNavigate}
              />
            )}
            {isEditing ? (
              <EditableOverviewSection
                values={form.values}
                setFieldValue={form.setFieldValue}
                errors={form.validationErrors}
                provenanceEntries={allProvenanceEntries}
              />
            ) : (
              <ReadOnlyOverview sheet={sheet} />
            )}
          </TabPanel>
          <TabPanel current={activeTab} value="intake">
            {isEditing ? (
              <EditableIntakeSection
                intake={form.intake}
                onChange={form.setIntake}
                provenanceEntries={allProvenanceEntries}
              />
            ) : (
              <IntakeSection sheet={sheet} />
            )}
          </TabPanel>
          <TabPanel current={activeTab} value="assessment">
            {isEditing ? (
              <EditableAssessmentSection
                assessment={form.assessment}
                onChange={form.setAssessment}
              />
            ) : (
              <AssessmentSection sheet={sheet} />
            )}
          </TabPanel>
          <TabPanel current={activeTab} value="planning">
            {/* ── Evidence Pattern Analysis サマリー ── */}
            <EvidencePatternSummaryCard
              evidenceLinks={evidenceLinks}
              abcRecords={abcRecords}
              defaultExpanded={!isEditing}
            />
            <Box sx={{ mt: 2 }}>
              {/* Phase C-3b: トレンドバー（期間セレクタ + 全体トレンド） */}
              <TrendOverviewBar
                trendResult={trendResult}
                days={trendDays}
                onDaysChange={setTrendDays}
                loading={trendLoading}
              />
              {isEditing ? (
                <EditablePlanningDesignSection
                  planning={form.planning}
                  onChange={form.setPlanning}
                  abcRecords={abcRecords}
                  pdcaItems={pdcaItems}
                  evidenceLinks={evidenceLinks}
                  onEvidenceLinksChange={setEvidenceLinks}
                  onEvidenceClick={handleEvidenceClick}
                  strategyUsage={strategyUsage}
                  strategyUsageLoading={strategyUsageLoading}
                  trendResult={trendResult}
                />
              ) : (
                <PlanningDesignSection sheet={sheet} evidenceLinks={evidenceLinks} onEvidenceClick={handleEvidenceClick} strategyUsage={strategyUsage} strategyUsageLoading={strategyUsageLoading} trendResult={trendResult} />
              )}
            </Box>
          </TabPanel>
          <TabPanel current={activeTab} value="regulatory">
            {isEditing ? (
              <EditableRegulatorySection
                values={form.values}
                sheet={sheet}
                setFieldValue={form.setFieldValue}
              />
            ) : (
              <ReadOnlyRegulatory sheet={sheet} />
            )}
          </TabPanel>
        </Paper>

        {/* ── 行動タグ分析 (Phase F1 深化) ── */}
        <TagAnalyticsAccordion userId={sheet.userId} />

        {/* ── メタ情報フッター ── */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            編集後は更新日・更新者を確認し、意図した内容で保存されていることを確認してください。
          </Typography>
          <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
            <Typography variant="caption" color="text.secondary">
              作成日: {formatDateTimeIntl(sheet.createdAt, { year: 'numeric', month: '2-digit', day: '2-digit' })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              作成者: {sheet.createdBy}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              更新日: {formatDateTimeIntl(sheet.updatedAt, { year: 'numeric', month: '2-digit', day: '2-digit' })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              更新者: {sheet.updatedBy}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ID: {sheet.id}
            </Typography>
          </Stack>
        </Paper>
      </Stack>

      {/* ── Toast ── */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toast.severity}
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          variant="filled"
        >
          {toast.message}
        </Alert>
      </Snackbar>

      {/* ── アセスメント取込ダイアログ ── */}
      {currentAssessment && (
        <ImportAssessmentDialog
          open={importDialogOpen}
          onClose={() => setImportDialogOpen(false)}
          assessment={currentAssessment}
          targetUserName={targetUser?.FullName}
          currentForm={form.values}
          currentIntake={form.intake}
          onImport={handleAssessmentImport}
        />
      )}

      {/* ── 行動モニタリング取込ダイアログ ── */}
      {latestMonitoringRecord && (
        <ImportMonitoringDialog
          open={monitoringDialogOpen}
          onClose={() => setMonitoringDialogOpen(false)}
          monitoringRecord={latestMonitoringRecord}
          currentForm={form.values}
          onImport={handleMonitoringImport}
        />
      )}
      </Box>

      {/* Sprint-1 Phase C: ContextPanel */}
      <ContextPanel
        open={contextOpen}
        onClose={() => setContextOpen(false)}
        userName={contextUserName}
        data={contextData}
      />

      {/* ContextPanel Toggle FAB */}
      <Fab
        color="primary"
        aria-label="コンテキスト参照"
        size="medium"
        onClick={() => setContextOpen((prev) => !prev)}
        data-testid="context-panel-toggle"
        sx={{
          position: 'fixed',
          bottom: 88,
          right: 16,
          zIndex: 1100,
        }}
      >
        <AutoStoriesIcon />
      </Fab>
    </Box>
  );
}

// ─── TagAnalytics Accordion (Phase F1.5 深化) ────────────

/**
 * 行動タグ分析を Accordion で折りたたみ表示する。
 * 閲覧時に自動展開、計画編集UXを邪魔しない。
 * F1.5: 内部で期間プリセットを管理。
 */
const TagAnalyticsAccordion: React.FC<{ userId: string | undefined }> = ({ userId }) => {
  const [period, setPeriod] = React.useState<PeriodPreset>('30d');
  const range = React.useMemo(() => presetToDateRange(period), [period]);
  const tagAnalytics = useTagAnalytics(userId, range);

  // empty/error 時は非表示（ノイズ回避）
  if (tagAnalytics.status === 'empty' || tagAnalytics.status === 'error') {
    return null;
  }

  return (
    <Accordion
      defaultExpanded={tagAnalytics.status === 'ready'}
      variant="outlined"
      sx={{ borderRadius: 2 }}
      data-testid="planning-sheet-tag-analytics"
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          🏷️ 行動タグ分析
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <TagAnalyticsSection
          analytics={tagAnalytics}
          periodPreset={period}
          onPeriodChange={setPeriod}
          showSuggestions
        />
      </AccordionDetails>
    </Accordion>
  );
};
