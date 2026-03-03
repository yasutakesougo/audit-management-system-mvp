// ---------------------------------------------------------------------------
// ABCSummaryReport — ABC分析集計レポート + 代替行動推奨
// 蓄積されたABCデータを分析し、PBSに基づく支援戦略を自動推奨する
// ---------------------------------------------------------------------------
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { FC } from 'react';
import { useMemo } from 'react';

import type { ABCRecord, ABCSummary, BehaviorFunction, BehaviorOutcome } from '../ibdTypes';
import {
    ALTERNATIVE_BEHAVIOR_RECOMMENDATIONS,
    BEHAVIOR_FUNCTION_COLORS,
    BEHAVIOR_FUNCTION_LABELS,
    BEHAVIOR_OUTCOME_LABELS,
    calculateABCSummary,
} from '../ibdTypes';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ABCSummaryReportProps = {
  records: ABCRecord[];
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const FunctionBar: FC<{
  func: BehaviorFunction;
  count: number;
  total: number;
}> = ({ func, count, total }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minHeight: 32 }}>
      <Typography variant="body2" sx={{ minWidth: 110, fontWeight: 600, color: BEHAVIOR_FUNCTION_COLORS[func] }}>
        {BEHAVIOR_FUNCTION_LABELS[func]}
      </Typography>
      <Box sx={{ flex: 1 }}>
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{
            height: 12,
            borderRadius: 6,
            bgcolor: 'grey.100',
            '& .MuiLinearProgress-bar': {
              bgcolor: BEHAVIOR_FUNCTION_COLORS[func],
              borderRadius: 6,
            },
          }}
        />
      </Box>
      <Typography variant="body2" fontWeight={600} sx={{ minWidth: 60, textAlign: 'right' }}>
        {count}件 ({pct}%)
      </Typography>
    </Stack>
  );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ABCSummaryReport: FC<ABCSummaryReportProps> = ({ records }) => {
  const summary: ABCSummary = useMemo(() => calculateABCSummary(records), [records]);

  // 最も多い機能を特定
  const dominantFunction = useMemo(() => {
    const entries = Object.entries(summary.functionBreakdown) as [BehaviorFunction, number][];
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    return sorted[0][1] > 0 ? sorted[0][0] : null;
  }, [summary]);

  if (records.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', borderRadius: 2 }}>
        <Typography color="text.secondary">
          ABC分析データがありません。まず記録を入力してください。
        </Typography>
      </Paper>
    );
  }

  const totalWithFunction = Object.values(summary.functionBreakdown).reduce((a, b) => a + b, 0);

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }} data-testid="abc-summary-report">
      <Stack spacing={3}>
        <Typography variant="h6" fontWeight={600}>
          📊 ABC分析 集計レポート
        </Typography>

        {/* ── 統計ヘッダー ── */}
        <Stack direction="row" spacing={3}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', flex: 1 }}>
            <Typography variant="caption" color="text.secondary">総記録数</Typography>
            <Typography variant="h4" fontWeight={700}>{summary.totalRecords}</Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', flex: 1 }}>
            <Typography variant="caption" color="text.secondary">平均強度</Typography>
            <Typography variant="h4" fontWeight={700}>{summary.averageIntensity ?? '-'}/5</Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', flex: 1 }}>
            <Typography variant="caption" color="text.secondary">主要機能</Typography>
            <Typography
              variant="h6"
              fontWeight={700}
              sx={{ color: dominantFunction ? BEHAVIOR_FUNCTION_COLORS[dominantFunction] : 'text.secondary' }}
            >
              {dominantFunction ? BEHAVIOR_FUNCTION_LABELS[dominantFunction] : '-'}
            </Typography>
          </Paper>
        </Stack>

        <Divider />

        {/* ── 機能別頻度 ── */}
        <Box>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            🧠 行動の機能分析
          </Typography>
          <Stack spacing={1}>
            {(Object.entries(summary.functionBreakdown) as [BehaviorFunction, number][]).map(
              ([func, count]) => (
                <FunctionBar key={func} func={func} count={count} total={totalWithFunction} />
              )
            )}
          </Stack>
        </Box>

        <Divider />

        {/* ── 先行事象ランキング ── */}
        <Box>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            📋 よくある先行事象 TOP5
          </Typography>
          {summary.topAntecedents.length > 0 ? (
            <Stack spacing={0.5}>
              {summary.topAntecedents.map((item, idx) => (
                <Stack key={item.tag} direction="row" spacing={1} alignItems="center">
                  <Chip
                    label={`#${idx + 1}`}
                    size="small"
                    sx={{ width: 40, fontWeight: 700 }}
                  />
                  <Typography variant="body2" sx={{ flex: 1 }}>{item.tag}</Typography>
                  <Chip label={`${item.count}回`} size="small" variant="outlined" />
                </Stack>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              先行事象タグの記録がありません
            </Typography>
          )}
        </Box>

        <Divider />

        {/* ── 行動変化の内訳 ── */}
        <Box>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            📈 介入後の行動変化
          </Typography>
          <Stack direction="row" spacing={1}>
            {(Object.entries(summary.outcomeBreakdown) as [BehaviorOutcome, number][]).map(
              ([key, count]) => (
                <Chip
                  key={key}
                  label={`${BEHAVIOR_OUTCOME_LABELS[key]}: ${count}件`}
                  variant="outlined"
                  color={key === 'decreased' ? 'success' : key === 'increased' ? 'error' : 'default'}
                />
              )
            )}
          </Stack>
        </Box>

        <Divider />

        {/* ── 代替行動の推奨 ── */}
        {dominantFunction && (
          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              💡 推奨される代替行動（PBS: ポジティブ行動支援）
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              最も多い機能「{BEHAVIOR_FUNCTION_LABELS[dominantFunction]}」に基づく推奨：
              {ALTERNATIVE_BEHAVIOR_RECOMMENDATIONS[dominantFunction].label}
            </Typography>

            <Stack spacing={0.5}>
              {ALTERNATIVE_BEHAVIOR_RECOMMENDATIONS[dominantFunction].alternatives.map((alt) => (
                <Paper
                  key={alt}
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderLeft: 3,
                    borderLeftColor: BEHAVIOR_FUNCTION_COLORS[dominantFunction],
                  }}
                >
                  <Typography variant="body2">✅ {alt}</Typography>
                </Paper>
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </Paper>
  );
};

export default ABCSummaryReport;
