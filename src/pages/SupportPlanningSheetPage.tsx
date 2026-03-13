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
import { EditableAssessmentSection } from '@/features/planning-sheet/components/EditableAssessmentSection';
import { EditableIntakeSection } from '@/features/planning-sheet/components/EditableIntakeSection';
import { EditableOverviewSection } from '@/features/planning-sheet/components/EditableOverviewSection';
import { EditablePlanningDesignSection } from '@/features/planning-sheet/components/EditablePlanningDesignSection';
import { EditableRegulatorySection } from '@/features/planning-sheet/components/EditableRegulatorySection';
import {
  AssessmentSection,
  IntakeSection,
  PlanningDesignSection,
} from '@/features/planning-sheet/components/ReadOnlySections';
import { useIcebergEvidence } from '@/features/ibd/analysis/pdca/queries/useIcebergEvidence';
import { usePlanningSheetData } from '@/features/planning-sheet/hooks/usePlanningSheetData';
import { usePlanningSheetForm } from '@/features/planning-sheet/hooks/usePlanningSheetForm';
import { usePlanningSheetRepositories } from '@/features/planning-sheet/hooks/usePlanningSheetRepositories';
import { TESTIDS, tid } from '@/testids';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
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

  // ── Repository DI ──
  const planningSheetRepo = usePlanningSheetRepositories();

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

  // ── Loading / Error states ──
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress />
      </Box>
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

        {/* ── Validation エラーサマリー ── */}
        {isEditing && Object.keys(form.validationErrors).length > 0 && (
          <Alert severity="warning" variant="outlined">
            入力にエラーがあります: {Object.values(form.validationErrors).filter(Boolean).join(' / ')}
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
            {isEditing ? (
              <EditableOverviewSection
                values={form.values}
                setFieldValue={form.setFieldValue}
                errors={form.validationErrors}
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
            {isEditing ? (
              <EditablePlanningDesignSection
                planning={form.planning}
                onChange={form.setPlanning}
              />
            ) : (
              <PlanningDesignSection sheet={sheet} />
            )}
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
              作成日: {new Date(sheet.createdAt).toLocaleDateString('ja-JP')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              作成者: {sheet.createdBy}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              更新日: {new Date(sheet.updatedAt).toLocaleDateString('ja-JP')}
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
