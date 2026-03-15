/**
 * EvidencePatternSummaryCard — 根拠パターン集計サマリー (Phase 3-B)
 *
 * 支援計画シート内に表示し、Evidence Links の傾向を一目で把握できるようにする。
 *
 * 表示内容:
 *  - 戦略別の採用件数（ABC / PDCA）
 *  - よく採用される ABC 上位3件
 *  - よく採用される PDCA 上位3件
 *  - 頻出場面・頻出行動
 *  - 強度分布バー
 *
 * @module features/planning-sheet/components/EvidencePatternSummaryCard
 */

import * as React from 'react';
import {
  Box,
  Chip,
  Collapse,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import BubbleChartRoundedIcon from '@mui/icons-material/BubbleChartRounded';

import type { EvidenceLinkMap } from '@/domain/isp/evidenceLink';
import type { AbcRecord } from '@/domain/abc/abcRecord';
import {
  buildEvidencePatternSummary,
  type EvidencePatternSummary,
  type RankedItem,
  type StrategyLinkCounts,
} from '@/domain/isp/evidencePatternAnalysis';

// ── Types ──

interface EvidencePatternSummaryCardProps {
  /** Evidence Links マップ */
  evidenceLinks: EvidenceLinkMap;
  /** ABC 記録（対象利用者） */
  abcRecords: AbcRecord[];
  /** 初期展開状態 */
  defaultExpanded?: boolean;
}

// ── Constants ──

const STRATEGY_DISPLAY: Record<string, { label: string; color: string }> = {
  antecedentStrategies: { label: '先行事象戦略', color: '#4caf50' },
  teachingStrategies: { label: '教授戦略', color: '#2196f3' },
  consequenceStrategies: { label: '後続事象戦略', color: '#ff9800' },
};

const INTENSITY_COLORS = {
  low: '#4caf50',
  medium: '#ff9800',
  high: '#f44336',
} as const;

const TOP_N = 3;

// ── Sub-components ──

/** 戦略別採用件数バー */
const StrategyCountsGrid: React.FC<{ counts: StrategyLinkCounts }> = ({ counts }) => {
  const strategies = ['antecedentStrategies', 'teachingStrategies', 'consequenceStrategies'] as const;

  return (
    <Stack spacing={1}>
      <Typography variant="caption" fontWeight={600} color="text.secondary">
        戦略別 採用件数
      </Typography>
      {strategies.map(key => {
        const { label, color } = STRATEGY_DISPLAY[key];
        const data = counts[key];
        const maxTotal = Math.max(
          counts.antecedentStrategies.total,
          counts.teachingStrategies.total,
          counts.consequenceStrategies.total,
          1,
        );

        return (
          <Stack key={key} spacing={0.25}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" sx={{ color }}>{label}</Typography>
              <Stack direction="row" spacing={0.5}>
                <Chip
                  size="small"
                  label={`ABC ${data.abc}`}
                  color="success"
                  variant="outlined"
                  sx={{ height: 18, fontSize: '0.6rem' }}
                />
                <Chip
                  size="small"
                  label={`PDCA ${data.pdca}`}
                  color="info"
                  variant="outlined"
                  sx={{ height: 18, fontSize: '0.6rem' }}
                />
              </Stack>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={(data.total / maxTotal) * 100}
              sx={{
                height: 6,
                borderRadius: 1,
                bgcolor: 'action.hover',
                '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 1 },
              }}
            />
          </Stack>
        );
      })}

      {/* Grand total */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ pt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">合計</Typography>
        <Chip
          size="small"
          label={`${counts.grandTotal.total}件`}
          sx={{ height: 20, fontWeight: 700, fontSize: '0.7rem' }}
        />
        <Typography variant="caption" color="text.disabled">
          (ABC {counts.grandTotal.abc} / PDCA {counts.grandTotal.pdca})
        </Typography>
      </Stack>
    </Stack>
  );
};

/** ランキングリスト */
const RankedList: React.FC<{
  title: string;
  icon: React.ReactNode;
  items: RankedItem[];
  emptyText: string;
  chipColor: 'success' | 'info';
}> = ({ title, icon, items, emptyText, chipColor }) => (
  <Box>
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
      <Box sx={{ display: 'flex', fontSize: 14, color: 'text.secondary' }}>{icon}</Box>
      <Typography variant="caption" fontWeight={600} color="text.secondary">{title}</Typography>
    </Stack>
    {items.length > 0 ? (
      <Stack spacing={0.25}>
        {items.map((item, i) => (
          <Stack key={item.id} direction="row" spacing={0.75} alignItems="center">
            <Typography
              variant="caption"
              sx={{
                width: 18,
                textAlign: 'center',
                fontWeight: 700,
                color: i === 0 ? 'primary.main' : 'text.disabled',
              }}
            >
              {i + 1}
            </Typography>
            <Tooltip title={item.label}>
              <Typography variant="caption" noWrap sx={{ flex: 1, maxWidth: 180 }}>
                {item.label}
              </Typography>
            </Tooltip>
            <Chip
              size="small"
              label={`${item.count}回`}
              color={chipColor}
              variant="outlined"
              sx={{ height: 18, fontSize: '0.6rem', minWidth: 38 }}
            />
          </Stack>
        ))}
      </Stack>
    ) : (
      <Typography variant="caption" color="text.disabled">{emptyText}</Typography>
    )}
  </Box>
);

/** 強度分布バー */
const IntensityBar: React.FC<{
  low: number;
  medium: number;
  high: number;
  total: number;
  riskCount: number;
}> = ({ low, medium, high, total, riskCount }) => {
  if (total === 0) return null;

  const pct = (v: number) => Math.round((v / total) * 100);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.25 }}>
        <Typography variant="caption" fontWeight={600} color="text.secondary">強度分布</Typography>
        {riskCount > 0 && (
          <Chip
            size="small"
            label={`危険 ${riskCount}件 (${pct(riskCount)}%)`}
            color="error"
            variant="outlined"
            sx={{ height: 18, fontSize: '0.6rem' }}
          />
        )}
      </Stack>
      <Box
        sx={{
          display: 'flex',
          height: 10,
          borderRadius: 1,
          overflow: 'hidden',
          border: 1,
          borderColor: 'divider',
        }}
      >
        {low > 0 && (
          <Tooltip title={`軽度: ${low}件 (${pct(low)}%)`}>
            <Box sx={{ width: `${pct(low)}%`, bgcolor: INTENSITY_COLORS.low }} />
          </Tooltip>
        )}
        {medium > 0 && (
          <Tooltip title={`中度: ${medium}件 (${pct(medium)}%)`}>
            <Box sx={{ width: `${pct(medium)}%`, bgcolor: INTENSITY_COLORS.medium }} />
          </Tooltip>
        )}
        {high > 0 && (
          <Tooltip title={`重度: ${high}件 (${pct(high)}%)`}>
            <Box sx={{ width: `${pct(high)}%`, bgcolor: INTENSITY_COLORS.high }} />
          </Tooltip>
        )}
      </Box>
      <Stack direction="row" spacing={1} sx={{ mt: 0.25 }}>
        {[
          { label: '軽度', count: low, color: INTENSITY_COLORS.low },
          { label: '中度', count: medium, color: INTENSITY_COLORS.medium },
          { label: '重度', count: high, color: INTENSITY_COLORS.high },
        ].map(item => (
          <Typography key={item.label} variant="caption" sx={{ color: item.color }}>
            {item.label} {item.count}
          </Typography>
        ))}
      </Stack>
    </Box>
  );
};

// ── Main Component ──

export const EvidencePatternSummaryCard: React.FC<EvidencePatternSummaryCardProps> = ({
  evidenceLinks,
  abcRecords,
  defaultExpanded = true,
}) => {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  const summary: EvidencePatternSummary = React.useMemo(
    () => buildEvidencePatternSummary(evidenceLinks, abcRecords, TOP_N),
    [evidenceLinks, abcRecords],
  );

  // データが何もなければ表示しない
  if (summary.totalLinks === 0 && summary.totalAbcRecords === 0) {
    return null;
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        overflow: 'hidden',
        borderColor: 'primary.main',
        borderStyle: 'solid',
      }}
    >
      {/* ── Header ── */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
        sx={{
          px: 2,
          py: 1,
          cursor: 'pointer',
          bgcolor: 'primary.50',
          '&:hover': { bgcolor: 'primary.100' },
        }}
        onClick={() => setExpanded(e => !e)}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <InsightsRoundedIcon color="primary" fontSize="small" />
          <Typography variant="subtitle2" fontWeight={700} color="primary">
            Evidence Pattern Analysis
          </Typography>
          <Chip
            size="small"
            label={`根拠 ${summary.totalLinks}件`}
            color="primary"
            variant="outlined"
            sx={{ height: 20, fontSize: '0.65rem' }}
          />
          {summary.totalAbcRecords > 0 && (
            <Chip
              size="small"
              label={`ABC ${summary.totalAbcRecords}件`}
              variant="outlined"
              sx={{ height: 20, fontSize: '0.65rem' }}
            />
          )}
        </Stack>
        {expanded ? <ExpandLessRoundedIcon fontSize="small" /> : <ExpandMoreRoundedIcon fontSize="small" />}
      </Stack>

      <Collapse in={expanded}>
        <Divider />
        <Box sx={{ px: 2, py: 1.5 }}>
          <Stack spacing={2}>
            {/* ── 戦略別採用件数 ── */}
            {summary.totalLinks > 0 && (
              <StrategyCountsGrid counts={summary.strategyLinkCounts} />
            )}

            {/* ── よく採用される根拠 ── */}
            {(summary.topLinkedAbcRecords.length > 0 || summary.topLinkedPdcaItems.length > 0) && (
              <>
                <Divider />
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  divider={<Divider orientation="vertical" flexItem />}
                >
                  <RankedList
                    title={`よく採用されるABC (上位${TOP_N})`}
                    icon={<EditNoteRoundedIcon fontSize="inherit" />}
                    items={summary.topLinkedAbcRecords}
                    emptyText="ABC根拠なし"
                    chipColor="success"
                  />
                  <RankedList
                    title={`よく採用されるPDCA (上位${TOP_N})`}
                    icon={<BubbleChartRoundedIcon fontSize="inherit" />}
                    items={summary.topLinkedPdcaItems}
                    emptyText="PDCA根拠なし"
                    chipColor="info"
                  />
                </Stack>
              </>
            )}

            {/* ── 頻出場面・行動 ── */}
            {(summary.topSettings.length > 0 || summary.topBehaviors.length > 0) && (
              <>
                <Divider />
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                >
                  {summary.topSettings.length > 0 && (
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                        頻出場面
                      </Typography>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {summary.topSettings.map(s => (
                          <Chip
                            key={s.id}
                            size="small"
                            label={`${s.label} (${s.count})`}
                            variant="outlined"
                            sx={{ height: 22 }}
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}
                  {summary.topBehaviors.length > 0 && (
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                        頻出行動
                      </Typography>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {summary.topBehaviors.map(b => (
                          <Chip
                            key={b.id}
                            size="small"
                            label={`${b.label} (${b.count})`}
                            variant="outlined"
                            color="warning"
                            sx={{ height: 22 }}
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </>
            )}

            {/* ── 強度分布 ── */}
            {summary.overallIntensity.total > 0 && (
              <>
                <Divider />
                <IntensityBar
                  low={summary.overallIntensity.low}
                  medium={summary.overallIntensity.medium}
                  high={summary.overallIntensity.high}
                  total={summary.overallIntensity.total}
                  riskCount={summary.overallIntensity.riskCount}
                />
              </>
            )}

            {/* ── 有効支援パターン ── */}
            {summary.settingBehaviorPatterns.length > 0 && (
              <>
                <Divider />
                <Box>
                  <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                    有効支援パターン（場面 × 行動）
                  </Typography>
                  <Stack spacing={0.5}>
                    {summary.settingBehaviorPatterns.map((p, i) => (
                      <Paper
                        key={`${p.setting}-${p.behavior}`}
                        variant="outlined"
                        sx={{
                          px: 1.5,
                          py: 0.75,
                          borderLeftWidth: 3,
                          borderLeftColor: p.dominantStrategy
                            ? STRATEGY_DISPLAY[p.dominantStrategy]?.color ?? 'grey.400'
                            : 'grey.400',
                        }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ minWidth: 18 }}>
                            {i + 1}
                          </Typography>
                          <Chip size="small" label={p.setting} variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                          <Typography variant="caption">×</Typography>
                          <Typography variant="caption" fontWeight={500}>{p.behavior}</Typography>
                          <Box sx={{ flex: 1 }} />
                          <Chip
                            size="small"
                            label={`${p.count}回`}
                            color="primary"
                            variant="outlined"
                            sx={{ height: 18, fontSize: '0.6rem' }}
                          />
                          {p.dominantStrategy && (
                            <Tooltip title={`最多採用: ${STRATEGY_DISPLAY[p.dominantStrategy]?.label}`}>
                              <Chip
                                size="small"
                                label={STRATEGY_DISPLAY[p.dominantStrategy]?.label}
                                sx={{
                                  height: 18,
                                  fontSize: '0.55rem',
                                  bgcolor: STRATEGY_DISPLAY[p.dominantStrategy]?.color,
                                  color: '#fff',
                                }}
                              />
                            </Tooltip>
                          )}
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              </>
            )}
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
};
