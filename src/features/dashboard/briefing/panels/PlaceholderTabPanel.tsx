/**
 * 未実装タブ共通プレースホルダー
 *
 * 運営管理情報・統合利用者プロファイルなど、
 * まだ実装されていないタブの統一的な表示。
 */

import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import React from 'react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type PlaceholderTabPanelProps = {
  title: string;
  description: string;
};

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

export const PlaceholderTabPanel: React.FC<PlaceholderTabPanelProps> = ({
  title,
  description,
}) => (
  <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
    <Typography variant="h4" sx={{ fontWeight: 800 }}>
      {title}
    </Typography>
    <Typography variant="body2" color="text.secondary">
      {description}
    </Typography>
  </Paper>
);
