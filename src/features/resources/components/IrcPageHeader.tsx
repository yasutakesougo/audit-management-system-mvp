/**
 * IRC — Page header with title and sprint info banner.
 */
import { Alert, Box, Typography } from '@mui/material';
import React from 'react';

import { isDev, isE2E } from '@/env';

export interface IrcPageHeaderProps {
  /** Debug banner を表示するか */
  showDebugBanner?: boolean;
}

export const IrcPageHeader: React.FC<IrcPageHeaderProps> = ({
  showDebugBanner = isDev,
}) => (
  <>
    {showDebugBanner && (
      <Typography
        variant="overline"
        data-testid="irc-debug-banner"
        sx={{
          display: 'block',
          mb: 1,
          color: 'primary.main',
          fontWeight: 'bold',
          backgroundColor: 'primary.50',
          padding: 1,
          borderRadius: 1,
        }}
      >
        IRC PAGE MOUNTED (debug) - E2E: {isE2E ? 'YES' : 'NO'}
      </Typography>
    )}

    <Box sx={{ mb: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        統合リソースカレンダー
      </Typography>
      <Typography variant="subtitle1" component="span" color="text.secondary">
        Plan vs Actual 管理ビュー
      </Typography>
    </Box>

    <Alert severity="info" sx={{ mb: 2 }}>
      💡 Sprint 3 実装中: PvsA統合表示・リアルタイム更新機能
    </Alert>
  </>
);

export default IrcPageHeader;
