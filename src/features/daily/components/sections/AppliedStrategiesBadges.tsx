/**
 * AppliedStrategiesBadges — 保存済み記録の「実施した戦略」表示（Phase C-2）
 *
 * 過去記録の閲覧時に、そのとき実施した戦略を小さなチップ群で表示。
 * referencedStrategies が空または undefined なら何も描画しない。
 *
 * 表示箇所:
 *   - RecentRecordsDialog（直近の行動記録ダイアログ）
 *   - TbsRecentRecordsDialog（TBS版）
 *   - 将来: スロット別履歴カードなど
 */
import type { ReferencedStrategy } from '@/domain/behavior';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import React, { memo } from 'react';

export interface AppliedStrategiesBadgesProps {
  strategies?: ReferencedStrategy[];
}

/** カテゴリ別の色設定 */
const CATEGORY_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  antecedent:  { bg: '#1976d2', color: '#ffffff', label: '先行' },
  teaching:    { bg: '#2e7d32', color: '#ffffff', label: '教授' },
  consequence: { bg: '#ed6c02', color: '#ffffff', label: '後続' },
};

export const AppliedStrategiesBadges: React.FC<AppliedStrategiesBadgesProps> = memo(({ strategies }) => {
  // applied のみフィルタ（通常は全て applied:true だが念のため）
  const applied = strategies?.filter((s) => s.applied);
  if (!applied || applied.length === 0) return null;

  return (
    <Stack
      direction="row"
      spacing={0.5}
      sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}
      useFlexGap
      data-testid="applied-strategies-badges"
    >
      {applied.map((s) => {
        const style = CATEGORY_STYLE[s.strategyKey] ?? CATEGORY_STYLE.antecedent;
        return (
          <Chip
            key={`${s.strategyKey}:${s.strategyText}`}
            icon={<CheckCircleIcon sx={{ fontSize: 12, color: `${style.color} !important` }} />}
            label={`${style.label}: ${s.strategyText}`}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.65rem',
              bgcolor: style.bg,
              color: style.color,
              '& .MuiChip-icon': { ml: 0.5 },
              '& .MuiChip-label': { px: 0.5 },
            }}
          />
        );
      })}
    </Stack>
  );
});

AppliedStrategiesBadges.displayName = 'AppliedStrategiesBadges';
