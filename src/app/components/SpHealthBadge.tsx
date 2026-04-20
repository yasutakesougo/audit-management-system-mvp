/**
 * SpHealthBadge — SharePoint 制約状態バッジ
 *
 * SpHealthSignalStore を購読し、最も優先度の高いシグナルを
 * ヘッダーバッジとして表示する。クリックで SpHealthPopover を開く。
 *
 * - シグナルなし → 非表示
 * - warning      → 黄色 "SP Watch"
 * - action_required → オレンジ "SP Action"
 * - critical     → 赤 "SP Critical"
 *
 * ConnectionStatus は変更しない。本コンポーネントはヘッダーに追加する独立 UI。
 */

import Box from '@mui/material/Box';
import { getContrastRatio, useTheme } from '@mui/material/styles';
import React, { useEffect, useState } from 'react';
import {
  getSpHealthSignal,
  subscribeSpHealthSignal,
  type SpHealthSeverity,
  type SpHealthSignal,
} from '@/features/sp/health/spHealthSignalStore';
import { SpHealthPopover } from './SpHealthPopover';

// ─── Label / Color helpers ────────────────────────────────────────────────────

const SEVERITY_LABEL: Record<SpHealthSeverity, string> = {
  watch: 'SP Observe',
  warning: 'SP Watch',
  action_required: 'SP Action',
  critical: 'SP Critical',
};

// ─── Component ────────────────────────────────────────────────────────────────

export const SpHealthBadge: React.FC = () => {
  const [signal, setSignal] = useState<SpHealthSignal | null>(getSpHealthSignal);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const theme = useTheme();

  useEffect(() => {
    setSignal(getSpHealthSignal());
    const unsubscribe = subscribeSpHealthSignal(setSignal);
    return unsubscribe;
  }, []);

  if (!signal || signal.severity === 'watch') return null;

  const severityColor: Record<SpHealthSeverity, string> = {
    watch: theme.palette.info.main,
    warning: theme.palette.warning.main,
    action_required: theme.palette.warning.dark,
    critical: theme.palette.error.main,
  };

  const background = severityColor[signal.severity];
  const lightContrast = getContrastRatio(background, theme.palette.common.white);
  const darkContrast = getContrastRatio(background, theme.palette.common.black);
  const textColor = darkContrast >= lightContrast ? theme.palette.common.black : theme.palette.common.white;

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const countSuffix = signal.occurrenceCount >= 2 ? ` ×${signal.occurrenceCount}` : '';

  return (
    <>
      <Box
        role="button"
        tabIndex={0}
        aria-haspopup="true"
        aria-expanded={Boolean(anchorEl)}
        aria-label={`SharePoint health: ${SEVERITY_LABEL[signal.severity]}. クリックして詳細を表示`}
        data-testid="sp-health-badge"
        data-severity={signal.severity}
        data-reason={signal.reasonCode}
        onClick={handleOpen}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpen(e as never); }}
        sx={{
          background,
          color: textColor,
          px: 1,
          py: 0.25,
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 500,
          minWidth: 90,
          textAlign: 'center',
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover': { opacity: 0.85 },
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 2,
          },
        }}
      >
        {SEVERITY_LABEL[signal.severity]}{countSuffix}
      </Box>

      <SpHealthPopover
        anchorEl={anchorEl}
        signal={signal}
        onClose={handleClose}
      />
    </>
  );
};

export default SpHealthBadge;
