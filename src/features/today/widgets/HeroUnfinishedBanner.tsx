import { Box, Button, Typography } from '@mui/material';
import React from 'react';

export type HeroUnfinishedBannerProps = {
  unfilledCount: number;
  approvalPendingCount?: number;
  onClickPrimary: () => void;
  sticky?: boolean;
};

export const HeroUnfinishedBanner: React.FC<HeroUnfinishedBannerProps> = ({
  unfilledCount,
  approvalPendingCount = 0,
  onClickPrimary,
  sticky = true,
}) => {
  const isComplete = unfilledCount === 0 && approvalPendingCount === 0;

  return (
    <Box
      data-testid="today-hero-banner"
      sx={[
        {
          px: 2,
          py: 1.5,
          bgcolor: isComplete ? 'success.main' : 'error.main',
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
          zIndex: 1100, // AppShellV2 の header よりも前面、Dialog等よりは背面
        }
      ]}
    >
      {isComplete ? (
        <Typography variant="subtitle1" fontWeight="bold">
          ✅ 本日完了
        </Typography>
      ) : (
        <Typography variant="subtitle1" fontWeight="bold">
          🔴 未記録 {unfilledCount}件
          {approvalPendingCount > 0 && ` / 🟡 承認待ち ${approvalPendingCount}件`}
        </Typography>
      )}

      {!isComplete && (
        <Button
          data-testid="today-hero-cta"
          variant="contained"
          color="inherit"
          onClick={onClickPrimary}
          sx={{
            color: 'error.main',
            fontWeight: 'bold',
            minHeight: 44, // タッチデバイス向けの最小タップ領域
            px: 2,
          }}
        >
          今すぐ入力
        </Button>
      )}
    </Box>
  );
};
