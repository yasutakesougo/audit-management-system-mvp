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
  sticky = true,
}) => {
  const isComplete = unfilledCount === 0 && approvalPendingCount === 0;

  if (isComplete) {
    return (
      <Box
        data-testid="today-hero-banner"
        data-complete="true"
        sx={[
          {
            bgcolor: 'success.dark',
            color: 'common.white',
            boxShadow: 1,
            py: 0.75,
            transition: motionTokens.transition.cardInteractive,
          },
          sticky && {
            position: 'sticky',
            top: 0,
            zIndex: 1100,
          },
        ]}
      >
        <EmptyStateHero onClickMenu={onClickSecondary} />
      </Box>
    );
  }

  return (
    <Box
      data-testid="today-hero-banner"
      sx={[
        {
          px: 2,
          py: 1.5,
          bgcolor: 'error.main',
          color: 'common.white',
          display: 'flex',
          gap: 2,
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: 2,
        },
        sticky && {
          position: 'sticky',
          top: 0,
          zIndex: 1100,
        },
      ]}
    >
      <Typography variant="subtitle1" fontWeight="bold">
        🔴 未記録 {unfilledCount}件
        {approvalPendingCount > 0 && ` / 🟡 承認待ち ${approvalPendingCount}件`}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          data-testid="today-hero-cta"
          variant="contained"
          color="inherit"
          onClick={onClickPrimary}
          sx={{
            color: 'error.main',
            fontWeight: 'bold',
            minHeight: 44,
            px: 2,
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
              minHeight: 44,
              px: 2,
              borderColor: 'rgba(255,255,255,0.5)',
            }}
          >
            📋 記録メニュー
          </Button>
        )}
      </Box>
    </Box>
  );
};
