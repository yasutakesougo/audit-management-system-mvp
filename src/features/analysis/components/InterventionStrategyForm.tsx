// ---------------------------------------------------------------------------
// InterventionStrategyForm — 3列介入戦略フォーム (A-Layer)
//
// 予防的対応 / 代替行動 / 事後対応 を横並びで編集する。
// タブレット幅以下では1列に折りたたむ。
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
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { FC } from 'react';
import { useCallback } from 'react';

// ---------------------------------------------------------------------------
// Column configuration
// ---------------------------------------------------------------------------

const STRATEGY_COLUMNS = [
  {
    field: 'prevention' as const,
    label: '予防的対応',
    subtitle: '行動が起きる前にできること',
    icon: <ShieldIcon />,
    color: '#2e7d32', // green
    bgColor: '#e8f5e9',
    placeholder: '例: 作業前に環境を整える、予定を視覚的に伝える',
  },
  {
    field: 'alternative' as const,
    label: '代替行動',
    subtitle: '望ましい行動への置き換え',
    icon: <SwapHorizIcon />,
    color: '#1565c0', // blue
    bgColor: '#e3f2fd',
    placeholder: '例: カードで「休憩したい」と伝える練習をする',
  },
  {
    field: 'reactive' as const,
    label: '事後対応',
    subtitle: '行動が起きた後の安全確保',
    icon: <HealingIcon />,
    color: '#c62828', // red
    bgColor: '#ffebee',
    placeholder: '例: 静かな場所へ誘導しクールダウンを促す',
  },
] as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type InterventionStrategyFormProps = {
  plan: BehaviorInterventionPlan;
  onUpdate: (field: 'prevention' | 'alternative' | 'reactive', value: string) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const InterventionStrategyForm: FC<InterventionStrategyFormProps> = ({ plan, onUpdate }) => {
  const handleChange = useCallback(
    (field: 'prevention' | 'alternative' | 'reactive') =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        onUpdate(field, e.target.value);
      },
    [onUpdate],
  );

  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }} data-testid="intervention-strategy-form">
      {/* Header */}
      <Box sx={{ p: 2.5, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <BlockIcon color="action" />
          <Typography variant="h6" fontWeight={700}>
            {plan.targetBehavior}
          </Typography>
        </Stack>
        {plan.triggerFactors.length > 0 && (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5, lineHeight: '24px' }}>
              引き金:
            </Typography>
            {plan.triggerFactors.map((f) => (
              <Chip key={f.nodeId} label={f.label} size="small" variant="outlined" />
            ))}
          </Stack>
        )}
      </Box>

      <Divider />

      {/* 3-column strategy grid */}
      <Box
        sx={{
          display: 'grid',
          gap: 0,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
        }}
      >
        {STRATEGY_COLUMNS.map((col, idx) => (
          <Box
            key={col.field}
            sx={{
              p: 2.5,
              borderRight: idx < 2 ? { md: '1px solid' } : undefined,
              borderColor: 'divider',
              borderBottom: { xs: idx < 2 ? '1px solid' : undefined, md: 'none' },
            }}
          >
            {/* Column header */}
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <Box sx={{ color: col.color, display: 'flex' }}>{col.icon}</Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: col.color }}>
                {col.label}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              {col.subtitle}
            </Typography>

            {/* Input */}
            <TextField
              multiline
              minRows={4}
              maxRows={10}
              fullWidth
              size="small"
              variant="outlined"
              placeholder={col.placeholder}
              value={plan.strategies[col.field]}
              onChange={handleChange(col.field)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: col.bgColor,
                  '&.Mui-focused': { bgcolor: '#fff' },
                },
              }}
              data-testid={`strategy-${col.field}`}
            />
          </Box>
        ))}
      </Box>

      {/* Footer timestamp */}
      <Box sx={{ p: 1.5, bgcolor: 'grey.50', borderTop: '1px solid', borderColor: 'divider', textAlign: 'right' }}>
        <Typography variant="caption" color="text.secondary">
          最終更新: {new Date(plan.updatedAt).toLocaleString('ja-JP')}
        </Typography>
      </Box>
    </Paper>
  );
};

export default InterventionStrategyForm;
