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
 *   ├ MeetingEvidenceDraftPanel   = 会議ドラフト自動引用
 *   ├ MonitoringEvidencePanel     = 日次記録/Iceberg引用 + 再分析リンク
 *   ├ MonitoringFieldSection      = FieldCard×3
 *   └ useMonitoringTabState       = orchestration hook
 */
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';
import { useNavigate } from 'react-router-dom';

import type { ToastState } from '../../types';
import { findSection } from '../../utils/helpers';
import { useMonitoringTabState } from '../../hooks/useMonitoringTabState';

import MonitoringDashboardSection from './MonitoringDashboardSection';
import MeetingEvidenceDraftPanel from '@/features/monitoring/components/MeetingEvidenceDraftPanel';
import MonitoringEvidencePanel from './MonitoringEvidencePanel';
import MonitoringFieldSection from './MonitoringFieldSection';
import type { SectionTabProps } from './tabProps';

export type MonitoringTabProps = SectionTabProps & {
  /** アクティブドラフトのuserId（エビデンス取得用） */
  userId: string | number | null | undefined;
  /** 利用者名（会議ドラフトヘッダー用） */
  userName: string;
  /** トースト表示用 */
  setToast: (toast: ToastState) => void;
};

const MonitoringTab: React.FC<MonitoringTabProps> = ({ userId, userName, setToast, ...sectionProps }) => {
  const section = findSection('monitoring');
  const navigate = useNavigate();

  const {
    userIdStr,
    dashboardState,
    evidenceState,
    meetingDraftState,
    feedbackState,
  } = useMonitoringTabState({
    userId,
    userName,
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

      {/* 支援計画シート側のモニタリング会議記録への導線 */}
      {userIdStr && (
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            borderLeft: 4,
            borderColor: 'primary.main',
            bgcolor: 'action.hover',
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={2}
            flexWrap="wrap"
          >
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>
                支援計画シート：モニタリング会議記録
              </Typography>
              <Typography variant="caption" color="text.secondary">
                強度行動障害支援における会議の実施記録・確定・監査用PDF出力はこちらから行います。
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="small"
              startIcon={<AssignmentRoundedIcon />}
              onClick={() => navigate(`/monitoring-meeting/${userIdStr}`)}
              data-testid="navigate-monitoring-meeting-record-btn"
            >
              支援計画シートのモニタリング会議を開く
            </Button>
          </Stack>
        </Paper>
      )}

      {/* 日次集計ダッシュボード + ISP 判断記録 */}
      {userIdStr && (
        <MonitoringDashboardSection
          isAdmin={sectionProps.isAdmin}
          {...dashboardState}
        />
      )}

      {/* 会議用エビデンスドラフト自動引用 */}
      {userIdStr && (
        <MeetingEvidenceDraftPanel
          evidence={meetingDraftState.evidence}
          onAppendToField={meetingDraftState.onAppendToField}
          isAdmin={sectionProps.isAdmin}
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
