// ---------------------------------------------------------------------------
// SupportSummaryStrip — IBD 戦術ダッシュボード（Bento ストリップ）
// 進捗 / ABC分析 / 観察カウンター / 良い状態の条件 を水平カード表示
// ---------------------------------------------------------------------------
import AssessmentIcon from '@mui/icons-material/Assessment';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { memo } from 'react';

export type SupportSummaryStripProps = {
  /** スケジュール全体のステップ数 */
  totalSteps: number;
  /** 記録済みステップ数 */
  filledSteps: number;
  /** ABC分析の本日記録件数 */
  abcCount?: number;
  /** 観察カウンター（未観察の支援回数） */
  supervisionSupportCount?: number;
  /** 良い状態の条件リスト (SPS positiveConditions) */
  positiveConditions?: string[];
  /** ABC Quick ボタンのクリック時 */
  onAbcQuickClick?: () => void;
};

/**
 * 水平 Bento ストリップ — Bento Grid のサマリーゾーンに配置
 *
 * 4つのミニカードを横並びに表示:
 * 1. Progress — 記録進捗バー
 * 2. ABC Quick — 行動記録の件数 + クイックアクション
 * 3. Supervision — 観察カウンター状態
 * 4. SPS Conditions — 良い状態の条件チップ表示
 */
function SupportSummaryStrip({
  totalSteps,
  filledSteps,
  abcCount = 0,
  supervisionSupportCount = 0,
  positiveConditions = [],
  onAbcQuickClick,
}: SupportSummaryStripProps) {
  const progress = totalSteps > 0 ? Math.round((filledSteps / totalSteps) * 100) : 0;

  // 観察カウンター状態
  const supervisionLevel: 'ok' | 'warning' | 'overdue' =
    supervisionSupportCount >= 2 ? 'overdue' : supervisionSupportCount >= 1 ? 'warning' : 'ok';
  const supervisionColor =
    supervisionLevel === 'overdue' ? 'error' : supervisionLevel === 'warning' ? 'warning' : 'success';

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 1,
        gridTemplateColumns: {
          xs: 'repeat(2, 1fr)',
          sm: 'repeat(4, 1fr)',
        },
      }}
      data-testid="support-summary-strip"
    >
      {/* 1. Progress Card */}
      <Card
        variant="outlined"
        sx={{
          p: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.25,
          borderLeft: '3px solid',
          borderLeftColor: progress >= 100 ? 'success.main' : 'primary.main',
        }}
      >
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.7rem', lineHeight: 1.2 }}>
          記録進捗
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
          <Typography variant="h6" fontWeight={800} color={progress >= 100 ? 'success.main' : 'primary.main'} sx={{ fontSize: '1.1rem' }}>
            {progress}%
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
            ({filledSteps}/{totalSteps})
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progress}
          color={progress >= 100 ? 'success' : 'primary'}
          sx={{ height: 4, borderRadius: 2 }}
        />
      </Card>

      {/* 2. ABC Quick Card */}
      <Card
        variant="outlined"
        sx={{
          p: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.25,
          borderLeft: '3px solid',
          borderLeftColor: abcCount > 0 ? 'warning.main' : 'grey.300',
          cursor: onAbcQuickClick ? 'pointer' : 'default',
          transition: 'box-shadow 0.2s',
          '&:hover': onAbcQuickClick ? { boxShadow: 2 } : {},
        }}
        onClick={onAbcQuickClick}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <AssessmentIcon sx={{ fontSize: 14, color: 'warning.main' }} />
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.7rem', lineHeight: 1.2 }}>
            ABC分析
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
          <Typography variant="h6" fontWeight={800} color={abcCount > 0 ? 'warning.main' : 'text.secondary'} sx={{ fontSize: '1.1rem' }}>
            {abcCount}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>件</Typography>
        </Box>
      </Card>

      {/* 3. Supervision Counter Card */}
      <Card
        variant="outlined"
        sx={{
          p: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.25,
          borderLeft: '3px solid',
          borderLeftColor: `${supervisionColor}.main`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <VisibilityIcon sx={{ fontSize: 14, color: `${supervisionColor}.main` }} />
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.7rem', lineHeight: 1.2 }}>
            観察
          </Typography>
        </Box>
        <Tooltip
          title={
            supervisionLevel === 'overdue'
              ? `${supervisionSupportCount}回の支援が未観察（基準: 2回に1回）`
              : supervisionLevel === 'warning'
                ? '次回支援前に観察を推奨'
                : '観察義務を満たしています'
          }
        >
          <Chip
            label={
              supervisionLevel === 'overdue'
                ? `⚠ ${supervisionSupportCount}回未観察`
                : supervisionLevel === 'warning'
                  ? `△ ${supervisionSupportCount}回未観察`
                  : '✓ OK'
            }
            color={supervisionColor}
            size="small"
            variant={supervisionLevel === 'ok' ? 'outlined' : 'filled'}
            sx={{ height: 22, fontSize: '0.7rem' }}
          />
        </Tooltip>
      </Card>

      {/* 4. SPS Positive Conditions Card */}
      <Card
        variant="outlined"
        sx={{
          p: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.25,
          borderLeft: '3px solid',
          borderLeftColor: positiveConditions.length > 0 ? 'success.main' : 'grey.300',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <CheckCircleOutlineIcon sx={{ fontSize: 14, color: 'success.main' }} />
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.7rem', lineHeight: 1.2 }}>
            良い状態
          </Typography>
        </Box>
        {positiveConditions.length > 0 ? (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {positiveConditions.slice(0, 3).map((c) => (
              <Chip key={c} label={c} size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
            ))}
            {positiveConditions.length > 3 && (
              <Chip label={`+${positiveConditions.length - 3}`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
            )}
          </Stack>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            SPS未登録
          </Typography>
        )}
      </Card>
    </Box>
  );
}

export default memo(SupportSummaryStrip);
