/**
 * RegulatorySummaryBand — SupportPlanGuidePage 上部の制度サマリー帯
 *
 * SupportPlanBundle のデータを使って、
 * ISP ステータス・シート数・Iceberg 分析件数・実施記録数・
 * 直近モニタリング・再分析推奨を表示する。
 *
 * この帯が表示されることで、支援者はシートを開く前に
 * 「制度的にどういう状況か」をひと目で把握できる。
 */
import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import { ISP_STATUS_DISPLAY } from '@/domain/isp/schema';
import type { IspStatus, SupportPlanBundle } from '@/domain/isp/schema';

type RegulatorySummaryBandProps = {
  bundle: SupportPlanBundle;
};

/**
 * 再分析推奨かどうかを判定する。
 *
 * ルール:
 * - latestMonitoring.planChangeRequired === true → 推奨
 * - latestMonitoring がない → 推奨
 * - latestMonitoring が 180 日以上前 → 推奨
 */
function shouldRecommendReanalysis(
  monitoring: SupportPlanBundle['latestMonitoring'],
): boolean {
  if (!monitoring) return true;
  if (monitoring.planChangeRequired) return true;

  const monitoringDate = new Date(monitoring.date);
  const daysSince = Math.floor(
    (Date.now() - monitoringDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  return daysSince >= 180;
}

/**
 * 実施記録の総数を集計する。
 */
function totalRecordCount(countBySheet?: Record<string, number>): number {
  if (!countBySheet) return 0;
  return Object.values(countBySheet).reduce((a, b) => a + b, 0);
}

/**
 * ISP ステータスのラベルを返す。
 * ISP_STATUS_DISPLAY に存在しない場合はそのまま返す。
 */
function ispStatusLabel(status: IspStatus): string {
  return ISP_STATUS_DISPLAY[status] ?? status;
}

export const RegulatorySummaryBand: React.FC<RegulatorySummaryBandProps> = ({ bundle }) => {
  const icebergTotal = useMemo(() => {
    if (!bundle.icebergCountBySheet) return 0;
    return Object.values(bundle.icebergCountBySheet).reduce((a, b) => a + b, 0);
  }, [bundle.icebergCountBySheet]);

  const recordTotal = useMemo(
    () => totalRecordCount(bundle.procedureRecordCountBySheet),
    [bundle.procedureRecordCountBySheet],
  );

  const needsReanalysis = useMemo(
    () => shouldRecommendReanalysis(bundle.latestMonitoring),
    [bundle.latestMonitoring],
  );

  const nextReview = bundle.isp.nextReviewAt;
  const daysUntilReview = useMemo(() => {
    if (!nextReview) return null;
    const due = new Date(nextReview);
    const now = new Date();
    return Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }, [nextReview]);

  const sheetCount = bundle.planningSheetCount ?? 0;

  return (
    <Paper
      variant="outlined"
      data-testid="regulatory-summary-band"
      sx={{
        p: { xs: 1.5, md: 2 },
        background: (theme) =>
          theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(30,60,90,0.5) 0%, rgba(20,40,60,0.5) 100%)'
            : 'linear-gradient(135deg, rgba(232,245,255,0.8) 0%, rgba(240,248,255,0.9) 100%)',
        borderColor: (theme) =>
          needsReanalysis
            ? theme.palette.warning.main
            : theme.palette.divider,
      }}
    >
      <Stack spacing={1.5}>
        {/* ── ヘッダー行 ── */}
        <Stack direction="row" alignItems="center" spacing={1}>
          <AssessmentRoundedIcon fontSize="small" color="primary" />
          <Typography variant="subtitle2" fontWeight={600}>
            制度サマリー
          </Typography>
        </Stack>

        {/* ── チップ行: メイン指標 ── */}
        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          alignItems="center"
        >
          {/* ISP ステータス */}
          <Chip
            size="small"
            variant="outlined"
            label={`ISP: ${ispStatusLabel(bundle.isp.status)}`}
            color="primary"
          />

          {/* シート数 */}
          <Chip
            size="small"
            variant="outlined"
            icon={<DescriptionRoundedIcon />}
            label={`シート: ${sheetCount}件`}
          />

          {/* Iceberg 分析件数 */}
          <Chip
            size="small"
            variant="outlined"
            icon={<PsychologyRoundedIcon />}
            label={`Iceberg分析: ${icebergTotal}件`}
          />

          {/* 実施記録数 */}
          <Chip
            size="small"
            variant="outlined"
            icon={<EditNoteRoundedIcon />}
            label={`実施記録: ${recordTotal}件`}
            color={recordTotal === 0 ? 'warning' : 'default'}
          />

          {/* 次回見直し */}
          {nextReview && (
            <Chip
              size="small"
              variant="outlined"
              icon={<EventNoteRoundedIcon />}
              label={`次回見直し: ${nextReview}${daysUntilReview != null ? ` (${daysUntilReview}日後)` : ''}`}
              color={daysUntilReview != null && daysUntilReview <= 30 ? 'warning' : 'default'}
            />
          )}
        </Stack>

        {/* ── チップ行: ステータス指標 ── */}
        <Divider sx={{ opacity: 0.5 }} />
        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          alignItems="center"
        >
          {/* 直近モニタリング */}
          {bundle.latestMonitoring ? (
            <Chip
              size="small"
              variant="outlined"
              label={`直近モニタリング: ${bundle.latestMonitoring.date}`}
              color={bundle.latestMonitoring.planChangeRequired ? 'warning' : 'success'}
            />
          ) : (
            <Chip
              size="small"
              variant="filled"
              label="モニタリング未実施"
              color="warning"
            />
          )}

          {/* 直近実施日 */}
          {bundle.lastProcedureRecordDate && (
            <Chip
              size="small"
              variant="outlined"
              label={`最終実施: ${bundle.lastProcedureRecordDate}`}
              color="default"
            />
          )}

          {/* 再分析推奨 */}
          {needsReanalysis && (
            <Chip
              size="small"
              variant="filled"
              icon={<WarningAmberRoundedIcon />}
              label="再分析推奨"
              color="warning"
            />
          )}
        </Stack>

        {/* ── シートごとの内訳（3件以上ある場合） ── */}
        {bundle.icebergCountBySheet && Object.keys(bundle.icebergCountBySheet).length > 0 && (
          <>
            <Divider sx={{ opacity: 0.5 }} />
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.5, display: 'block' }}>
                シート別内訳
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {Object.entries(bundle.icebergCountBySheet).map(([sheetId, count]) => {
                  const recordCount = bundle.procedureRecordCountBySheet?.[sheetId] ?? 0;
                  return (
                    <Chip
                      key={sheetId}
                      size="small"
                      variant="outlined"
                      label={`${sheetId.slice(0, 8)}… — 分析${count} / 記録${recordCount}`}
                      sx={{ fontSize: '0.7rem' }}
                    />
                  );
                })}
              </Stack>
            </Box>
          </>
        )}
      </Stack>
    </Paper>
  );
};

/** テスト用 export */
export { shouldRecommendReanalysis, totalRecordCount };
