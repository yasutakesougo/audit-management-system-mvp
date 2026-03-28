/**
 * @fileoverview 行動タグ × 問題行動 × 時間帯 クロス集計パネル
 * @description
 * TableDailyRecordForm 内で BehaviorTagInsightBar の下に配置。
 * - 3行以上で表示
 * - デフォルト折りたたみ（詳細分析は「確認したい人が開く」性質）
 */

import AnalyticsIcon from '@mui/icons-material/Analytics';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import {
  Box,
  Chip,
  Collapse,
  Divider,
  IconButton,
  Paper,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import {
  computeBehaviorTagCrossInsights,
  type CrossInsightInput,
} from '../../domain/behavior/behaviorTagCrossInsights';

// ─── Props ──────────────────────────────────────────────

type BehaviorTagCrossInsightPanelProps = {
  rows: CrossInsightInput[];
};

// ─── Component ──────────────────────────────────────────

export const BehaviorTagCrossInsightPanel: React.FC<BehaviorTagCrossInsightPanelProps> = ({
  rows,
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  const insights = useMemo(() => computeBehaviorTagCrossInsights(rows), [rows]);

  // 表示条件: 3行以上 & タグ付き行がある
  if (!insights || rows.length < 3) return null;

  return (
    <Paper
      variant="outlined"
      role="region"
      aria-label="行動タグクロス集計"
      sx={{
        bgcolor: alpha(theme.palette.secondary.main, 0.02),
        borderColor: alpha(theme.palette.secondary.main, 0.12),
      }}
    >
      {/* ── ヘッダー（常時表示: クリックで展開） ── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 1.5,
          py: 0.5,
          cursor: 'pointer',
          '&:hover': { bgcolor: alpha(theme.palette.secondary.main, 0.04) },
        }}
        onClick={() => setExpanded(prev => !prev)}
      >
        <AnalyticsIcon sx={{ fontSize: 14, color: 'secondary.main', mr: 0.5 }} />
        <Typography
          variant="caption"
          sx={{ fontWeight: 600, color: 'secondary.main', flex: 1 }}
        >
          クロス集計
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
          {insights.taggedRows}/{insights.totalRows}件
        </Typography>
        <IconButton size="small" sx={{ p: 0 }}>
          {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
        </IconButton>
      </Box>

      {/* ── 折りたたみ本体 ── */}
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Divider />
        <Box sx={{ px: 1.5, py: 1 }}>

          {/* ── A. タグ別 問題行動併発率 ── */}
          <Section title="タグ別 問題行動併発率">
            {insights.tagProblemRates.length === 0 ? (
              <Typography variant="caption" color="text.secondary">
                データなし
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {insights.tagProblemRates.map(t => (
                  <Chip
                    key={t.tagKey}
                    label={`${t.tagLabel} ${t.rate}%`}
                    size="small"
                    variant="outlined"
                    color={t.rate >= 50 ? 'warning' : 'default'}
                    sx={{
                      height: 24,
                      fontSize: '0.65rem',
                      '& .MuiChip-label': { px: 0.75 },
                    }}
                  />
                ))}
              </Box>
            )}
          </Section>

          {/* ── B. 活動スロット別 Top3 タグ ── */}
          <Section title="活動スロット別 Top3">
            <Box sx={{ display: 'flex', gap: 2 }}>
              {insights.slotTagFrequency.map(sf => (
                <Box key={sf.slot} sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 600, fontSize: '0.65rem', display: 'block', mb: 0.25 }}
                  >
                    {sf.slotLabel}（{sf.totalRows}件）
                  </Typography>
                  {sf.topTags.length === 0 ? (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                      —
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
                      {sf.topTags.map((t, i) => (
                        <Typography
                          key={t.tagKey}
                          variant="caption"
                          sx={{ fontSize: '0.65rem' }}
                        >
                          {i + 1}. {t.tagLabel}({t.count})
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          </Section>

          {/* ── C. 問題行動あり/なし別 平均タグ数 ── */}
          <Section title="問題行動有無 × 平均タグ数">
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Metric label="あり" value={insights.avgTagsByProblem.withProblem} unit="個/人" />
              <Metric label="なし" value={insights.avgTagsByProblem.withoutProblem} unit="個/人" />
            </Box>
          </Section>
        </Box>
      </Collapse>
    </Paper>
  );
};

// ─── 内部サブコンポーネント ──────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <Box sx={{ mb: 1, '&:last-child': { mb: 0 } }}>
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', mb: 0.25, display: 'block' }}
    >
      {title}
    </Typography>
    {children}
  </Box>
);

const Metric: React.FC<{ label: string; value: number; unit: string }> = ({
  label,
  value,
  unit,
}) => (
  <Box sx={{ textAlign: 'center' }}>
    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', display: 'block' }}>
      {label}
    </Typography>
    <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
      {value}
    </Typography>
    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.55rem' }}>
      {unit}
    </Typography>
  </Box>
);
