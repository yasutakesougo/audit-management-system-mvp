/**
 * StrategyChipBar — 記録入力時の戦略参照 & 実施トグルチップ（Phase B+C）
 *
 * RecordInputStep (Step 3) のヘッダー直下に表示。
 * 支援計画シートの戦略を軽量なチップで常時表示し、
 * タップで「実施した」をトグルできる。
 *
 * Phase B (読み取り専用) → Phase C (トグル可能) の進化。
 *
 * Accordion と違い:
 *   - 常時展開（一目で見える）
 *   - 各カテゴリ最大2件に絞る（Step 3 の縦スペースを守る）
 *   - 戦略がゼロなら非表示
 *   - タップで ON/OFF（実施記録）
 */
import type { LinkedStrategiesResult } from '@/features/daily/hooks/legacy/useLinkedStrategies';
import type { StrategyCategory } from '@/domain/behavior';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import type React from 'react';
import { memo } from 'react';

// ── Types ──

/** チップの一意識別キー */
export type StrategyChipKey = `${StrategyCategory}:${string}`;

/** 実施済み戦略の Set */
export type AppliedStrategies = Set<StrategyChipKey>;

export interface Props {
  strategies: LinkedStrategiesResult;
  /** 実施済みの戦略キーセット */
  appliedStrategies?: AppliedStrategies;
  /** 戦略トグルコールバック */
  onToggle?: (key: StrategyChipKey) => void;
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
    appliedBg: '#1976d2',
    appliedColor: '#ffffff',
  },
  {
    key: 'teaching' as const,
    icon: <SchoolOutlinedIcon sx={{ fontSize: 14 }} />,
    color: '#2e7d32',
    bgColor: '#e8f5e9',
    borderColor: '#c8e6c9',
    appliedBg: '#2e7d32',
    appliedColor: '#ffffff',
  },
  {
    key: 'consequence' as const,
    icon: <ShieldOutlinedIcon sx={{ fontSize: 14 }} />,
    color: '#ed6c02',
    bgColor: '#fff3e0',
    borderColor: '#ffe0b2',
    appliedBg: '#ed6c02',
    appliedColor: '#ffffff',
  },
] as const;

// ── Helper ──

export function makeChipKey(category: StrategyCategory, text: string): StrategyChipKey {
  return `${category}:${text}`;
}

// ── Component ──

export const StrategyChipBar: React.FC<Props> = memo(({ strategies, appliedStrategies, onToggle }) => {
  if (!strategies.hasSheet || strategies.totalCount === 0) {
    return null;
  }

  // 全カテゴリから表示するチップを構築
  const chips: {
    chipKey: StrategyChipKey;
    text: string;
    category: StrategyCategory;
    color: string;
    bgColor: string;
    borderColor: string;
    appliedBg: string;
    appliedColor: string;
    icon: React.ReactNode;
    isApplied: boolean;
  }[] = [];

  for (const cat of CHIP_CATEGORIES) {
    const items = strategies[cat.key].slice(0, STEP3_MAX);
    for (const text of items) {
      const chipKey = makeChipKey(cat.key, text);
      chips.push({
        chipKey,
        text,
        category: cat.key,
        color: cat.color,
        bgColor: cat.bgColor,
        borderColor: cat.borderColor,
        appliedBg: cat.appliedBg,
        appliedColor: cat.appliedColor,
        icon: cat.icon,
        isApplied: appliedStrategies?.has(chipKey) ?? false,
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
        {chips.map((chip) => (
          <Chip
            key={chip.chipKey}
            icon={
              chip.isApplied
                ? <CheckCircleIcon sx={{ fontSize: 14, color: `${chip.appliedColor} !important` }} />
                : <Box sx={{ display: 'flex', color: chip.color }}>{chip.icon}</Box>
            }
            label={chip.text}
            size="small"
            variant={chip.isApplied ? 'filled' : 'outlined'}
            onClick={onToggle ? () => onToggle(chip.chipKey) : undefined}
            sx={{
              height: 24,
              fontSize: '0.7rem',
              cursor: onToggle ? 'pointer' : 'default',
              bgcolor: chip.isApplied ? chip.appliedBg : chip.bgColor,
              borderColor: chip.isApplied ? chip.appliedBg : chip.borderColor,
              color: chip.isApplied ? chip.appliedColor : 'text.primary',
              transition: 'all 0.15s ease-in-out',
              '& .MuiChip-icon': { ml: 0.5 },
              '& .MuiChip-label': { px: 0.75 },
              '&:hover': onToggle ? {
                opacity: 0.85,
                transform: 'scale(1.02)',
              } : undefined,
            }}
          />
        ))}
      </Stack>
    </Box>
  );
});

StrategyChipBar.displayName = 'StrategyChipBar';
