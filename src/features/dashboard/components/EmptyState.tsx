/**
 * EmptyState — Reusable empty-content placeholder
 *
 * Bento-Grid friendly: renders a Paper with subtle gradient,
 * centered icon + message + optional CTA button.
 */

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'contained' | 'outlined' | 'text';
}

export interface EmptyStateProps {
  /** MUI icon element (e.g. <InboxIcon />) */
  icon: React.ReactNode;
  /** 見出し */
  title: string;
  /** 説明文 */
  description?: string;
  /** CTAボタン */
  action?: EmptyStateAction;
  /** 追加CTAボタン（セカンダリ） */
  secondaryAction?: EmptyStateAction;
  /** 高さのミニマム (default: 240) */
  minHeight?: number;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  minHeight = 240,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Paper
      variant="outlined"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight,
        px: 4,
        py: 5,
        borderStyle: 'dashed',
        borderColor: alpha(theme.palette.divider, 0.4),
        borderRadius: 2,
        background: isDark
          ? `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.04)} 0%, ${alpha(theme.palette.background.paper, 0.6)} 100%)`
          : `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.05)} 0%, ${alpha(theme.palette.background.paper, 0.8)} 100%)`,
        transition: 'border-color 0.2s ease',
        '&:hover': {
          borderColor: alpha(theme.palette.primary.main, 0.3),
        },
      }}
    >
      <Stack spacing={2} alignItems="center" sx={{ maxWidth: 360, textAlign: 'center' }}>
        {/* Icon */}
        <Box
          sx={{
            color: alpha(theme.palette.text.secondary, 0.45),
            '& > svg': { fontSize: 56 },
          }}
        >
          {icon}
        </Box>

        {/* Title */}
        <Typography
          variant="subtitle1"
          fontWeight={700}
          sx={{ color: 'text.primary', lineHeight: 1.4 }}
        >
          {title}
        </Typography>

        {/* Description */}
        {description && (
          <Typography
            variant="body2"
            sx={{ color: 'text.secondary', lineHeight: 1.6 }}
          >
            {description}
          </Typography>
        )}

        {/* CTA buttons */}
        {(action || secondaryAction) && (
          <Stack direction="row" spacing={1.5} sx={{ pt: 1 }}>
            {action && (
              <Button
                variant={action.variant ?? 'contained'}
                size="small"
                onClick={action.onClick}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                {action.label}
              </Button>
            )}
            {secondaryAction && (
              <Button
                variant={secondaryAction.variant ?? 'outlined'}
                size="small"
                onClick={secondaryAction.onClick}
                sx={{ textTransform: 'none' }}
              >
                {secondaryAction.label}
              </Button>
            )}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
};
