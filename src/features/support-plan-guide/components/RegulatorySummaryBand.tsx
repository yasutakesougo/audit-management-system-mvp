/**
 * RegulatorySummaryBand — SupportPlanGuidePage 上部の制度サマリー帯
 *
 * SupportPlanBundle のデータを使って、
 * ISP ステータス・Iceberg 分析件数・直近モニタリング・再分析推奨を表示する。
 *
 * この帯が表示されることで、支援者はシートを開く前に
 * 「制度的にどういう状況か」をひと目で把握できる。
 */
import React, { useMemo } from 'react';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import type { SupportPlanBundle } from '@/domain/isp/schema';

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

export const RegulatorySummaryBand: React.FC<RegulatorySummaryBandProps> = ({ bundle }) => {
  const icebergTotal = useMemo(() => {
    if (!bundle.icebergCountBySheet) return 0;
    return Object.values(bundle.icebergCountBySheet).reduce((a, b) => a + b, 0);
  }, [bundle.icebergCountBySheet]);

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
      <Stack spacing={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AssessmentRoundedIcon fontSize="small" color="primary" />
          <Typography variant="subtitle2" fontWeight={600}>
            制度サマリー
          </Typography>
        </Stack>

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
            label={`ISP: ${bundle.isp.status}`}
            color="primary"
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

          {/* Iceberg 分析件数 */}
          <Chip
            size="small"
            variant="outlined"
            icon={<PsychologyRoundedIcon />}
            label={`Iceberg分析: ${icebergTotal}件`}
          />

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
      </Stack>
    </Paper>
  );
};

/** テスト用 export */
export { shouldRecommendReanalysis };
