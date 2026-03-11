/**
 * 申し送りタイムラインタブ
 *
 * /handoff-timeline への導線を提供するリンクパネル。
 */

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import React from 'react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type TimelineTabPanelProps = {
  onOpen: () => void;
};

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

export const TimelineTabPanel: React.FC<TimelineTabPanelProps> = ({ onOpen }) => (
  <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
    <Typography variant="h4" sx={{ fontWeight: 800 }}>
      申し送りタイムライン
    </Typography>
    <Typography variant="body2" color="text.secondary">
      今日の申し送り状況のサマリーを確認し、詳細はタイムライン画面で操作できます。
    </Typography>
    <Box sx={{ mt: 2 }}>
      <Button variant="outlined" size="small" onClick={onOpen}>
        タイムラインを開く
      </Button>
    </Box>
  </Paper>
);
