import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';

// ---------------------------------------------------------------------------
// PageHeader — アプリ全体で使う統一ページヘッダー
//
// コンテンツ領域を最大化するため、控えめなデザインを採用。
// ・variant="h6" / fontWeight 600 / fontSize 1.1rem で主張を抑制
// ・背景なし、下ボーダーで区切り
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
  <Box
    data-testid={testId}
    sx={{
      py: 1,
      px: 0,
      mb: 1.5,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 1,
      borderBottom: 1,
      borderColor: 'divider',
    }}
  >
    <Box display="flex" alignItems="center" gap={1}>
      {icon && (
        <Box
          sx={{
            color: 'text.secondary',
            display: 'flex',
            alignItems: 'center',
            '& .MuiSvgIcon-root': { fontSize: 22 },
          }}
        >
          {icon}
        </Box>
      )}
      <Box>
        <Typography
          variant="h6"
          fontWeight={600}
          component="h1"
          data-page-heading="true"
          id={headingId}
          sx={{ fontSize: '1.1rem', lineHeight: 1.4 }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
    </Box>

    {actions && (
      <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
        {actions}
      </Box>
    )}
  </Box>
);

export default PageHeader;
