/**
 * StrategyChipBar — 入力時の戦略参照チップ（Phase B）
 *
 * RecordInputStep (Step 3) のヘッダー直下に表示。
 * 支援計画シートの戦略を軽量なチップで常時表示する。
 *
 * Accordion と違い:
 *   - 常時展開（一目で見える）
 *   - 各カテゴリ最大2件に絞る（Step 3 の縦スペースを守る）
 *   - タップしても何も起きない（読み取り専用）
 *   - 戦略がゼロなら非表示
 */
import type { LinkedStrategiesResult } from '@/features/daily/hooks/useLinkedStrategies';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import type React from 'react';
import { memo } from 'react';

// ── Types ──

interface Props {
  strategies: LinkedStrategiesResult;
}

/** Step 3 用: 各カテゴリ最大2件 */
const STEP3_MAX = 2;

// ── カテゴリ定義 ──

const CHIP_CATEGORIES = [
  {
    key: 'antecedent' as const,
    icon: <LightbulbOutlinedIcon sx={{ fontSize: 14 }} />,
    color: '#1976d2',
    bgColor: '#e3f2fd',
    borderColor: '#bbdefb',
  },
  {
    key: 'teaching' as const,
    icon: <SchoolOutlinedIcon sx={{ fontSize: 14 }} />,
    color: '#2e7d32',
    bgColor: '#e8f5e9',
    borderColor: '#c8e6c9',
  },
  {
    key: 'consequence' as const,
    icon: <ShieldOutlinedIcon sx={{ fontSize: 14 }} />,
    color: '#ed6c02',
    bgColor: '#fff3e0',
    borderColor: '#ffe0b2',
  },
] as const;

// ── Component ──

export const StrategyChipBar: React.FC<Props> = memo(({ strategies }) => {
  if (!strategies.hasSheet || strategies.totalCount === 0) {
    return null;
  }

  // 全カテゴリから表示するチップを構築
  const chips: { text: string; color: string; bgColor: string; borderColor: string; icon: React.ReactNode }[] = [];

  for (const cat of CHIP_CATEGORIES) {
    const items = strategies[cat.key].slice(0, STEP3_MAX);
    for (const text of items) {
      chips.push({
        text,
        color: cat.color,
        bgColor: cat.bgColor,
        borderColor: cat.borderColor,
        icon: cat.icon,
      });
    }
  }

  if (chips.length === 0) return null;

  return (
    <Box
      data-testid="strategy-chip-bar"
      sx={{
        px: 1.5,
        py: 0.75,
        bgcolor: 'grey.50',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Stack
        direction="row"
        spacing={0.5}
        sx={{
          flexWrap: 'wrap',
          gap: 0.5,
        }}
        useFlexGap
      >
        {chips.map((chip, i) => (
          <Chip
            key={i}
            icon={<Box sx={{ display: 'flex', color: chip.color }}>{chip.icon}</Box>}
            label={chip.text}
            size="small"
            variant="outlined"
            sx={{
              height: 24,
              fontSize: '0.7rem',
              bgcolor: chip.bgColor,
              borderColor: chip.borderColor,
              color: 'text.primary',
              '& .MuiChip-icon': { ml: 0.5 },
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        ))}
      </Stack>
    </Box>
  );
});

StrategyChipBar.displayName = 'StrategyChipBar';
