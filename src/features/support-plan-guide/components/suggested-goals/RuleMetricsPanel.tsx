/**
 * RuleMetricsPanel — ルール別提案品質メトリクスの表示パネル
 *
 * P3-F: ExcellenceTab の提案改善セクションに配置し、
 * どのデータソース由来の提案が採用されやすいか、ノイズが多いかを可視化する。
 *
 * 表示内容:
 *  - ルール別の提案数・採用率・有効率（テーブル）
 *  - bestRule / noisyRule のハイライト
 *  - 判断データがなければ非表示
 */
import React from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

import type { SuggestionRuleMetricsResult } from '../../domain/suggestionRuleMetrics';
import { RULE_LABELS } from '../../domain/suggestionRuleMetrics';
import { formatRate } from '../../domain/suggestionDecisionMetrics';

// ────────────────────────────────────────────
// Props
// ────────────────────────────────────────────

export type RuleMetricsPanelProps = {
  ruleMetrics: SuggestionRuleMetricsResult;
};

// ────────────────────────────────────────────
// ルール行
// ────────────────────────────────────────────

const chipSx = {
  fontSize: '0.65rem',
  height: 20,
  '.MuiChip-label': { px: 0.75 },
} as const;

// ────────────────────────────────────────────
// コンポーネント
// ────────────────────────────────────────────

const RuleMetricsPanel: React.FC<RuleMetricsPanelProps> = ({ ruleMetrics }) => {
  const { ranked, bestRule, noisyRule } = ruleMetrics;

  // 判断ゼロなら非表示
  const hasDecisions = ranked.some((r) => r.decided > 0);
  if (!hasDecisions) return null;

  return (
    <Box
      sx={{
        p: 1.5,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
      }}
    >
      <Stack spacing={1}>
        {/* ヘッダー */}
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <TrendingUpIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="caption" fontWeight="bold" color="text.secondary">
            ルール別 提案品質
          </Typography>
        </Stack>

        {/* サマリーチップ */}
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          {bestRule && (
            <Tooltip title={`${RULE_LABELS[bestRule]}由来の提案が最も採用されています`} arrow>
              <Chip
                icon={<CheckCircleOutlineIcon sx={{ fontSize: 14 }} />}
                label={`効果大: ${RULE_LABELS[bestRule]}`}
                size="small"
                color="success"
                variant="outlined"
                sx={chipSx}
              />
            </Tooltip>
          )}
          {noisyRule && (
            <Tooltip title={`${RULE_LABELS[noisyRule]}由来の提案は見送りが多く、改善の余地があります`} arrow>
              <Chip
                icon={<ErrorOutlineIcon sx={{ fontSize: 14 }} />}
                label={`要改善: ${RULE_LABELS[noisyRule]}`}
                size="small"
                color="warning"
                variant="outlined"
                sx={chipSx}
              />
            </Tooltip>
          )}
        </Stack>

        {/* ルール別テーブル */}
        <Box
          component="table"
          sx={{
            width: '100%',
            borderCollapse: 'collapse',
            '& th, & td': {
              px: 0.75,
              py: 0.25,
              fontSize: '0.7rem',
              textAlign: 'center',
              borderBottom: '1px solid',
              borderColor: 'divider',
            },
            '& th': {
              color: 'text.secondary',
              fontWeight: 600,
            },
            '& td:first-of-type': {
              textAlign: 'left',
              fontWeight: 500,
            },
          }}
        >
          <thead>
            <tr>
              <th>データソース</th>
              <th>提案</th>
              <th>採用</th>
              <th>見送</th>
              <th>保留</th>
              <th>昇格</th>
              <th>採用率</th>
              <th>有効率</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((rule) => {
              const isBest = rule.ruleKey === bestRule;
              const isNoisy = rule.ruleKey === noisyRule;
              return (
                <Box
                  component="tr"
                  key={rule.ruleKey}
                  sx={{
                    bgcolor: isBest
                      ? 'success.50'
                      : isNoisy
                        ? 'warning.50'
                        : 'transparent',
                  }}
                >
                  <td>
                    {RULE_LABELS[rule.ruleKey]}
                    {isBest && ' ✓'}
                    {isNoisy && ' ⚠'}
                  </td>
                  <td>{rule.generated}</td>
                  <td>{rule.accepted}</td>
                  <td>{rule.dismissed}</td>
                  <td>{rule.memoized - rule.promoted}</td>
                  <td>{rule.promoted}</td>
                  <td>{rule.decided > 0 ? formatRate(rule.acceptanceRate) : '—'}</td>
                  <td>{rule.decided > 0 ? formatRate(rule.effectivenessRate) : '—'}</td>
                </Box>
              );
            })}
          </tbody>
        </Box>
      </Stack>
    </Box>
  );
};

export default React.memo(RuleMetricsPanel);
