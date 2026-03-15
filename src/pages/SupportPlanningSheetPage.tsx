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
import { calculateMonitoringSchedule, resolveSupportStartDate } from '@/features/planning-sheet/monitoringSchedule';
import type { BehaviorMonitoringRecord } from '@/domain/isp/behaviorMonitoring';
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
import { useUsersDemo } from '@/features/users/usersStoreDemo';
import { TESTIDS, tid } from '@/testids';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { SupportPlanningSheet } from '@/domain/isp/schema';
import {
  PLANNING_SHEET_STATUS_DISPLAY,
  type PlanningSheetStatus,
} from '@/domain/isp/schema';
import Divider from '@mui/material/Divider';
import { InfoRow } from '@/features/planning-sheet/components/ReadOnlySections';
import { formatDateTimeIntl } from '@/lib/dateFormat';
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

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type SheetTabKey = 'overview' | 'intake' | 'assessment' | 'planning' | 'regulatory';

const TAB_SECTIONS: { key: SheetTabKey; label: string }[] = [
  { key: 'overview', label: '概要' },
  { key: 'intake', label: '情報収集' },
  { key: 'assessment', label: 'アセスメント' },
  { key: 'planning', label: '支援設計' },
  { key: 'regulatory', label: '制度項目' },
];

// ─────────────────────────────────────────────
// Status helpers
// ─────────────────────────────────────────────

function statusColor(status: PlanningSheetStatus): 'default' | 'info' | 'success' | 'warning' {
  switch (status) {
    case 'draft': return 'default';
    case 'review': return 'info';
    case 'active': return 'success';
    case 'revision_pending': return 'warning';
    case 'archived': return 'default';
    default: return 'default';
  }
}

// ─────────────────────────────────────────────
// TabPanel
// ─────────────────────────────────────────────

const TabPanel: React.FC<{
  current: SheetTabKey;
  value: SheetTabKey;
  children: React.ReactNode;
}> = ({ current, value, children }) => (
  <Box
    role="tabpanel"
    hidden={current !== value}
    id={`planning-sheet-tabpanel-${value}`}
    aria-labelledby={`planning-sheet-tab-${value}`}
    sx={{ mt: 2 }}
  >
    {current === value ? children : null}
  </Box>
);

// ─────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────

export default function SupportPlanningSheetPage() {
  const { planningSheetId } = useParams<{ planningSheetId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState<SheetTabKey>('overview');
  const [isEditing, setIsEditing] = React.useState(false);
  const [toast, setToast] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });
  const [importDialogOpen, setImportDialogOpen] = React.useState(false);
  const [monitoringDialogOpen, setMonitoringDialogOpen] = React.useState(false);
  const [sessionProvenance, setSessionProvenance] = React.useState<ProvenanceEntry[]>([]);

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
  const { data: users } = useUsersDemo();
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
        tokuseiResponseId: null, // ImportAssessmentDialog 内で選択された ID は result には含まれないが、mode で判別可能
        mode: result.provenance.some((p) => p.source === 'tokusei_survey') ? 'with-tokusei' : 'assessment-only',
        affectedFields,
        provenance: result.provenance,
        summaryText,
      });
    }
  }, [form, planningSheetId, currentAssessment, account, saveAuditRecord]);

  // ── 行動モニタリング取込 ──
  // TODO: 将来 BehaviorMonitoringRecord を repository から取得する
  // 現時点では暫定的なデモデータでダイアログ接続を検証
  const demoMonitoringRecord: BehaviorMonitoringRecord | null = React.useMemo(() => {
    if (!sheet?.userId) return null;
    return {
      id: 'bm-demo-1',
      userId: sheet.userId,
      planningSheetId: planningSheetId ?? '',
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      supportEvaluations: [],
      environmentFindings: [],
      effectiveSupports: '',
      difficultiesObserved: '',
      newTriggers: [],
      medicalSafetyNotes: '',
      userFeedback: '',
      familyFeedback: '',
      recommendedChanges: [],
      summary: '',
      recordedBy: 'デモ記録者',
      recordedAt: new Date().toISOString(),
    };
  }, [sheet?.userId, planningSheetId]);

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
    <Box sx={{ p: { xs: 2, md: 3 }, pb: 4 }} {...tid(TESTIDS['planning-sheet-page'])}>
      <Stack spacing={3}>
        {/* ── ヘッダー ── */}
        <Paper
          variant="outlined"
          sx={{ p: { xs: 2, md: 3 } }}
          {...tid(TESTIDS['planning-sheet-header'])}
        >
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Button
                size="small"
                startIcon={<ArrowBackRoundedIcon />}
                onClick={() => navigate('/support-plan-guide')}
              >
                ISP 画面
              </Button>

              {/* ── 編集ツールバー ── */}
              <Stack direction="row" spacing={1} alignItems="center">
                {isEditing ? (
                  <>
                    {form.isDirty && (
                      <Chip
                        size="small"
                        label="未保存の変更あり"
                        color="warning"
                        variant="outlined"
                      />
                    )}
                    <Button
                      size="small"
                      variant="outlined"
                      color="secondary"
                      startIcon={<AssessmentRoundedIcon />}
                      onClick={() => setImportDialogOpen(true)}
                      disabled={!currentAssessment || form.isSaving}
                    >
                      アセスメントから取込
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="secondary"
                      startIcon={<AssessmentRoundedIcon />}
                      onClick={() => setMonitoringDialogOpen(true)}
                      disabled={!demoMonitoringRecord || form.isSaving}
                    >
                      行動モニタリングから反映
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<UndoRoundedIcon />}
                      onClick={handleReset}
                      disabled={form.isSaving}
                    >
                      リセット
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={form.isSaving ? <CircularProgress size={16} /> : <SaveRoundedIcon />}
                      onClick={handleSave}
                      disabled={!form.isDirty || !form.isValid || form.isSaving}
                    >
                      {form.isSaving ? '保存中…' : '保存'}
                    </Button>
                  </>
                ) : (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<EditRoundedIcon />}
                    onClick={() => setIsEditing(true)}
                  >
                    編集
                  </Button>
                )}
              </Stack>
            </Stack>

            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
              <DescriptionRoundedIcon color="primary" />
              <Typography variant="h5" fontWeight={700}>
                {sheet.title}
              </Typography>
              <Chip
                size="small"
                label={PLANNING_SHEET_STATUS_DISPLAY[sheet.status]}
                color={statusColor(sheet.status)}
              />
              <Chip size="small" variant="outlined" label={`v${sheet.version}`} />
              {isEditing && (
                <Chip size="small" label="編集中" color="info" icon={<EditRoundedIcon />} />
              )}
            </Stack>

            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              <Typography variant="caption" color="text.secondary">
                対象: {sheet.targetScene || '—'} ／ {sheet.targetDomain || '—'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                適用開始: {sheet.appliedFrom || '—'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                次回見直し: {sheet.nextReviewAt || '—'}
              </Typography>
            </Stack>

            {/* ── L2 モニタリングスケジュール帯 ── */}
            {(() => {
              const startDate = resolveSupportStartDate(
                (sheet as Record<string, unknown>).supportStartDate as string | null,
                sheet.appliedFrom,
              );
              if (!startDate) return null;
              const schedule = calculateMonitoringSchedule(
                startDate,
                ((sheet as Record<string, unknown>).monitoringCycleDays as number) ?? 90,
              );
              return (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    bgcolor: schedule.isOverdue ? 'error.50' : 'action.hover',
                    borderColor: schedule.isOverdue ? 'error.main' : 'divider',
                  }}
                >
                  <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="body2" fontWeight={500}>
                      L2 モニタリング
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`起点: ${startDate}`}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      color={schedule.isOverdue ? 'error' : schedule.remainingDays <= 14 ? 'warning' : 'info'}
                      label={`次回: ${schedule.nextMonitoringDate}`}
                    />
                    <Chip
                      size="small"
                      variant={schedule.isOverdue ? 'filled' : 'outlined'}
                      color={schedule.isOverdue ? 'error' : schedule.remainingDays <= 14 ? 'warning' : 'default'}
                      label={
                        schedule.isOverdue
                          ? `${schedule.overdueDays}日超過`
                          : `残り${schedule.remainingDays}日`
                      }
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`第${schedule.currentCycleNumber}期 (${schedule.progressPercent}%)`}
                    />
                    <Typography variant="caption" color="text.secondary">
                      経過{schedule.elapsedDays}日 / 周期{schedule.cycleDays}日
                    </Typography>
                  </Stack>
                </Paper>
              );
            })()}

            {/* ── Iceberg Evidence 帯 ── */}
            {icebergEvidence && (
              <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="body2" fontWeight={500}>Iceberg 分析</Typography>
                  <Chip
                    size="small"
                    label={`${Object.values(icebergEvidence.sessionCount).reduce((a, b) => a + b, 0)} セッション`}
                    color="info"
                    variant="outlined"
                  />
                  {(() => {
                    const dates = Object.values(icebergEvidence.latestAnalysisDate);
                    const latest = dates.length > 0 ? dates.sort().reverse()[0] : null;
                    return latest ? (
                      <Typography variant="caption" color="text.secondary">
                        最終: {latest}
                      </Typography>
                    ) : null;
                  })()}
                </Stack>
              </Paper>
            )}
          </Stack>
        </Paper>

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

        {/* ── 取込履歴タイムライン ── */}
        {auditRecords.length > 0 && (
          <ImportHistoryTimeline records={auditRecords} compact />
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
              {isEditing ? (
                <EditablePlanningDesignSection
                  planning={form.planning}
                  onChange={form.setPlanning}
                  abcRecords={abcRecords}
                  pdcaItems={pdcaItems}
                  evidenceLinks={evidenceLinks}
                  onEvidenceLinksChange={setEvidenceLinks}
                />
              ) : (
                <PlanningDesignSection sheet={sheet} evidenceLinks={evidenceLinks} />
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

        {/* ── メタ情報フッター ── */}
        <Paper variant="outlined" sx={{ p: 2 }}>
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
      {demoMonitoringRecord && (
        <ImportMonitoringDialog
          open={monitoringDialogOpen}
          onClose={() => setMonitoringDialogOpen(false)}
          monitoringRecord={demoMonitoringRecord}
          currentForm={form.values}
          onImport={handleMonitoringImport}
        />
      )}
    </Box>
  );
}

// ─────────────────────────────────────────────
// Read-only wrappers (inline, thin)
// ─────────────────────────────────────────────



const ReadOnlyOverview: React.FC<{ sheet: SupportPlanningSheet }> = ({ sheet }) => (
  <Stack spacing={2}>
    <Typography variant="subtitle1" fontWeight={600}>基本情報</Typography>
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <InfoRow label="タイトル" value={sheet.title} />
        <InfoRow label="対象場面" value={sheet.targetScene || '—'} />
        <InfoRow label="対象領域" value={sheet.targetDomain || '—'} />
        <Divider />
        <InfoRow label="行動観察" value={sheet.observationFacts} />
        <InfoRow label="収集情報" value={sheet.collectedInformation || '—'} />
        <InfoRow label="分析・仮説" value={sheet.interpretationHypothesis} />
        <InfoRow label="支援課題" value={sheet.supportIssues} />
        <Divider />
        <InfoRow label="対応方針" value={sheet.supportPolicy} />
        <InfoRow label="環境調整" value={sheet.environmentalAdjustments || '—'} />
        <InfoRow label="関わり方の具体策" value={sheet.concreteApproaches} />
      </Stack>
    </Paper>
  </Stack>
);

const ReadOnlyRegulatory: React.FC<{ sheet: SupportPlanningSheet }> = ({ sheet }) => (
  <Stack spacing={2}>
    <Typography variant="subtitle1" fontWeight={600}>制度項目</Typography>
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <InfoRow label="作成者ID" value={sheet.authoredByStaffId || '—'} />
        <InfoRow label="作成者資格" value={sheet.authoredByQualification} />
        <InfoRow label="作成日" value={sheet.authoredAt || '—'} />
        <InfoRow label="対象サービス" value={sheet.applicableServiceType} />
        <InfoRow label="対象加算" value={sheet.applicableAddOnTypes.join(', ')} />
        <Divider />
        <InfoRow label="利用者交付日" value={sheet.deliveredToUserAt || '未交付'} />
        <InfoRow label="見直し日" value={sheet.reviewedAt || '未見直し'} />
        <InfoRow label="適用開始日" value={sheet.appliedFrom || '—'} />
        <InfoRow label="次回見直し日" value={sheet.nextReviewAt || '—'} />
        <Divider />
        <InfoRow label="医療連携" value={sheet.hasMedicalCoordination ? 'あり' : 'なし'} />
        <InfoRow label="教育連携" value={sheet.hasEducationCoordination ? 'あり' : 'なし'} />
        {sheet.regulatoryBasisSnapshot && (
          <>
            <Typography variant="body2" fontWeight={500} sx={{ mt: 1 }}>対象者判定スナップショット</Typography>
            <InfoRow label="支援区分" value={sheet.regulatoryBasisSnapshot.supportLevel?.toString() ?? '—'} />
            <InfoRow label="行動関連項目" value={sheet.regulatoryBasisSnapshot.behaviorScore?.toString() ?? '—'} />
            <InfoRow label="確認日" value={sheet.regulatoryBasisSnapshot.eligibilityCheckedAt || '—'} />
          </>
        )}
      </Stack>
    </Paper>
  </Stack>
);
