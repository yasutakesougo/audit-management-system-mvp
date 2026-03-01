/**
 * EmptyStateBlock — /today 統一 Empty State コンポーネント
 *
 * H-1 ガードレール準拠:
 * - 構造: icon + heading + description + optional CTA の4要素（統一）
 * - 種類: success / zero-users / nextAction-null は同一パターンで表現
 * - CTA方針: 必ず1つは "次の行動" を置く（弱いCTAでもOK）
 * - testid: 接頭辞 today-empty-* を統一
 * - 禁止: フォーム入力/複雑操作は入れない
 */
import { Box, Button, Typography } from '@mui/material';
import React from 'react';

export type EmptyStateAction = {
  label: string;
  onClick: () => void;
  testId?: string;
};

export type EmptyStateBlockProps = {
  /** MUI icon element */
  icon: React.ReactNode;
  /** 見出し */
  title: string;
  /** 補足説明 */
  description?: string;
  /** CTA（弱い導線でもOK） */
  primaryAction?: EmptyStateAction;
  /** data-testid（today-empty-* 接頭辞ルール） */
  testId?: string;
  /** compact=inline表示 / hero=大きめ表示 */
  variant?: 'compact' | 'hero';
};

export const EmptyStateBlock: React.FC<EmptyStateBlockProps> = ({
  icon,
  title,
  description,
  primaryAction,
  testId,
  variant = 'compact',
}) => {
  const isHero = variant === 'hero';

  return (
    <Box
      data-testid={testId}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        py: isHero ? 4 : 3,
        px: 2,
        gap: 1,
      }}
    >
      {/* Icon */}
      <Box
        sx={{
          color: isHero ? 'success.main' : 'text.secondary',
          fontSize: isHero ? 48 : 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          '& .MuiSvgIcon-root': {
            fontSize: 'inherit',
          },
        }}
      >
        {icon}
      </Box>

      {/* Heading */}
      <Typography
        variant={isHero ? 'h6' : 'subtitle1'}
        fontWeight="bold"
        color={isHero ? 'success.main' : 'text.primary'}
      >
        {title}
      </Typography>

      {/* Description */}
      {description ? (
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      ) : null}

      {/* CTA */}
      {primaryAction ? (
        <Button
          data-testid={primaryAction.testId}
          variant="outlined"
          size="small"
          onClick={primaryAction.onClick}
          sx={{ mt: 1, minHeight: 44 }}
        >
          {primaryAction.label}
        </Button>
      ) : null}
    </Box>
  );
};
