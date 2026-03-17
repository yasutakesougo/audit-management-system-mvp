/**
 * MonitoringDashboardSection — 日次集計ダッシュボード + ISP判断記録
 *
 * MonitoringDailyDashboard への props 配線と保存中インジケーターを表示。
 * 状態は useMonitoringTabState().dashboardState から受け取る。
 */
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

import MonitoringDailyDashboard from '@/features/monitoring/components/MonitoringDailyDashboard';
import type { useMonitoringTabState } from '../../hooks/useMonitoringTabState';

type DashboardState = ReturnType<typeof useMonitoringTabState>['dashboardState'];

export type MonitoringDashboardSectionProps = {
  isAdmin: boolean;
} & DashboardState;

const MonitoringDashboardSection: React.FC<MonitoringDashboardSectionProps> = ({
  summary,
  insightLines,
  recordCount,
  isAdmin,
  goalNames,
  decisionStatuses,
  decisionNotes,
  decisions,
  isDecisionSaving,
  isSavingDraft,
  hasSavedDraft,
  savedRecords,
  onDecision,
  onSaveDraft,
  onApplyToEditor,
  onReapplyBatch,
  onAppendInsight,
}) => (
  <>
    <MonitoringDailyDashboard
      summary={summary}
      insightLines={insightLines}
      recordCount={recordCount}
      isAdmin={isAdmin}
      goalNames={goalNames}
      decisionStatuses={decisionStatuses}
      decisionNotes={decisionNotes}
      onDecision={onDecision}
      decisions={decisions}
      onAppendInsight={onAppendInsight}
      onSaveDraft={onSaveDraft}
      isSavingDraft={isSavingDraft}
      hasSavedDraft={hasSavedDraft}
      onApplyToEditor={onApplyToEditor}
      savedRecords={savedRecords}
      onReapplyBatch={onReapplyBatch}
    />

    {/* ISP 判断保存中インジケーター */}
    {isDecisionSaving && (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ pl: 1 }}>
        <CircularProgress size={14} />
        <Typography variant="caption" color="text.secondary">
          判断を保存中…
        </Typography>
      </Stack>
    )}
  </>
);

export default React.memo(MonitoringDashboardSection);
