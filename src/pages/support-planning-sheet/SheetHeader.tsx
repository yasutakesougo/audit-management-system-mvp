/**
 * SheetHeader — 支援計画シート ヘッダー部
 *
 * タイトル、ステータス、編集ツールバー、モニタリングスケジュール帯、Iceberg帯を描画。
 * 全ての状態は props 経由で受け取る（state を持たない）。
 */
import React from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import LoopRoundedIcon from '@mui/icons-material/LoopRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';

import type { SupportPlanningSheet } from '@/domain/isp/schema';
import { PLANNING_SHEET_STATUS_DISPLAY } from '@/domain/isp/schema';
import type { IcebergEvidenceBySheet } from '@/domain/regulatory/findingEvidenceSummary';
import { calculateMonitoringSchedule, resolveSupportStartDate } from '@/features/planning-sheet/monitoringSchedule';
import { TESTIDS, tid } from '@/testids';
import { statusColor } from './types';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface SheetHeaderProps {
  sheet: SupportPlanningSheet;
  isEditing: boolean;
  isDirty: boolean;
  isSaving: boolean;
  isValid: boolean;
  hasAssessment: boolean;
  hasMonitoringRecord: boolean;
  icebergEvidence: IcebergEvidenceBySheet | null | undefined;
  onBack: () => void;
  onEdit: () => void;
  onReset: () => void;
  onSave: () => void;
  onImportAssessment: () => void;
  onImportMonitoring: () => void;
  /** 支援手順の実施ボタンのクリック（IBD対象者のみ表示） */
  onNavigateToExecution?: () => void;
  /** 見直し・PDCAボタンのクリック（IBD対象者のみ表示） */
  onNavigateToPdca?: () => void;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

const SheetHeader: React.FC<SheetHeaderProps> = ({
  sheet,
  isEditing,
  isDirty,
  isSaving,
  isValid,
  hasAssessment,
  hasMonitoringRecord,
  icebergEvidence,
  onBack,
  onEdit,
  onReset,
  onSave,
  onImportAssessment,
  onImportMonitoring,
  onNavigateToExecution,
  onNavigateToPdca,
}) => (
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
          onClick={onBack}
        >
          個別支援計画画面
        </Button>

        {/* ── IBD専用アクション: 支援手順の実施 / 見直し・PDCA ── */}
        {(onNavigateToExecution || onNavigateToPdca) && (
          <Stack direction="row" spacing={1}>
            {onNavigateToExecution && (
              <Button
                size="small"
                variant="contained"
                color="primary"
                startIcon={<PlayArrowRoundedIcon />}
                onClick={onNavigateToExecution}
                data-testid={TESTIDS['planning-sheet-go-to-execution']}
              >
                支援手順の実施
              </Button>
            )}
            {onNavigateToPdca && (
              <Button
                size="small"
                variant="outlined"
                color="secondary"
                startIcon={<LoopRoundedIcon />}
                onClick={onNavigateToPdca}
                data-testid={TESTIDS['planning-sheet-go-to-pdca']}
              >
                見直し・PDCA
              </Button>
            )}
          </Stack>
        )}

        {/* ── 編集ツールバー ── */}
        <Stack direction="row" spacing={1} alignItems="center">
          {isEditing ? (
            <>
              {isDirty && (
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
                onClick={onImportAssessment}
                disabled={!hasAssessment || isSaving}
              >
                アセスメントから取込
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="secondary"
                startIcon={<AssessmentRoundedIcon />}
                onClick={onImportMonitoring}
                disabled={!hasMonitoringRecord || isSaving}
              >
                行動モニタリングから反映
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<UndoRoundedIcon />}
                onClick={onReset}
                disabled={isSaving}
              >
                リセット
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={isSaving ? <CircularProgress size={16} /> : <SaveRoundedIcon />}
                onClick={onSave}
                disabled={!isDirty || !isValid || isSaving}
              >
                {isSaving ? '保存中…' : '保存'}
              </Button>
            </>
          ) : (
            <Button
              size="small"
              variant="outlined"
              startIcon={<EditRoundedIcon />}
              onClick={onEdit}
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
);

export default SheetHeader;
