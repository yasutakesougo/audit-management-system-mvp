/**
 * PlanSelectionStep — Step 2: 支援手順 (Plan) 選択
 *
 * 選択利用者のスケジュール一覧を表示。
 * 時間帯をタップすると自動的に Step 3 (行動記録) へ遷移する。
 *
 * Step2 強化（v2）:
 *   ・利用者の支援状況サマリーバー（モニタリング残日数、計画状態、ABC件数）
 *   ・関連導線（ABC記録・氷山PDCA・支援計画シート）
 *   ・記録進捗プログレスバー
 */
import { buildAbcCountBySlot, type AbcCountBySlot } from '@/domain/abc/buildAbcCountBySlot';
import { useLinkedStrategies } from '@/features/daily/hooks/useLinkedStrategies';
import { AbcSlotDialog } from './AbcSlotDialog';
import { StrategyReferenceAccordion } from './StrategyReferenceAccordion';
import type { SupportPlanningSheet } from '@/domain/isp/schema';
import type { BehaviorInterventionPlan } from '@/features/analysis/domain/interventionTypes';
import { computeMonitoringCycle } from '@/features/daily/components/MonitoringCountdown';
import type { MonitoringCycleResult } from '@/features/daily/components/MonitoringCountdown';
import { ProcedurePanel, type ScheduleItem } from '@/features/daily/components/split-stream/ProcedurePanel';
import { getScheduleKey } from '@/features/daily/domain/getScheduleKey';
import { localAbcRecordRepository } from '@/infra/localStorage/localAbcRecordRepository';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import BubbleChartIcon from '@mui/icons-material/BubbleChart';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AbcRecord } from '@/domain/abc/abcRecord';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type PlanSelectionStepProps = {
  /** 選択されたユーザー名 */
  userName: string;
  /** スケジュールリスト */
  schedule: ScheduleItem[];
  /** 記録済みスロット一覧 */
  filledStepIds: Set<string>;
  /** 未記入フィルタ */
  showUnfilledOnly: boolean;
  onToggleUnfilledOnly: () => void;
  unfilledCount: number;
  totalCount: number;
  /** BIP 介入計画 */
  interventionPlans?: BehaviorInterventionPlan[];
  /** Plan 項目タップ → 自動で Step 3 遷移 */
  onSelectSlot: (stepId: string) => void;
  /** 戻るボタン → Step 1 */
  onBack: () => void;
  /** 行動分析 (Iceberg PDCA) への導線 */
  onIcebergAnalysis?: () => void;
  /** ABC記録画面への導線 */
  onAbcRecord?: () => void;
  /** 選択中ユーザーID（状態サマリー計算用、optional） */
  userId?: string;
  /** ユーザーのアセスメント日（モニタリング計算用、optional） */
  lastAssessmentDate?: string | null;
  /** スロットごとの選択可否状態（競合の有無） */
  selectableStateByStepId?: Map<string, { conflicted: boolean; blockingOrders: number[] }>;
  /** 非表示にする手順オーダー */
  hiddenStepOrders?: Set<number>;
};


// ─────────────────────────────────────────────
// ABC 件数カウント（今日）
// ─────────────────────────────────────────────

type AbcTodayData = {
  todayCount: number;
  latestDate: string | null;
  abcCountBySlot: AbcCountBySlot;
  allRecords: AbcRecord[];
};

function useAbcTodayCount(userId?: string): AbcTodayData {
  const [data, setData] = useState<AbcTodayData>({
    todayCount: 0,
    latestDate: null,
    abcCountBySlot: {},
    allRecords: [],
  });

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    (async () => {
      try {
        const all: AbcRecord[] = await localAbcRecordRepository.getAll();
        const today = new Date().toISOString().slice(0, 10);
        let count = 0;
        let latest: string | null = null;
        for (const r of all) {
          if (r.userId !== userId) continue;
          if (r.occurredAt.slice(0, 10) === today) count++;
          if (!latest || r.occurredAt > latest) latest = r.occurredAt;
        }
        const countBySlot = buildAbcCountBySlot(all, userId, today);
        if (mounted) setData({ todayCount: count, latestDate: latest, abcCountBySlot: countBySlot, allRecords: all });
      } catch {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [userId]);

  return data;
}

// ─────────────────────────────────────────────
// 支援計画シート状態
// ─────────────────────────────────────────────

function usePlanStatus(userId?: string): { label: string; color: 'success' | 'warning' | 'default' } {
  const [status, setStatus] = useState<{ label: string; color: 'success' | 'warning' | 'default' }>({
    label: '未確認',
    color: 'default',
  });

  useEffect(() => {
    if (!userId) return;
    try {
      const raw = localStorage.getItem('planningSheet.versions.v1');
      if (!raw) {
        setStatus({ label: '未作成', color: 'default' });
        return;
      }
      const all: SupportPlanningSheet[] = JSON.parse(raw);
      const active = all.find(
        (s) => s.userId === userId && s.status === 'active' && s.isCurrent,
      );
      if (active) {
        setStatus({ label: `有効 v${active.version}`, color: 'success' });
      } else {
        const draft = all.find((s) => s.userId === userId && s.status === 'draft');
        if (draft) {
          setStatus({ label: '下書き', color: 'warning' });
        } else {
          setStatus({ label: '未作成', color: 'default' });
        }
      }
    } catch {
      setStatus({ label: '未確認', color: 'default' });
    }
  }, [userId]);

  return status;
}

// ─────────────────────────────────────────────
// Status Summary Bar
// ─────────────────────────────────────────────

const StatusSummaryBar: React.FC<{
  userId?: string;
  lastAssessmentDate?: string | null;
  totalCount: number;
  unfilledCount: number;
  onIcebergAnalysis?: () => void;
  onAbcRecord?: () => void;
}> = memo(({ userId, lastAssessmentDate, totalCount, unfilledCount, onIcebergAnalysis, onAbcRecord }) => {
  const { todayCount: abcTodayCount } = useAbcTodayCount(userId);
  const planStatus = usePlanStatus(userId);

  const monitoringCycle: MonitoringCycleResult | null = useMemo(() => {
    if (!lastAssessmentDate) return null;
    return computeMonitoringCycle(new Date(`${lastAssessmentDate}T00:00:00`), new Date());
  }, [lastAssessmentDate]);

  const filledCount = totalCount - unfilledCount;
  const progress = totalCount > 0 ? (filledCount / totalCount) * 100 : 0;

  return (
    <Box
      sx={{
        px: 2,
        py: 1,
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      {/* ── Progress bar ── */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ minWidth: 72 }}>
          記録進捗
        </Typography>
        <LinearProgress
          variant="determinate"
          value={progress}
          color={progress >= 100 ? 'success' : 'primary'}
          sx={{
            flex: 1,
            height: 6,
            borderRadius: 3,
            bgcolor: 'grey.200',
            '& .MuiLinearProgress-bar': { borderRadius: 3 },
          }}
        />
        <Typography variant="caption" fontWeight={700} color={progress >= 100 ? 'success.main' : 'text.primary'}>
          {filledCount}/{totalCount}
        </Typography>
      </Stack>

      {/* ── Status chips + Action buttons ── */}
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
        {/* 支援計画シート */}
        <Chip
          icon={<AssignmentRoundedIcon />}
          label={`計画: ${planStatus.label}`}
          size="small"
          color={planStatus.color}
          variant={planStatus.color === 'default' ? 'outlined' : 'filled'}
          sx={{ fontSize: '0.7rem', height: 22 }}
        />

        {/* モニタリング */}
        {monitoringCycle && (
          <Chip
            icon={<EventRoundedIcon />}
            label={`会議まで${monitoringCycle.remaining}日`}
            size="small"
            color={monitoringCycle.remaining <= 14 ? 'error' : monitoringCycle.remaining <= 30 ? 'warning' : 'default'}
            variant="outlined"
            sx={{ fontSize: '0.7rem', height: 22 }}
          />
        )}

        {/* ABC 記録 */}
        <Chip
          icon={<EditNoteRoundedIcon />}
          label={abcTodayCount > 0 ? `ABC ${abcTodayCount}件` : '今日未記録'}
          size="small"
          color={abcTodayCount > 0 ? 'info' : 'default'}
          variant="outlined"
          sx={{ fontSize: '0.7rem', height: 22 }}
        />

        {/* ── 直接導線ボタン群 ── */}
        <Box sx={{ ml: 'auto', display: 'flex', gap: 0.75 }}>
          {onAbcRecord && (
            <Button
              size="small"
              variant="outlined"
              color="info"
              startIcon={<EditNoteRoundedIcon />}
              onClick={onAbcRecord}
              data-testid="plan-step-abc-cta"
              sx={{
                textTransform: 'none',
                fontSize: '0.75rem',
                py: 0.25,
                borderRadius: 2,
              }}
            >
              ABC記録へ
            </Button>
          )}
          {onIcebergAnalysis && (
            <Button
              size="small"
              variant="outlined"
              color="secondary"
              startIcon={<BubbleChartIcon />}
              onClick={onIcebergAnalysis}
              data-testid="plan-step-iceberg-cta"
              sx={{
                textTransform: 'none',
                fontSize: '0.75rem',
                py: 0.25,
                borderRadius: 2,
              }}
            >
              氷山PDCAへ
            </Button>
          )}
        </Box>
      </Stack>
    </Box>
  );
});
StatusSummaryBar.displayName = 'StatusSummaryBar';

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export const PlanSelectionStep: React.FC<PlanSelectionStepProps> = memo(({
  userName,
  schedule,
  filledStepIds,
  showUnfilledOnly,
  onToggleUnfilledOnly,
  unfilledCount,
  totalCount,
  interventionPlans,
  onSelectSlot,
  onBack,
  onIcebergAnalysis,
  onAbcRecord,
  userId,
  lastAssessmentDate,
  selectableStateByStepId,
  hiddenStepOrders,
}) => {

  const navigate = useNavigate();

  // ── 参照戦略の取得 ──
  const linkedStrategies = useLinkedStrategies(userId);

  const handleNavigateToSheet = useCallback((sheetId: string) => {
    navigate(`/support-planning-sheet/${sheetId}?tab=planning`);
  }, [navigate]);
  // Plan 項目タップ時に onSelectSlot を呼ぶ
  const handleStepSelect = useCallback((step: ScheduleItem | string, _stepId?: string) => {
    let resolvedId: string;
    if (typeof step === 'string') {
      resolvedId = step;
    } else {
      resolvedId = getScheduleKey(step.time, step.activity);
    }
    onSelectSlot(resolvedId);
  }, [onSelectSlot]);

  // ABC 件数をスロット別に集計
  const { allRecords: abcAllRecords } = useAbcTodayCount(userId);

  // ABC スロットダイアログ state
  const [abcDialogOpen, setAbcDialogOpen] = useState(false);

  const handleAbcDialogClose = useCallback(() => {
    setAbcDialogOpen(false);
  }, []);

  const abcDialogRecords = useMemo(() => {
    if (!abcDialogOpen || !userId) return [];
    // Note: Since we removed slot-specific badge clicks, this diallog shows all for now
    return abcAllRecords;
  }, [abcDialogOpen, userId, abcAllRecords]);

  return (
    <Box sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 1.5, pb: 1 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
          size="small"
          sx={{ textTransform: 'none' }}
        >
          利用者選択
        </Button>
        <Typography variant="h6" fontWeight={600} sx={{ flex: 1 }}>
          {userName} 様
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {totalCount - unfilledCount}/{totalCount} 件記録済み
        </Typography>
      </Box>

      {/* ── Status Summary Bar ── */}
      <StatusSummaryBar
        userId={userId}
        lastAssessmentDate={lastAssessmentDate}
        totalCount={totalCount}
        unfilledCount={unfilledCount}
        onIcebergAnalysis={onIcebergAnalysis}
        onAbcRecord={onAbcRecord}
      />

      {/* ── Strategy Reference Accordion ── */}
      <StrategyReferenceAccordion
        strategies={linkedStrategies}
        onNavigateToSheet={handleNavigateToSheet}
      />

      {/* ── Procedure panel ── */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <ProcedurePanel
          title="時間帯を選択してください"
          schedule={schedule}
          onSelectStep={handleStepSelect}
          filledStepIds={filledStepIds}
          showUnfilledOnly={showUnfilledOnly}
          onToggleUnfilledOnly={onToggleUnfilledOnly}
          unfilledCount={unfilledCount}
          totalCount={totalCount}
          interventionPlans={interventionPlans}
          selectableStateByStepId={selectableStateByStepId}
          hiddenStepOrders={hiddenStepOrders}
        />

      </Box>

      {/* ── ABC Slot Dialog ── */}
      <AbcSlotDialog
        open={abcDialogOpen}
        onClose={handleAbcDialogClose}
        slotLabel="今日のABC記録"
        records={abcDialogRecords}
        userId={userId}
      />
    </Box>
  );
});

PlanSelectionStep.displayName = 'PlanSelectionStep';
