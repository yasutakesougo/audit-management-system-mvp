/**
 * 制度遵守ダッシュボード — RegulatoryDashboardPage
 *
 * 監査判定エンジンの結果を集計カード + findings テーブルで表示。
 * 重度障害者支援加算の判定結果も統合して表示。
 * デモモード（Repository 未接続）ではサンプルデータで動作確認可能。
 */
import React, { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import GavelIcon from '@mui/icons-material/Gavel';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded';
import AccessibilityNewRoundedIcon from '@mui/icons-material/AccessibilityNewRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import EventRepeatRoundedIcon from '@mui/icons-material/EventRepeatRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import PersonOffRoundedIcon from '@mui/icons-material/PersonOffRounded';
import { useNavigate } from 'react-router-dom';

import {
  type AuditFinding,
  type AuditFindingSeverity,
  type AuditFindingType,
  type AuditSummary,
  AUDIT_FINDING_TYPE_LABELS,
  buildRegulatoryFindings,
  summarizeFindings,
  _resetFindingCounter,
} from '@/domain/regulatory';
import { buildFindingActions } from '@/domain/regulatory/buildFindingActions';
import {
  resolveAllFindingEvidence,
  type FindingEvidenceSummary,
  type IcebergEvidenceBySheet,
} from '@/domain/regulatory/findingEvidenceSummary';
import {
  type SevereAddonFinding,
  type SevereAddonSummary,
  SEVERE_ADDON_FINDING_TYPE_LABELS,
  buildSevereAddonFindings,
  summarizeSevereAddonFindings,
  _resetAddonFindingCounter,
} from '@/domain/regulatory/severeAddonFindings';
import {
  buildSevereAddonFindingActions,
} from '@/domain/regulatory/buildSevereAddonFindingActions';
import SafetyOperationsSummaryCard from '@/features/safety/components/SafetyOperationsSummaryCard';
import { useIcebergEvidence } from '@/features/ibd/analysis/pdca/queries/useIcebergEvidence';
import { useSevereAddonRealData } from '@/features/regulatory/hooks/useSevereAddonRealData';
import { useRegulatoryFindingsRealData } from '@/features/regulatory/hooks/useRegulatoryFindingsRealData';
import { useProcedureRecordRepository } from '@/features/regulatory/hooks/useProcedureRecordRepository';
import { useUsers } from '@/features/users/useUsers';
import { useStaff } from '@/stores/useStaff';
import { usePlanningSheetRepositories } from '@/features/planning-sheet/hooks/usePlanningSheetRepositories';
import {
  localWeeklyObservationRepository,
  localQualificationAssignmentRepository,
} from '@/infra/localStorage/localStaffQualificationRepository';

// ─────────────────────────────────────────────
// デモデータ
// ─────────────────────────────────────────────

function generateDemoFindings(): AuditFinding[] {
  _resetFindingCounter();
  return buildRegulatoryFindings({
    userProfile: {
      userId: 'U001',
      behaviorScore: 14,
      childBehaviorScore: null,
      disabilitySupportLevel: '4',
      serviceTypes: ['daily_life_care'],
      severeBehaviorSupportEligible: true,
      eligibilityCheckedAt: '2026-02-01',
    },
    sheets: [
      {
        id: 'sheet-1',
        userId: 'U001',
        title: '食事場面の支援計画',
        authoredByStaffId: 'S001',
        applicableAddOnTypes: ['severe_disability_support'],
        nextReviewAt: '2026-06-01',
        deliveredToUserAt: '2026-03-05',
        status: 'active',
        isCurrent: true,
      },
      {
        id: 'sheet-2',
        userId: 'U001',
        title: '移動場面の支援計画',
        authoredByStaffId: 'S002',
        applicableAddOnTypes: ['severe_disability_support'],
        nextReviewAt: '2026-01-15',
        deliveredToUserAt: null,
        status: 'active',
        isCurrent: true,
      },
    ],
    staffProfiles: new Map([
      ['S001', { staffId: 'S001', hasPracticalTraining: true, hasBasicTraining: true, hasBehaviorGuidanceTraining: false, hasCorePersonTraining: false, certificationCheckedAt: '2026-01-15' }],
      ['S002', { staffId: 'S002', hasPracticalTraining: false, hasBasicTraining: true, hasBehaviorGuidanceTraining: false, hasCorePersonTraining: false, certificationCheckedAt: '2026-01-15' }],
    ]),
    records: [
      { id: 'rec-1', planningSheetId: 'sheet-1', recordDate: '2026-03-10' },
    ],
    today: new Date().toISOString().slice(0, 10),
  });
}

/**
 * デモ用: 加算系 findings
 * U001=区分6・行動14（Tier2上位区分ではない）
 * U002=区分4・行動12（Tier3候補）
 * U003=区分6・行動20（Tier2上位区分候補）
 */
function generateDemoSevereAddonFindings(): SevereAddonFinding[] {
  _resetAddonFindingCounter();
  const today = new Date().toISOString().slice(0, 10);
  return buildSevereAddonFindings({
    users: [
      { userId: 'U001', userName: '鈴木花子', supportLevel: '6', behaviorScore: 14, planningSheetIds: ['sheet-1'] },
      { userId: 'U002', userName: '田中太郎', supportLevel: '4', behaviorScore: 12, planningSheetIds: ['sheet-2'] },
      { userId: 'U003', userName: '佐藤次郎', supportLevel: '6', behaviorScore: 20, planningSheetIds: [] },
    ],
    totalLifeSupportStaff: 12,
    basicTrainingCompletedCount: 1,  // 1/12 ≈ 8.3% → 不足
    usersWithoutWeeklyObservation: ['U003'],
    lastReassessmentMap: new Map([
      ['U001', '2025-11-01'],  // 超過
      ['U002', today],         // OK
      ['U003', null],          // 未実施 → 超過
    ]),
    usersWithoutAuthoringQualification: ['U001'],  // 鈴木花子: 作成者が実践研修未修了
    usersWithoutAssignmentQualification: ['U003'],  // 佐藤次郎: 資格なし職員が配置
    today,
  });
}

/**
 * デモ用: Iceberg 分析の根拠データ
 * sheet-1 には分析あり、sheet-2 には分析なし
 */
function generateDemoIcebergEvidence(): IcebergEvidenceBySheet {
  return {
    sessionCount: {
      'sheet-1': 3,
    },
    latestAnalysisDate: {
      'sheet-1': '2026-03-08',
    },
  };
}

// ─────────────────────────────────────────────
// severity 表示ヘルパー
// ─────────────────────────────────────────────

const SEVERITY_CONFIG: Record<AuditFindingSeverity, { color: 'error' | 'warning' | 'info'; label: string; icon: React.ReactNode }> = {
  high: { color: 'error', label: '高', icon: <ErrorOutlineIcon fontSize="small" /> },
  medium: { color: 'warning', label: '中', icon: <WarningAmberIcon fontSize="small" /> },
  low: { color: 'info', label: '低', icon: <InfoOutlinedIcon fontSize="small" /> },
};

// ─────────────────────────────────────────────
// サブコンポーネント
// ─────────────────────────────────────────────

interface SummaryCardProps {
  title: string;
  count: number;
  color: string;
  icon: React.ReactNode;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, count, color, icon }) => (
  <Card
    variant="outlined"
    sx={{
      p: 2.5,
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      borderLeft: `4px solid ${color}`,
      transition: 'box-shadow 0.2s ease-in-out',
      '&:hover': { boxShadow: 3 },
    }}
  >
    <Box sx={{ color, display: 'flex', alignItems: 'center' }}>{icon}</Box>
    <Box>
      <Typography variant="h4" fontWeight={800} color={color}>
        {count}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
    </Box>
  </Card>
);

interface TypeBreakdownProps {
  summary: AuditSummary;
  addonSummary?: SevereAddonSummary;
}

/** 加算系の種別カウントエントリ */
const ADDON_BREAKDOWN_ENTRIES: { key: keyof SevereAddonSummary; label: string }[] = [
  { key: 'trainingRatioInsufficientCount', label: '基礎研修比率不足' },
  { key: 'reassessmentOverdueCount', label: '再評価超過' },
  { key: 'weeklyObservationShortageCount', label: '週次観察不足' },
  { key: 'authoringRequirementUnmetCount', label: '作成者要件不備' },
  { key: 'assignmentWithoutQualificationCount', label: '資格なし配置' },
];

const TypeBreakdown: React.FC<TypeBreakdownProps> = ({ summary, addonSummary }) => (
  <Card variant="outlined" sx={{ p: 2.5 }}>
    <Typography variant="subtitle2" fontWeight={700} gutterBottom>
      検出種別
    </Typography>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
      {(Object.entries(summary.byType) as [AuditFindingType, number][]).map(([type, count]) => (
        <Chip
          key={type}
          label={`${AUDIT_FINDING_TYPE_LABELS[type]}: ${count}`}
          size="small"
          variant={count > 0 ? 'filled' : 'outlined'}
          color={count > 0 ? 'warning' : 'default'}
          sx={{ fontWeight: count > 0 ? 700 : 400 }}
        />
      ))}
    </Box>
    {addonSummary && (
      <>
        <Divider sx={{ my: 1.5 }} />
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
          加算系
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {ADDON_BREAKDOWN_ENTRIES.map(({ key, label }) => {
            const count = addonSummary[key] as number;
            return (
              <Chip
                key={String(key)}
                label={`${label}: ${count}`}
                size="small"
                variant={count > 0 ? 'filled' : 'outlined'}
                color={count > 0 ? 'error' : 'default'}
                sx={{ fontWeight: count > 0 ? 700 : 400, fontSize: '0.65rem' }}
              />
            );
          })}
        </Box>
      </>
    )}
  </Card>
);

// ─────────────────────────────────────────────
// 加算サマリーパネル
// ─────────────────────────────────────────────

/** 加算要件 → 遷移先マッピング */
const ADDON_REQUIREMENT_LINKS: Record<string, { path: string; label: string }> = {
  training:     { path: '/staff',               label: 'スタッフ管理を開く' },
  reassessment: { path: '/planning-sheet-list',  label: '支援計画シート一覧を開く' },
  observation:  { path: '/staff',               label: 'スタッフ管理を開く' },
  authoring:    { path: '/planning-sheet-list',  label: '支援計画シート一覧を開く' },
  assignment:   { path: '/staff',               label: 'スタッフ管理を開く' },
};

interface SevereAddonSummaryPanelProps {
  addonSummary: ReturnType<typeof summarizeSevereAddonFindings>;
  onNavigate: (url: string) => void;
  onFilterAddon: () => void;
}

const SevereAddonSummaryPanel: React.FC<SevereAddonSummaryPanelProps> = ({ addonSummary, onNavigate, onFilterAddon }) => {
  const hasIssues =
    addonSummary.trainingRatioInsufficientCount > 0 ||
    addonSummary.reassessmentOverdueCount > 0 ||
    addonSummary.weeklyObservationShortageCount > 0 ||
    addonSummary.authoringRequirementUnmetCount > 0 ||
    addonSummary.assignmentWithoutQualificationCount > 0;

  return (
    <Card
      variant="outlined"
      data-testid="severe-addon-summary-panel"
      sx={{
        p: 2.5,
        borderLeft: `4px solid ${hasIssues ? '#ed6c02' : '#2e7d32'}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <AccessibilityNewRoundedIcon sx={{ color: hasIssues ? 'warning.main' : 'success.main' }} />
        <Typography variant="subtitle1" fontWeight={700}>
          重度障害者支援加算
        </Typography>
        <Chip
          label={hasIssues ? '要対応あり' : '充足'}
          size="small"
          color={hasIssues ? 'warning' : 'success'}
          variant="filled"
          sx={{ fontWeight: 700, fontSize: '0.7rem', ml: 'auto' }}
        />
      </Box>

      {/* 候補者カウント */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, mb: 2 }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" fontWeight={800} color="primary.main">
            {addonSummary.tier2CandidateCount}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            加算（Ⅱ）候補
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" fontWeight={800} color="primary.main">
            {addonSummary.tier3CandidateCount}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            加算（Ⅲ）候補
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" fontWeight={800} color="secondary.main">
            {addonSummary.upperTierCandidateCount}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            上位区分候補
          </Typography>
        </Box>
      </Box>

      {/* 要件チェック状況 */}
      <Stack spacing={0.75}>
        <AddonRequirementRow
          icon={<SchoolRoundedIcon sx={{ fontSize: 16 }} />}
          label="基礎研修比率"
          count={addonSummary.trainingRatioInsufficientCount}
          okText="20%以上を充足"
          ngText={`${addonSummary.trainingRatioInsufficientCount}件の不足`}
          onAction={addonSummary.trainingRatioInsufficientCount > 0
            ? () => onNavigate(ADDON_REQUIREMENT_LINKS.training.path)
            : undefined}
          actionLabel={ADDON_REQUIREMENT_LINKS.training.label}
        />
        <AddonRequirementRow
          icon={<EventRepeatRoundedIcon sx={{ fontSize: 16 }} />}
          label="3か月再評価"
          count={addonSummary.reassessmentOverdueCount}
          okText="全員期限内"
          ngText={`${addonSummary.reassessmentOverdueCount}件超過`}
          onAction={addonSummary.reassessmentOverdueCount > 0
            ? () => onNavigate(ADDON_REQUIREMENT_LINKS.reassessment.path)
            : undefined}
          actionLabel={ADDON_REQUIREMENT_LINKS.reassessment.label}
        />
        <AddonRequirementRow
          icon={<VisibilityRoundedIcon sx={{ fontSize: 16 }} />}
          label="週次観察"
          count={addonSummary.weeklyObservationShortageCount}
          okText="全員実施済"
          ngText={`${addonSummary.weeklyObservationShortageCount}件不足`}
          onAction={addonSummary.weeklyObservationShortageCount > 0
            ? () => onNavigate(ADDON_REQUIREMENT_LINKS.observation.path)
            : undefined}
          actionLabel={ADDON_REQUIREMENT_LINKS.observation.label}
        />
        <AddonRequirementRow
          icon={<EditNoteRoundedIcon sx={{ fontSize: 16 }} />}
          label="作成者要件"
          count={addonSummary.authoringRequirementUnmetCount}
          okText="全員実践研修修了"
          ngText={`${addonSummary.authoringRequirementUnmetCount}件不備`}
          onAction={addonSummary.authoringRequirementUnmetCount > 0
            ? () => onNavigate(ADDON_REQUIREMENT_LINKS.authoring.path)
            : undefined}
          actionLabel={ADDON_REQUIREMENT_LINKS.authoring.label}
        />
        <AddonRequirementRow
          icon={<PersonOffRoundedIcon sx={{ fontSize: 16 }} />}
          label="配置資格"
          count={addonSummary.assignmentWithoutQualificationCount}
          okText="全員資格あり"
          ngText={`${addonSummary.assignmentWithoutQualificationCount}件不備`}
          onAction={addonSummary.assignmentWithoutQualificationCount > 0
            ? () => onNavigate(ADDON_REQUIREMENT_LINKS.assignment.path)
            : undefined}
          actionLabel={ADDON_REQUIREMENT_LINKS.assignment.label}
        />
      </Stack>

      {/* 加算 finding 一覧へ導線 */}
      <Divider sx={{ my: 1.5 }} />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          size="small"
          variant="text"
          color="secondary"
          startIcon={<FilterListRoundedIcon sx={{ fontSize: 14 }} />}
          onClick={onFilterAddon}
          data-testid="addon-filter-shortcut"
          sx={{ fontSize: '0.7rem', textTransform: 'none', fontWeight: 600 }}
        >
          加算チェック結果を一覧で見る
        </Button>
      </Box>
    </Card>
  );
};

/** 加算要件の1行表示（導線ボタン付き） */
const AddonRequirementRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  count: number;
  okText: string;
  ngText: string;
  onAction?: () => void;
  actionLabel?: string;
}> = ({ icon, label, count, okText, ngText, onAction, actionLabel }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
    {icon}
    <Typography variant="body2" sx={{ minWidth: 100 }} fontWeight={600}>
      {label}
    </Typography>
    <Chip
      label={count > 0 ? ngText : okText}
      size="small"
      color={count > 0 ? 'warning' : 'success'}
      variant={count > 0 ? 'filled' : 'outlined'}
      sx={{ fontWeight: 600, fontSize: '0.65rem' }}
    />
    {onAction && (
      <IconButton
        size="small"
        color="primary"
        onClick={onAction}
        title={actionLabel}
        data-testid={`addon-action-${label}`}
        sx={{ ml: 'auto', p: 0.5 }}
      >
        <ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />
      </IconButton>
    )}
  </Box>
);

// ─────────────────────────────────────────────
// 統合 finding 型 (AuditFinding + SevereAddonFinding → 共通行)
// ─────────────────────────────────────────────

/** テーブル表示用の統一行データ */
interface UnifiedFindingRow {
  id: string;
  severity: AuditFindingSeverity;
  typeLabel: string;
  userId: string;
  userName?: string;
  message: string;
  overdueDays?: number;
  dueDate?: string;
  /** regular finding or addon finding */
  source: 'regular' | 'addon';
  /** 元の finding（アクション解決用） */
  originalRegular?: AuditFinding;
  originalAddon?: SevereAddonFinding;
}

function unifyFindings(
  regularFindings: AuditFinding[],
  addonFindings: SevereAddonFinding[],
): UnifiedFindingRow[] {
  const rows: UnifiedFindingRow[] = [];

  for (const f of regularFindings) {
    rows.push({
      id: f.id,
      severity: f.severity,
      typeLabel: AUDIT_FINDING_TYPE_LABELS[f.type],
      userId: f.userId,
      userName: f.userName,
      message: f.message,
      overdueDays: f.overdueDays,
      dueDate: f.dueDate,
      source: 'regular',
      originalRegular: f,
    });
  }

  for (const f of addonFindings) {
    rows.push({
      id: f.id,
      severity: f.severity,
      typeLabel: SEVERE_ADDON_FINDING_TYPE_LABELS[f.type],
      userId: f.userId === '__facility__' ? '事業所全体' : f.userId,
      userName: f.userId === '__facility__' ? '事業所全体' : f.userName,
      message: f.message,
      overdueDays: f.overdueDays,
      dueDate: f.dueDate,
      source: 'addon',
      originalAddon: f,
    });
  }

  return rows;
}

/** 行からアクションボタン一覧を生成する */
function buildRowActions(row: UnifiedFindingRow): { label: string; url: string; kind: string }[] {
  if (row.source === 'regular' && row.originalRegular) {
    return buildFindingActions(row.originalRegular);
  }
  if (row.source === 'addon' && row.originalAddon) {
    return buildSevereAddonFindingActions(row.originalAddon);
  }
  return [];
}

// ─────────────────────────────────────────────
// 統合 findings テーブル
// ─────────────────────────────────────────────

interface FindingsTableProps {
  rows: UnifiedFindingRow[];
  filterSeverity: AuditFindingSeverity | 'all';
  filterSource: 'all' | 'regular' | 'addon';
  onNavigate: (url: string) => void;
  evidenceMap?: Map<string, FindingEvidenceSummary>;
}

const FindingsTable: React.FC<FindingsTableProps> = ({ rows, filterSeverity, filterSource, onNavigate, evidenceMap }) => {
  const filtered = useMemo(() => {
    let result = [...rows];
    if (filterSource !== 'all') result = result.filter(r => r.source === filterSource);
    if (filterSeverity !== 'all') result = result.filter(r => r.severity === filterSeverity);
    // severity 順: high → medium → low
    const order: Record<AuditFindingSeverity, number> = { high: 0, medium: 1, low: 2 };
    result.sort((a, b) => order[a.severity] - order[b.severity]);
    return result;
  }, [rows, filterSeverity, filterSource]);

  if (filtered.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <CheckCircleOutlineIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
        <Typography variant="h6" color="text.secondary">
          該当する検出事項はありません
        </Typography>
        <Typography variant="body2" color="text.secondary">
          すべての制度要件が充足されています
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'grey.50' }}>
            <TableCell sx={{ fontWeight: 700, width: 60 }}>重要度</TableCell>
            <TableCell sx={{ fontWeight: 700, width: 80 }}>区分</TableCell>
            <TableCell sx={{ fontWeight: 700, width: 160 }}>検出種別</TableCell>
            <TableCell sx={{ fontWeight: 700, width: 100 }}>利用者</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>メッセージ</TableCell>
            <TableCell sx={{ fontWeight: 700, width: 120 }}>期限</TableCell>
            <TableCell sx={{ fontWeight: 700, width: 180 }}>対応</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filtered.map(row => {
            const cfg = SEVERITY_CONFIG[row.severity];
            const actions = buildRowActions(row);
            return (
              <TableRow key={row.id} hover>
                <TableCell>
                  <Chip
                    icon={cfg.icon as React.ReactElement}
                    label={cfg.label}
                    color={cfg.color}
                    size="small"
                    variant="filled"
                    sx={{ fontWeight: 700 }}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={row.source === 'addon' ? '加算' : '制度'}
                    size="small"
                    variant="outlined"
                    color={row.source === 'addon' ? 'secondary' : 'default'}
                    sx={{ fontWeight: 600, fontSize: '0.65rem' }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>
                    {row.typeLabel}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {row.userName || row.userId}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {row.message}
                  </Typography>
                  {/* 根拠サマリーインライン表示（regular findings のみ） */}
                  {evidenceMap?.has(row.id) && (() => {
                    const ev = evidenceMap.get(row.id)!;
                    if (!ev.displayText) return null;
                    return (
                      <Typography
                        variant="caption"
                        data-testid={`evidence-summary-${row.id}`}
                        sx={{
                          display: 'block',
                          mt: 0.5,
                          color: ev.hasEvidence ? 'success.main' : 'warning.main',
                          fontWeight: 600,
                          fontSize: '0.65rem',
                        }}
                      >
                        {ev.hasEvidence ? '📊 ' : '⚠ '}
                        {ev.displayText}
                      </Typography>
                    );
                  })()}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color={row.overdueDays && row.overdueDays < 0 ? 'error.main' : 'text.secondary'}>
                    {row.dueDate || '—'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {actions.map((action, i) => (
                      <Button
                        key={i}
                        size="small"
                        variant={action.kind === 'execute' || action.kind === 'review' ? 'contained' : 'outlined'}
                        color={
                          action.kind === 'execute' || action.kind === 'review' ? 'primary'
                            : action.kind === 'evidence' ? 'secondary'
                            : 'inherit'
                        }
                        startIcon={
                          action.kind === 'evidence'
                            ? <PsychologyRoundedIcon sx={{ fontSize: 14 }} />
                            : <OpenInNewRoundedIcon sx={{ fontSize: 14 }} />
                        }
                        onClick={() => onNavigate(action.url)}
                        sx={{
                          fontSize: '0.7rem',
                          textTransform: 'none',
                          py: 0.25,
                          px: 1,
                          minWidth: 'auto',
                        }}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

// ─────────────────────────────────────────────
// メインページ
// ─────────────────────────────────────────────

const RegulatoryDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [filterSeverity, setFilterSeverity] = useState<AuditFindingSeverity | 'all'>('all');
  const [filterSource, setFilterSource] = useState<'all' | 'regular' | 'addon'>('all');

  // ── データ取得（共通） ──
  const { data: spUsers, status: usersStatus, error: usersError } = useUsers({ selectMode: 'full' });
  const { staff: spStaff, isLoading: staffLoading, error: staffError } = useStaff();
  const planningSheetRepo = usePlanningSheetRepositories();
  const procedureRecordRepo = useProcedureRecordRepository();
  const dataLoading = usersStatus === 'loading' || staffLoading;
  const dataError = usersError ? (usersError instanceof Error ? usersError : new Error(String(usersError))) : staffError;

  // 通常 findings — 実データ / デモフォールバック
  const {
    findings: realFindings,
    isLoading: findingsLoading,
    dataSourceLabel: findingsDataSource,
  } = useRegulatoryFindingsRealData(
    spUsers,
    spStaff,
    dataLoading,
    dataError,
    planningSheetRepo,
    procedureRecordRepo,
  );
  const findings = useMemo(
    () => (realFindings.length > 0 ? realFindings : generateDemoFindings()),
    [realFindings],
  );
  const summary = useMemo(() => summarizeFindings(findings), [findings]);

  // 加算系 findings — 実データ / デモフォールバック
  const { input: realAddonInput, dataSourceLabel: addonDataSource } = useSevereAddonRealData(
    spUsers,
    spStaff,
    dataLoading,
    dataError,
    planningSheetRepo,
    localWeeklyObservationRepository,
    localQualificationAssignmentRepository,
  );
  const addonFindings = useMemo(() => {
    if (realAddonInput) {
      _resetAddonFindingCounter();
      return buildSevereAddonFindings(realAddonInput);
    }
    return generateDemoSevereAddonFindings();
  }, [realAddonInput]);
  const addonSummary = useMemo(() => summarizeSevereAddonFindings(addonFindings), [addonFindings]);

  // 統合行データ
  const unifiedRows = useMemo(
    () => unifyFindings(findings, addonFindings),
    [findings, addonFindings],
  );

  // 統合 totals
  const totalAll = findings.length + addonFindings.length;
  const totalHigh = summary.high + addonFindings.filter(f => f.severity === 'high').length;
  const totalMedium = summary.medium + addonFindings.filter(f => f.severity === 'medium').length;
  const totalLow = summary.low + addonFindings.filter(f => f.severity === 'low').length;

  // P2: Iceberg 実データ接続 — useIcebergEvidence + デモフォールバック
  const demoUserId = findings[0]?.userId ?? null;
  const { data: liveEvidence, isLoading: isEvidenceLoading } = useIcebergEvidence(demoUserId);
  const isLiveData = liveEvidence !== null && !isEvidenceLoading;
  const icebergEvidence = useMemo(
    () => liveEvidence ?? generateDemoIcebergEvidence(),
    [liveEvidence],
  );
  const evidenceMap = useMemo(
    () => resolveAllFindingEvidence(findings, icebergEvidence),
    [findings, icebergEvidence],
  );

  return (
    <Container maxWidth="xl" sx={{ py: 3, minHeight: '100vh' }} data-testid="regulatory-dashboard-page">
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <GavelIcon sx={{ fontSize: 32, color: 'primary.main' }} />
        <Box>
          <Typography variant="h5" fontWeight={800}>
            制度遵守ダッシュボード
          </Typography>
          <Typography variant="body2" color="text.secondary">
            支援計画シートの制度要件充足状況・重度障害者支援加算の判定結果を一覧表示
          </Typography>
        </Box>
        <Chip
          label={isEvidenceLoading ? '根拠データ読込中…' : isLiveData ? 'Live データ' : 'デモデータ'}
          size="small"
          color={isLiveData ? 'success' : 'default'}
          variant={isLiveData ? 'filled' : 'outlined'}
          sx={{ ml: 'auto', fontWeight: 600, fontSize: '0.7rem' }}
        />
        <Chip
          label={findingsLoading ? '通常判定読込中…' : `通常: ${findingsDataSource}`}
          size="small"
          color={findingsDataSource === '実データ' ? 'success' : 'default'}
          variant={findingsDataSource === '実データ' ? 'filled' : 'outlined'}
          sx={{ fontWeight: 600, fontSize: '0.7rem' }}
        />
        <Chip
          label={`加算: ${addonDataSource}`}
          size="small"
          color={addonDataSource === '実データ' ? 'success' : 'default'}
          variant={addonDataSource === '実データ' ? 'filled' : 'outlined'}
          sx={{ fontWeight: 600, fontSize: '0.7rem' }}
        />
      </Box>

      {/* 統合集計カード */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          mb: 3,
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        }}
      >
        <SummaryCard title="要対応 合計" count={totalAll} color="#1976d2" icon={<GavelIcon fontSize="large" />} />
        <SummaryCard title="高リスク" count={totalHigh} color="#d32f2f" icon={<ErrorOutlineIcon fontSize="large" />} />
        <SummaryCard title="中リスク" count={totalMedium} color="#ed6c02" icon={<WarningAmberIcon fontSize="large" />} />
        <SummaryCard title="低リスク / 算定候補" count={totalLow} color="#0288d1" icon={<InfoOutlinedIcon fontSize="large" />} />
      </Box>

      {/* 種別内訳 + 加算サマリー + 安全管理サマリ */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          mb: 3,
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 380px' },
        }}
      >
        <TypeBreakdown summary={summary} addonSummary={addonSummary} />
        <SevereAddonSummaryPanel
          addonSummary={addonSummary}
          onNavigate={(url) => navigate(url)}
          onFilterAddon={() => {
            setFilterSource('addon');
            // findings テーブルへ自動スクロール
            document.getElementById('findings-table-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
        <SafetyOperationsSummaryCard />
      </Box>

      {/* フィルター */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="filter-source-label">検出区分</InputLabel>
          <Select
            labelId="filter-source-label"
            label="検出区分"
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value as 'all' | 'regular' | 'addon')}
          >
            <MenuItem value="all">すべて</MenuItem>
            <MenuItem value="regular">制度チェック</MenuItem>
            <MenuItem value="addon">加算チェック</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="filter-severity-label">重要度</InputLabel>
          <Select
            labelId="filter-severity-label"
            label="重要度"
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value as AuditFindingSeverity | 'all')}
          >
            <MenuItem value="all">すべて</MenuItem>
            <MenuItem value="high">高</MenuItem>
            <MenuItem value="medium">中</MenuItem>
            <MenuItem value="low">低</MenuItem>
          </Select>
        </FormControl>

        <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
          {unifiedRows.length} 件の検出事項
          {addonFindings.length > 0 && (
            <Chip
              label={`うち加算 ${addonFindings.length} 件`}
              size="small"
              color="secondary"
              variant="outlined"
              sx={{ ml: 1, fontWeight: 600, fontSize: '0.65rem' }}
            />
          )}
        </Typography>
      </Box>

      {/* 統合 findings テーブル */}
      <Box id="findings-table-section">
        <FindingsTable
          rows={unifiedRows}
          filterSeverity={filterSeverity}
          filterSource={filterSource}
          onNavigate={(url) => navigate(url)}
          evidenceMap={evidenceMap}
        />
      </Box>
    </Container>
  );
};

export default RegulatoryDashboardPage;
