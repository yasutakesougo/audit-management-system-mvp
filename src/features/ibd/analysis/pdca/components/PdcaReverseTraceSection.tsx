/**
 * PdcaReverseTraceSection — PDCA 逆引きトレース表示
 *
 * PDCA 項目が「どの支援計画の、どの戦略に採用されているか」を表示する。
 * Phase 4-B2: IcebergPdcaFormSection 内の各 PDCA カードに埋め込んで使用。
 *
 * @module features/ibd/analysis/pdca/components/PdcaReverseTraceSection
 */

import * as React from 'react';
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';

import { localEvidenceLinkRepository } from '@/infra/localStorage/localEvidenceLinkRepository';
import { getStrategyUsagesForPdcaItem } from '@/domain/isp/reverseTrace';
import type { StrategyUsageSummary } from '@/domain/isp/reverseTrace';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface PdcaReverseTraceSectionProps {
  /** PDCA 項目 ID */
  pdcaItemId: string;
}

// ─────────────────────────────────────────────
// Strategy color mapping
// ─────────────────────────────────────────────

const STRATEGY_COLORS: Record<string, 'info' | 'success' | 'warning'> = {
  antecedentStrategies: 'info',
  teachingStrategies: 'success',
  consequenceStrategies: 'warning',
};

const STRATEGY_SHORT_LABELS: Record<string, string> = {
  antecedentStrategies: '先行事象',
  teachingStrategies: '教授',
  consequenceStrategies: '後続事象',
};

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export const PdcaReverseTraceSection: React.FC<PdcaReverseTraceSectionProps> = ({ pdcaItemId }) => {
  const [summary, setSummary] = React.useState<StrategyUsageSummary | null>(null);

  React.useEffect(() => {
    const allMaps = localEvidenceLinkRepository.getAll();
    const result = getStrategyUsagesForPdcaItem(pdcaItemId, allMaps);
    setSummary(result);
  }, [pdcaItemId]);

  if (!summary) return null;

  // ── 採用なしの場合 ──
  if (summary.totalUsageCount === 0) {
    return (
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1 }}>
        <AccountTreeRoundedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
        <Typography variant="caption" color="text.disabled">
          このPDCAはまだ支援計画に紐づけられていません
        </Typography>
      </Stack>
    );
  }

  // ── 採用ありの場合 ──
  return (
    <Box sx={{ mt: 1.5 }}>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
        <AccountTreeRoundedIcon sx={{ fontSize: 16 }} color="primary" />
        <Typography variant="caption" fontWeight={700} color="primary.main">
          このPDCAが使われている支援
        </Typography>
        <Chip
          label={`${summary.totalUsageCount}件`}
          size="small"
          color="primary"
          variant="outlined"
          sx={{ height: 18, fontSize: '0.6rem' }}
        />
      </Stack>

      <Stack spacing={0.5}>
        {summary.usages.map((usage, idx) => (
          <Paper
            key={`${usage.planningSheetId}-${usage.strategy}-${idx}`}
            variant="outlined"
            sx={{
              px: 1.25, py: 0.5,
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              borderLeftWidth: 3,
              borderLeftColor: `${STRATEGY_COLORS[usage.strategy] ?? 'info'}.main`,
            }}
          >
            <Chip
              label={usage.strategyLabel}
              size="small"
              variant="filled"
              color={STRATEGY_COLORS[usage.strategy] ?? 'info'}
              sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
              支援計画シート: {usage.planningSheetId.slice(0, 12)}…
            </Typography>
            {usage.count > 1 && (
              <Chip
                label={`×${usage.count}`}
                size="small"
                variant="outlined"
                sx={{ height: 16, fontSize: '0.55rem' }}
              />
            )}
          </Paper>
        ))}
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
        {Object.entries(summary.byStrategy)
          .filter(([, count]) => count > 0)
          .map(([key, count]) => (
            <Typography key={key} variant="caption" color="text.secondary">
              {STRATEGY_SHORT_LABELS[key] ?? key}（{count}件）
            </Typography>
          ))}
        <Typography variant="caption" color="text.secondary">
          関連支援計画: {summary.relatedSheetCount}件
        </Typography>
      </Stack>
    </Box>
  );
};
