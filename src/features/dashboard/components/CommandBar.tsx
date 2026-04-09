/**
 * CommandBar — 🍱 Bento Grid トップ KPI チップ列
 *
 * 画面最上部に横一列で並ぶ、ミッション・コントロール風の
 * グランス可能なステータスインジケーター。
 *
 * v2: Animated KPI counters
 * - 数値変化時に flash アニメーション（scale + color pop）
 * - 「30秒で状況を把握する」+ 変化に即気づける
 * - All Clear 出現時のファンファーレ的アニメーション
 */

import { motionTokens } from '@/app/theme';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import EditNoteIcon from '@mui/icons-material/EditNote';
import GroupsIcon from '@mui/icons-material/Groups';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useEffect, useRef, useState } from 'react';

// ── Animated Counter Hook ──
function useAnimatedValue(value: number): { displayValue: number; isAnimating: boolean } {
  const prevRef = useRef(value);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value;
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 800);
      return () => clearTimeout(timer);
    }
  }, [value]);

  return { displayValue: value, isAnimating };
}

// ── Props ──
export interface CommandBarProps {
  /** 未対応の申し送り件数 */
  pendingHandoffs: number;
  /** 重要（未対応）件数 */
  criticalAlerts: number;
  /** 出勤者数 / 総職員数 */
  attendanceRatio?: { present: number; total: number };
  /** 日々の記録完了数 / 総対象数 */
  dailyRecordRatio?: { done: number; total: number };
  /** セクションクリック時のコールバック */
  onChipClick?: (section: string) => void;
}

export const CommandBar: React.FC<CommandBarProps> = ({
  pendingHandoffs,
  criticalAlerts,
  attendanceRatio,
  dailyRecordRatio,
  onChipClick,
}) => {
  const theme = useTheme();

  // ── Animated values ──
  const pending = useAnimatedValue(pendingHandoffs);
  const critical = useAnimatedValue(criticalAlerts);

  const chips = [
    {
      key: 'pending',
      icon: <AssignmentLateIcon fontSize="small" />,
      label: `未対応 ${pending.displayValue}件`,
      color:
        pendingHandoffs > 0
          ? theme.palette.warning.main
          : theme.palette.success.main,
      bgColor:
        pendingHandoffs > 0
          ? alpha(theme.palette.warning.main, 0.12)
          : alpha(theme.palette.success.main, 0.12),
      pulse: pendingHandoffs > 3,
      flash: pending.isAnimating,
    },
    {
      key: 'critical',
      icon: <PriorityHighIcon fontSize="small" />,
      label: `重要 ${critical.displayValue}件`,
      color:
        criticalAlerts > 0
          ? theme.palette.error.main
          : theme.palette.success.main,
      bgColor:
        criticalAlerts > 0
          ? alpha(theme.palette.error.main, 0.12)
          : alpha(theme.palette.success.main, 0.12),
      pulse: criticalAlerts > 0,
      flash: critical.isAnimating,
    },
    ...(attendanceRatio
      ? [
          {
            key: 'attendance',
            icon: <GroupsIcon fontSize="small" />,
            label: `出勤 ${attendanceRatio.present}/${attendanceRatio.total}`,
            color: theme.palette.info.main,
            bgColor: alpha(theme.palette.info.main, 0.10),
            pulse: false,
            flash: false,
          },
        ]
      : []),
    ...(dailyRecordRatio
      ? [
          {
            key: 'daily',
            icon: <EditNoteIcon fontSize="small" />,
            label: `日々の記録 ${dailyRecordRatio.done}/${dailyRecordRatio.total}`,
            color:
              dailyRecordRatio.done === dailyRecordRatio.total
                ? theme.palette.success.main
                : theme.palette.text.secondary,
            bgColor:
              dailyRecordRatio.done === dailyRecordRatio.total
                ? alpha(theme.palette.success.main, 0.10)
                : alpha(theme.palette.action.hover, 0.08),
            pulse: false,
            flash: false,
          },
        ]
      : []),
  ];

  // All-clear badge
  const allClear = pendingHandoffs === 0 && criticalAlerts === 0;

  return (
    <Box
      data-testid="bento-command-bar"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1.25,
        borderRadius: 2.5,
        bgcolor: alpha(theme.palette.background.paper, 0.85),
        backdropFilter: 'blur(12px)',
        border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
        boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.06)}`,
        overflowX: 'auto',
        flexWrap: 'nowrap',
        minHeight: 48,
        // glass morphism subtle effect
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          background: `linear-gradient(135deg, ${alpha(theme.palette.common.white, 0.06)} 0%, transparent 50%)`,
          pointerEvents: 'none',
        },
        position: 'relative',
        // ── Keyframes (scoped via SX) ──
        '@keyframes kpiFlash': {
          '0%': { transform: 'scale(1)', filter: 'brightness(1)' },
          '25%': { transform: 'scale(1.12)', filter: 'brightness(1.3)' },
          '50%': { transform: 'scale(0.97)', filter: 'brightness(1.1)' },
          '100%': { transform: 'scale(1)', filter: 'brightness(1)' },
        },
        '@keyframes allClearPop': {
          '0%': { transform: 'scale(0.7)', opacity: 0 },
          '50%': { transform: 'scale(1.1)', opacity: 1 },
          '100%': { transform: 'scale(1)', opacity: 1 },
        },
        '@keyframes bentoChipPulse': {
          '0%, 100%': { boxShadow: `0 0 0 0 transparent` },
          '50%': { boxShadow: `0 0 0 4px transparent` },
        },
      }}
    >
      {allClear && (
        <Chip
          icon={<CheckCircleOutlineIcon />}
          label="All Clear ✓"
          size="small"
          sx={{
            color: theme.palette.success.main,
            bgcolor: alpha(theme.palette.success.main, 0.10),
            fontWeight: 700,
            borderRadius: 2,
            '& .MuiChip-icon': { color: theme.palette.success.main },
            animation: 'allClearPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
          }}
        />
      )}

      {chips.map((chip) => (
        <Chip
          key={chip.key}
          icon={chip.icon}
          label={chip.label}
          size="small"
          onClick={onChipClick ? () => onChipClick(chip.key) : undefined}
          sx={{
            color: chip.color,
            bgcolor: chip.bgColor,
            fontWeight: 600,
            fontSize: '0.8rem',
            borderRadius: 2,
            cursor: onChipClick ? 'pointer' : 'default',
            transition: motionTokens.transition.hoverAll,
            '& .MuiChip-icon': { color: chip.color },
            '&:hover': onChipClick
              ? {
                  transform: 'translateY(-1px)',
                  boxShadow: `0 2px 8px ${alpha(chip.color, 0.25)}`,
                }
              : {},
            // ── Flash animation on value change ──
            ...(chip.flash
              ? {
                  animation: 'kpiFlash 0.6s ease-out',
                  boxShadow: `0 0 12px ${alpha(chip.color, 0.35)}`,
                }
              : {}),
            // ── Pulse animation for critical states ──
            ...(chip.pulse && !chip.flash
              ? {
                  animation: 'bentoChipPulse 2s ease-in-out infinite',
                  '@keyframes bentoChipPulse': {
                    '0%, 100%': { boxShadow: `0 0 0 0 ${alpha(chip.color, 0.3)}` },
                    '50%': { boxShadow: `0 0 0 4px ${alpha(chip.color, 0.1)}` },
                  },
                }
              : {}),
          }}
        />
      ))}
    </Box>
  );
};
