/**
 * StrategyReferenceAccordion — 今日の参照戦略セクション
 *
 * PlanSelectionStep (Step 2) に埋め込み、選択ユーザーの
 * 現行支援計画シートから取得した戦略テキストを表示する。
 *
 * 設計方針:
 *   - 読み取り専用 — 編集は支援計画シート側の責務
 *   - デフォルト閉じ — 記録入力フローの主動線を邪魔しない
 *   - 戦略がない/シートがない場合は非表示
 *   - 各カテゴリ最大3件（hook 側で制御）
 */
import type { LinkedStrategiesResult } from '@/features/daily/hooks/useLinkedStrategies';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { memo } from 'react';

// ── Types ──

interface Props {
  strategies: LinkedStrategiesResult;
  /** 支援計画シートへの導線（任意） */
  onNavigateToSheet?: (sheetId: string) => void;
}

// ── 戦略カテゴリ定義 ──

const CATEGORIES = [
  {
    key: 'antecedent' as const,
    label: '先行事象（予防的支援）',
    icon: <LightbulbOutlinedIcon sx={{ fontSize: 16 }} />,
    color: '#1976d2',
    bgColor: '#e3f2fd',
  },
  {
    key: 'teaching' as const,
    label: '教授（代替行動）',
    icon: <SchoolOutlinedIcon sx={{ fontSize: 16 }} />,
    color: '#2e7d32',
    bgColor: '#e8f5e9',
  },
  {
    key: 'consequence' as const,
    label: '後続事象（対応）',
    icon: <ShieldOutlinedIcon sx={{ fontSize: 16 }} />,
    color: '#ed6c02',
    bgColor: '#fff3e0',
  },
] as const;

// ── Component ──

export const StrategyReferenceAccordion: React.FC<Props> = memo(({ strategies, onNavigateToSheet }) => {
  // 戦略が何もない or シート自体がない → 非表示
  if (!strategies.hasSheet || strategies.totalCount === 0) {
    return null;
  }

  return (
    <Accordion
      disableGutters
      elevation={0}
      defaultExpanded={false}
      data-testid="strategy-reference-accordion"
      sx={{
        borderTop: 1,
        borderBottom: 1,
        borderColor: 'divider',
        '&::before': { display: 'none' },
        bgcolor: 'grey.50',
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          minHeight: 36,
          '& .MuiAccordionSummary-content': { my: 0.5, alignItems: 'center', gap: 1 },
        }}
      >
        <AssignmentRoundedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
        <Typography variant="caption" fontWeight={600} color="primary.main">
          今日の参照戦略
        </Typography>
        <Chip
          label={`${strategies.totalCount}件`}
          size="small"
          color="primary"
          variant="outlined"
          sx={{ height: 18, fontSize: '0.65rem', ml: 0.5 }}
        />
        {strategies.sheetTitle && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', fontSize: '0.65rem' }}>
            {strategies.sheetTitle}
          </Typography>
        )}
      </AccordionSummary>

      <AccordionDetails sx={{ pt: 0, pb: 1.5, px: 2 }}>
        <Stack spacing={1}>
          {/* 支援課題の優先順位 */}
          {strategies.priorities.length > 0 && (
            <Box>
              <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 0.25, display: 'block' }}>
                支援課題
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {strategies.priorities.map((p, i) => (
                  <Chip
                    key={i}
                    label={p}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', height: 22 }}
                  />
                ))}
              </Stack>
            </Box>
          )}

          {/* 各カテゴリの戦略 */}
          {CATEGORIES.map(({ key, label, icon, color, bgColor }) => {
            const items = strategies[key];
            if (items.length === 0) return null;

            return (
              <Box key={key}>
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.25 }}>
                  <Box sx={{ color }}>{icon}</Box>
                  <Typography variant="caption" fontWeight={600} sx={{ color }}>
                    {label}
                  </Typography>
                </Stack>
                <Stack spacing={0.25}>
                  {items.map((text, i) => (
                    <Box
                      key={i}
                      sx={{
                        px: 1.5,
                        py: 0.5,
                        bgcolor: bgColor,
                        borderRadius: 1,
                        borderLeft: `3px solid ${color}`,
                      }}
                    >
                      <Typography variant="caption" sx={{ fontSize: '0.75rem', lineHeight: 1.4 }}>
                        {text}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            );
          })}

          {/* 計画シートへの導線 */}
          {onNavigateToSheet && strategies.sheetId && (
            <Typography
              variant="caption"
              color="primary"
              onClick={() => onNavigateToSheet(strategies.sheetId!)}
              sx={{
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '0.7rem',
                textAlign: 'right',
                '&:hover': { opacity: 0.7 },
              }}
              data-testid="strategy-navigate-to-sheet"
            >
              支援計画シートを開く →
            </Typography>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
});

StrategyReferenceAccordion.displayName = 'StrategyReferenceAccordion';
