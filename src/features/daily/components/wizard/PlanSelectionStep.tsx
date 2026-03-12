/**
 * PlanSelectionStep — Step 2: 支援手順 (Plan) 選択
 *
 * 選択利用者のスケジュール一覧を表示。
 * 時間帯をタップすると自動的に Step 3 (行動記録) へ遷移する。
 */
import type { BehaviorInterventionPlan } from '@/features/analysis/domain/interventionTypes';
import { ProcedurePanel, type ScheduleItem } from '@/features/daily/components/split-stream/ProcedurePanel';
import { getScheduleKey } from '@/features/daily/domain/getScheduleKey';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BubbleChartIcon from '@mui/icons-material/BubbleChart';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { memo, useCallback } from 'react';

export type PlanSelectionStepProps = {
  /** 選択されたユーザー名 */
  userName: string;
  /** スケジュールリスト */
  schedule: ScheduleItem[];
  /** 確認済みフラグ */
  isAcknowledged: boolean;
  onAcknowledged: () => void;
  /** 記録済みスロット一覧 */
  filledStepIds: Set<string>;
  /** 未記入フィルタ */
  showUnfilledOnly: boolean;
  onToggleUnfilledOnly: () => void;
  unfilledCount: number;
  totalCount: number;
  /** BIP 介入計画 */
  interventionPlans?: BehaviorInterventionPlan[];
  /** 保存済み観察メモ */
  savedObservations?: Map<string, string>;
  /** Plan 項目タップ → 自動で Step 3 遷移 */
  onSelectSlot: (stepId: string) => void;
  /** 戻るボタン → Step 1 */
  onBack: () => void;
  /** 行動分析 (Iceberg PDCA) への導線 */
  onIcebergAnalysis?: () => void;
};

export const PlanSelectionStep: React.FC<PlanSelectionStepProps> = memo(({
  userName,
  schedule,
  isAcknowledged,
  onAcknowledged,
  filledStepIds,
  showUnfilledOnly,
  onToggleUnfilledOnly,
  unfilledCount,
  totalCount,
  interventionPlans,
  savedObservations,
  onSelectSlot,
  onBack,
  onIcebergAnalysis,
}) => {
  // Plan 項目タップ時に onSelectSlot を呼ぶ（→ wizard が Step 3 へ遷移）
  // NOTE: getScheduleKey を使ってキーを生成し、RecordPanel と一貫性を保つ
  const handleStepSelect = useCallback((step: ScheduleItem | string, _stepId?: string) => {
    let resolvedId: string;
    if (typeof step === 'string') {
      resolvedId = step;
    } else {
      // Always use getScheduleKey for consistent format with RecordPanel/PlanSlotSelector
      resolvedId = getScheduleKey(step.time, step.activity);
    }
    onSelectSlot(resolvedId);
  }, [onSelectSlot]);

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
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
        {onIcebergAnalysis && (
          <Tooltip title="行動分析（Iceberg PDCA）">
            <IconButton
              size="small"
              color="secondary"
              onClick={onIcebergAnalysis}
              data-testid="plan-step-iceberg-cta"
              aria-label="行動分析"
            >
              <BubbleChartIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Typography variant="caption" color="text.secondary">
          {totalCount - unfilledCount}/{totalCount} 件記録済み
        </Typography>
      </Box>

      {/* ── Procedure panel (既存コンポーネント再利用) ── */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <ProcedurePanel
          title="時間帯を選択してください"
          schedule={schedule}
          isAcknowledged={isAcknowledged}
          onAcknowledged={onAcknowledged}
          onSelectStep={handleStepSelect}
          filledStepIds={filledStepIds}
          showUnfilledOnly={showUnfilledOnly}
          onToggleUnfilledOnly={onToggleUnfilledOnly}
          unfilledCount={unfilledCount}
          totalCount={totalCount}
          interventionPlans={interventionPlans}
          savedObservations={savedObservations}
        />
      </Box>
    </Box>
  );
});

PlanSelectionStep.displayName = 'PlanSelectionStep';
