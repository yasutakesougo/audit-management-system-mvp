import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import React from 'react';

// ---------------------------------------------------------------------------
// IBDPageHeader — 強度行動障害支援グループ共通ヘッダー
//
// 全 IBD ページで統一的なヘッダーを提供する。
// title / subtitle / icon / actions を受け取り、一貫したレイアウトを描画。
// ---------------------------------------------------------------------------

export type IBDPageHeaderProps = {
  /** ページタイトル（例: 行動分析ダッシュボード） */
  title: string;
  /** サブタイトル（1行の説明文） */
  subtitle?: string;
  /** 左端のアイコン（MUI Icon を推奨） */
  icon?: React.ReactNode;
  /** 右側に配置するアクション要素（ボタン群・セレクト等） */
  actions?: React.ReactNode;
  /** data-testid */
  testId?: string;
};

export const IBDPageHeader: React.FC<IBDPageHeaderProps> = ({
  title,
  subtitle,
  icon,
  actions,
  testId,
}) => (
  <Paper
    elevation={0}
    data-testid={testId}
    sx={{
      p: 2,
      mb: 3,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 2,
    }}
  >
    <Box display="flex" alignItems="center" gap={2}>
      {icon && (
        <Box
          sx={{
            color: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            '& .MuiSvgIcon-root': { fontSize: 32 },
          }}
        >
          {icon}
        </Box>
      )}
      <Box>
        <Typography variant="h5" fontWeight={700} component="h1">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
    </Box>

    {actions && (
      <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
        {actions}
      </Box>
    )}
  </Paper>
);

export default IBDPageHeader;
