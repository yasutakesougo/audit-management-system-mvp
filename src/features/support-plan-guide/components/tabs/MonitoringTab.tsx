/**
 * MonitoringTab — モニタリングタブ（オーケストレーター）
 *
 * SectionKey: 'monitoring'
 *
 * ## 設計原則
 * - useMonitoringTabState() から state を受ける
 * - 各 Section に props を渡す
 * - 並べるだけ
 *
 * ## 責務マップ
 * MonitoringTab (this file) = page orchestrator
 *   ├ MonitoringDashboardSection  = 日次集計 + ISP判断
 *   ├ MonitoringEvidencePanel     = 日次記録/Iceberg引用 + 再分析リンク
 *   ├ MonitoringFieldSection      = FieldCard×3
 *   └ useMonitoringTabState       = orchestration hook
 */
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { ToastState } from '../../types';
import { findSection } from '../../utils/helpers';
import { useMonitoringTabState } from '../../hooks/useMonitoringTabState';

import MonitoringDashboardSection from './MonitoringDashboardSection';
import MonitoringEvidencePanel from './MonitoringEvidencePanel';
import MonitoringFieldSection from './MonitoringFieldSection';
import type { SectionTabProps } from './tabProps';

export type MonitoringTabProps = SectionTabProps & {
  /** アクティブドラフトのuserId（エビデンス取得用） */
  userId: string | number | null | undefined;
  /** トースト表示用 */
  setToast: (toast: ToastState) => void;
};

const MonitoringTab: React.FC<MonitoringTabProps> = ({ userId, setToast, ...sectionProps }) => {
  const section = findSection('monitoring');

  const {
    userIdStr,
    dashboardState,
    evidenceState,
    feedbackState,
  } = useMonitoringTabState({
    userId,
    form: sectionProps.form,
    isAdmin: sectionProps.isAdmin,
    onFieldChange: sectionProps.onFieldChange,
    setToast,
  });

  if (!section) return null;

  return (
    <Stack spacing={2}>
      {section.description ? (
        <Typography variant="subtitle1" component="span" sx={{ color: 'text.secondary' }}>
          {section.description}
        </Typography>
      ) : null}

      {/* 日次集計ダッシュボード + ISP 判断記録 */}
      {userIdStr && (
        <MonitoringDashboardSection
          isAdmin={sectionProps.isAdmin}
          {...dashboardState}
        />
      )}

      {/* 日次記録 + Iceberg PDCA エビデンス引用 + 再分析リンク */}
      {userIdStr && (
        <MonitoringEvidencePanel
          userId={userIdStr}
          isAdmin={sectionProps.isAdmin}
          {...evidenceState}
        />
      )}

      {/* フィールド入力（monitoringPlan / reviewTiming / lastMonitoringDate） */}
      <MonitoringFieldSection
        section={section}
        form={sectionProps.form}
        isAdmin={sectionProps.isAdmin}
        onFieldChange={sectionProps.onFieldChange}
        onAppendPhrase={sectionProps.onAppendPhrase}
        guardAdmin={sectionProps.guardAdmin}
      />

      {/* フィードバック Snackbar */}
      <Snackbar
        open={feedbackState.state.open}
        autoHideDuration={3000}
        onClose={feedbackState.close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={feedbackState.state.severity}
          variant="filled"
          onClose={feedbackState.close}
          sx={{ width: '100%' }}
        >
          {feedbackState.state.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
};

export default React.memo(MonitoringTab);
