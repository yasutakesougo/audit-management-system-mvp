/**
 * BentoGrid — Reusable Bento Layout primitives for /today
 *
 * Provides:
 * - BentoContainer: CSS Grid wrapper with responsive breakpoints
 * - BentoCard: Glassmorphism card with optional span overrides
 *
 * Design tokens:
 * - Gap: 16px (compact on mobile) → 20px (tablet+)
 * - Border radius: 16px
 * - Glassmorphism: semi-transparent background + subtle border + shadow
 *
 * @see docs/ui-principles.md — 情報は階層化する (Principle #6)
 */
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import React from 'react';

// ────────────────────────────────────────────────────
// BentoContainer
// ────────────────────────────────────────────────────

type BentoContainerProps = {
  children: React.ReactNode;
  /** Override default columns (default: 4-column on desktop) */
  columns?: number;
  sx?: SxProps<Theme>;
};

/**
 * CSS Grid container with 4-column layout that adapts:
 * - Mobile:  1 column
 * - Tablet:  2 columns
 * - Desktop: 4 columns
 */
export const BentoContainer: React.FC<BentoContainerProps> = ({
  children,
  columns = 4,
  sx,
}) => (
  <Box
    sx={{
      display: 'grid',
      gap: { xs: '12px', sm: '16px', md: '20px' },
      gridTemplateColumns: {
        xs: '1fr',
        sm: 'repeat(2, 1fr)',
        md: `repeat(${columns}, 1fr)`,
      },
      px: { xs: 2, sm: 3, md: 4 },
      py: { xs: 2, sm: 3 },
      maxWidth: 1200,
      mx: 'auto',
      ...sx,
    }}
  >
    {children}
  </Box>
);

// ────────────────────────────────────────────────────
// BentoCard
// ────────────────────────────────────────────────────

type BentoCardProps = {
  children: React.ReactNode;
  /** Number of columns to span (default: 1) */
  colSpan?: number | { xs?: number; sm?: number; md?: number };
  /** Number of rows to span (default: 1) */
  rowSpan?: number;
  /** Variant affects visual styling */
  variant?: 'default' | 'hero' | 'accent' | 'subtle';
  /** Disable hover effect */
  noHover?: boolean;
  /** Optional data-testid */
  testId?: string;
  sx?: SxProps<Theme>;
  onClick?: () => void;
};

const variantStyles: Record<string, SxProps<Theme>> = {
  default: {
    bgcolor: 'rgba(255, 255, 255, 0.92)',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    backdropFilter: 'blur(12px)',
  },
  hero: {
    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #a855f7 100%)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    color: '#fff',
  },
  accent: {
    bgcolor: 'rgba(79, 70, 229, 0.04)',
    border: '1px solid rgba(79, 70, 229, 0.12)',
    backdropFilter: 'blur(12px)',
  },
  subtle: {
    bgcolor: 'rgba(250, 250, 250, 0.95)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
  },
};

/**
 * A single Bento cell with glassmorphism, responsive spans,
 * and optional hover animation.
 */
export const BentoCard: React.FC<BentoCardProps> = ({
  children,
  colSpan = 1,
  rowSpan = 1,
  variant = 'default',
  noHover = false,
  testId,
  sx,
  onClick,
}) => {
  // Resolve responsive colSpan to a plain string for gridColumn
  const gridColumn: Record<string, string> | string =
    typeof colSpan === 'object'
      ? {
          xs: `span ${colSpan.xs ?? 1}`,
          sm: `span ${colSpan.sm ?? colSpan.xs ?? 1}`,
          md: `span ${colSpan.md ?? colSpan.sm ?? colSpan.xs ?? 1}`,
        }
      : `span ${colSpan}`;

  const hoverSx: SxProps<Theme> = noHover
    ? {}
    : {
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
        },
      };

  return (
    <Box
      data-testid={testId}
      onClick={onClick}
      sx={[
        {
          gridColumn,
          gridRow: rowSpan > 1 ? `span ${rowSpan}` : undefined,
          borderRadius: '16px',
          p: { xs: 2, sm: 2.5 },
          overflow: 'hidden' as const,
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          cursor: onClick ? 'pointer' : 'default',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
        },
        variantStyles[variant] as Record<string, unknown>,
        hoverSx as Record<string, unknown>,
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {children}
    </Box>
  );
};
