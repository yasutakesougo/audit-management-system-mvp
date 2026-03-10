import { motionTokens } from '@/app/theme';
import { Box, Button, Typography } from '@mui/material';
import React from 'react';
import { EmptyStateHero } from './EmptyStateHero';

export type HeroUnfinishedBannerProps = {
  unfilledCount: number;
  approvalPendingCount?: number;
  onClickPrimary: () => void;
  /** 「記録メニュー」への導線。undefined なら非表示（後方互換）。 */
  onClickSecondary?: () => void;
  sticky?: boolean;
};

export const HeroUnfinishedBanner: React.FC<HeroUnfinishedBannerProps> = ({
  unfilledCount,
  approvalPendingCount = 0,
  onClickPrimary,
  onClickSecondary,
  // sticky is accepted for backward compatibility but no longer used (inline layout)
}) => {
  const isComplete = unfilledCount === 0 && approvalPendingCount === 0;

  if (isComplete) {
    return (
      <Box
        data-testid="today-hero-banner"
        data-complete="true"
        sx={{
          bgcolor: 'success.dark',
          color: 'common.white',
          boxShadow: 1,
          py: 0.5,
          transition: motionTokens.transition.cardInteractive,
        }}
      >
        <EmptyStateHero onClickMenu={onClickSecondary} />
      </Box>
    );
  }

  return (
    <Box
      data-testid="today-hero-banner"
      sx={{
        px: 2,
        py: 0.75,
        bgcolor: 'error.main',
        color: 'common.white',
        display: 'flex',
        gap: 1.5,
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: 1,
        borderRadius: 1,
      }}
    >
      <Typography variant="body2" fontWeight="bold" sx={{ fontSize: '0.82rem' }}>
        🔴 未記録 {unfilledCount}件
        {approvalPendingCount > 0 && ` / 🟡 承認待ち ${approvalPendingCount}件`}
      </Typography>

      <Box sx={{ display: 'flex', gap: 0.75, flexShrink: 0 }}>
        <Button
          data-testid="today-hero-cta"
          variant="contained"
          color="inherit"
          onClick={onClickPrimary}
          sx={{
            color: 'error.main',
            fontWeight: 'bold',
            minHeight: 32,
            px: 1.5,
            fontSize: '0.75rem',
          }}
        >
          今すぐ入力
        </Button>

        {onClickSecondary && (
          <Button
            data-testid="today-hero-menu"
            variant="outlined"
            color="inherit"
            onClick={onClickSecondary}
            sx={{
              fontWeight: 'bold',
              minHeight: 32,
              px: 1.5,
              fontSize: '0.75rem',
              borderColor: 'rgba(255,255,255,0.5)',
            }}
          >
            記録メニュー
          </Button>
        )}
      </Box>
    </Box>
  );
};
