// ---------------------------------------------------------------------------
// BipSummaryPopover — Read-only BIP summary in a Popover (A-Layer)
//
// 時間割のシールドチップをクリックした際に表示される、
// 行動対応プラン（BIP）のサマリービュー。
// InterventionStrategyForm の3列レイアウトを参考に、読み取り専用で描画。
// ---------------------------------------------------------------------------
import type { BehaviorInterventionPlan } from '@/features/analysis/domain/interventionTypes';
import BlockIcon from '@mui/icons-material/Block';
import HealingIcon from '@mui/icons-material/Healing';
import ShieldIcon from '@mui/icons-material/Shield';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { FC } from 'react';

// ---------------------------------------------------------------------------
// Strategy column definitions (mirrored from InterventionStrategyForm)
// ---------------------------------------------------------------------------

const STRATEGY_COLUMNS = [
  {
    field: 'prevention' as const,
    label: '予防的対応',
    subtitle: '行動が起きる前に',
    icon: <ShieldIcon fontSize="small" />,
    color: '#2e7d32',
    bgColor: '#e8f5e9',
    emptyText: '未入力',
  },
  {
    field: 'alternative' as const,
    label: '代替行動',
    subtitle: '望ましい行動へ',
    icon: <SwapHorizIcon fontSize="small" />,
    color: '#1565c0',
    bgColor: '#e3f2fd',
    emptyText: '未入力',
  },
  {
    field: 'reactive' as const,
    label: '事後対応',
    subtitle: '安全確保',
    icon: <HealingIcon fontSize="small" />,
    color: '#c62828',
    bgColor: '#ffebee',
    emptyText: '未入力',
  },
] as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type BipSummaryPopoverProps = {
  /** PopoverのアンカーElement */
  anchorEl: HTMLElement | null;
  /** 表示するBIPプランの配列 */
  plans: BehaviorInterventionPlan[];
  /** 閉じるコールバック */
  onClose: () => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const BipSummaryPopover: FC<BipSummaryPopoverProps> = ({ anchorEl, plans, onClose }) => {
  const isOpen = Boolean(anchorEl) && plans.length > 0;

  return (
    <Popover
      open={isOpen}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{
        paper: {
          sx: {
            maxWidth: 600,
            maxHeight: 480,
            overflow: 'auto',
            '@media print': {
              maxWidth: 'none',
              maxHeight: 'none',
              boxShadow: 'none',
              border: '1px solid #ccc',
            },
          },
        },
      }}
      data-testid="bip-summary-popover"
    >
      {plans.map((plan, idx) => (
        <Box key={plan.id}>
          {idx > 0 && <Divider />}

          {/* Plan header */}
          <Box sx={{ p: 2, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <BlockIcon color="action" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={700}>
                {plan.targetBehavior}
              </Typography>
            </Stack>
            {plan.triggerFactors.length > 0 && (
              <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5, lineHeight: '22px' }}>
                  引き金:
                </Typography>
                {plan.triggerFactors.map((f) => (
                  <Chip key={f.nodeId} label={f.label} size="small" variant="outlined" />
                ))}
              </Stack>
            )}
          </Box>

          {/* 3-column strategy display (read-only) */}
          <Box
            sx={{
              display: 'grid',
              gap: 0,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
            }}
          >
            {STRATEGY_COLUMNS.map((col, colIdx) => {
              const text = plan.strategies[col.field]?.trim();
              return (
                <Box
                  key={col.field}
                  sx={{
                    p: 1.5,
                    borderRight: colIdx < 2 ? { sm: '1px solid' } : undefined,
                    borderColor: 'divider',
                    borderBottom: { xs: colIdx < 2 ? '1px solid' : undefined, sm: 'none' },
                  }}
                >
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                    <Box sx={{ color: col.color, display: 'flex' }}>{col.icon}</Box>
                    <Typography variant="caption" fontWeight={700} sx={{ color: col.color }}>
                      {col.label}
                    </Typography>
                  </Stack>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1,
                      bgcolor: text ? col.bgColor : 'grey.100',
                      minHeight: 48,
                      borderStyle: text ? 'solid' : 'dashed',
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        whiteSpace: 'pre-wrap',
                        color: text ? 'text.primary' : 'text.disabled',
                        fontStyle: text ? 'normal' : 'italic',
                      }}
                    >
                      {text || col.emptyText}
                    </Typography>
                  </Paper>
                </Box>
              );
            })}
          </Box>
        </Box>
      ))}
    </Popover>
  );
};

export default BipSummaryPopover;
