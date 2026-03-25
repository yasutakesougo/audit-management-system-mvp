import React from 'react';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

export const LUNCH_LABELS: Record<string, string> = {
  full: '完食',
  '80': '8割',
  half: '半分',
  small: '少量',
  none: 'なし',
};

export const LUNCH_COLORS: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  full: 'success',
  '80': 'success',
  half: 'warning',
  small: 'error',
  none: 'error',
};

export const TREND_ICON: Record<string, React.ReactNode> = {
  up: <TrendingUpIcon fontSize="small" color="error" />,
  down: <TrendingDownIcon fontSize="small" color="success" />,
  flat: <TrendingFlatIcon fontSize="small" color="action" />,
};

export const TREND_LABEL: Record<string, string> = {
  up: '増加傾向',
  down: '減少傾向',
  flat: '横ばい',
};

export const TAG_CATEGORY_COLORS: Record<string, 'primary' | 'secondary' | 'success' | 'info'> = {
  behavior: 'secondary',
  communication: 'info',
  dailyLiving: 'primary',
  positive: 'success',
};
