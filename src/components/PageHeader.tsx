import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import React from 'react';

// ---------------------------------------------------------------------------
// PageHeader — アプリ全体で使う統一ページヘッダー
//
// 全ページで一貫した見出し + レイアウトを提供する。
// ・variant="h5" / fontWeight 700 / component="h1" で固定
// ・data-page-heading="true" により useRouteFocusManager と連携
// ・subtitle / icon / actions スロットを持つ
//
// @see src/a11y/useRouteFocusManager.ts
// ---------------------------------------------------------------------------

export type PageHeaderProps = {
  /** ページタイトル */
  title: string;
  /** サブタイトル（1行の説明文） */
  subtitle?: string;
  /** 左端のアイコン（MUI Icon を推奨） */
  icon?: React.ReactNode;
  /** 右側に配置するアクション要素（ボタン群・セレクト等） */
  actions?: React.ReactNode;
  /** data-testid */
  testId?: string;
  /** アクセシビリティ: 見出しの id（useRouteFocusManager で使用） */
  headingId?: string;
};

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  icon,
  actions,
  testId,
  headingId,
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
        <Typography
          variant="h5"
          fontWeight={700}
          component="h1"
          data-page-heading="true"
          id={headingId}
        >
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

export default PageHeader;
