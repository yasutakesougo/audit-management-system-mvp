/**
 * RiskScoreCard — 利用者リスクスコア一覧カード
 *
 * Phase 2-C の computeRiskScores 結果を表示する。
 * 高リスク利用者を優先表示し、クリックでタイムラインへ遷移可能。
 */

import ShieldIcon from '@mui/icons-material/Shield';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { RiskLevel, RiskScoringResult, UserRiskScore } from '../riskScoring';

// ── レベル表示設定 ──

const LEVEL_CONFIG: Record<RiskLevel, {
  label: string;
  color: 'error' | 'warning' | 'info' | 'success';
  progressColor: 'error' | 'warning' | 'info' | 'success';
}> = {
  critical: { label: '危険', color: 'error', progressColor: 'error' },
  high: { label: '高', color: 'warning', progressColor: 'warning' },
  moderate: { label: '中', color: 'info', progressColor: 'info' },
  low: { label: '低', color: 'success', progressColor: 'success' },
};

// ── Props ──

export interface RiskScoreCardProps {
  /** リスクスコア計算結果 */
  result: RiskScoringResult;
  /** 利用者行のクリック時コールバック */
  onUserClick?: (score: UserRiskScore) => void;
  /** 表示件数上限（デフォルト: 5） */
  maxDisplay?: number;
}

export default function RiskScoreCard({
  result,
  onUserClick,
  maxDisplay = 5,
}: RiskScoreCardProps) {
  const { scores, byLevel, averageScore, totalUsersEvaluated } = result;

  const displayScores = scores.slice(0, maxDisplay);
  const hasCritical = byLevel.critical > 0;

  return (
    <Card
      sx={{
        height: '100%',
        border: hasCritical ? '1px solid' : undefined,
        borderColor: hasCritical ? 'error.light' : undefined,
      }}
    >
      <CardContent>
        {/* ── ヘッダー ── */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <ShieldIcon
            color={hasCritical ? 'error' : 'primary'}
            sx={{ fontSize: 22 }}
          />
          <Typography variant="subtitle1" fontWeight={700}>
            リスクスコア
          </Typography>
          <Typography variant="caption" color="text.secondary">
            平均 {averageScore}点 / {totalUsersEvaluated}名
          </Typography>
        </Stack>

        {/* ── レベルサマリー ── */}
        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
          {(['critical', 'high', 'moderate', 'low'] as RiskLevel[]).map((level) => {
            const count = byLevel[level];
            if (count === 0) return null;
            const cfg = LEVEL_CONFIG[level];
            return (
              <Chip
                key={level}
                label={`${cfg.label} ${count}名`}
                size="small"
                color={cfg.color}
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
            );
          })}
        </Stack>

        <Divider sx={{ mb: 1 }} />

        {/* ── 利用者一覧 ── */}
        {totalUsersEvaluated === 0 ? (
          <Box sx={{ py: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              分析対象の利用者がいません
            </Typography>
          </Box>
        ) : (
          <List dense disablePadding>
            {displayScores.map((score) => {
              const cfg = LEVEL_CONFIG[score.level];
              return (
                <ListItemButton
                  key={score.userCode}
                  onClick={() => onUserClick?.(score)}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    py: 0.75,
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <ListItemText
                    primary={
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        spacing={1}
                      >
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {score.userDisplayName}
                          </Typography>
                          <Chip
                            label={cfg.label}
                            size="small"
                            color={cfg.color}
                            sx={{ fontWeight: 600, height: 20, '& .MuiChip-label': { px: 0.75 } }}
                          />
                        </Stack>
                        <Typography
                          variant="body2"
                          fontWeight={700}
                          color={`${cfg.color}.main`}
                          sx={{ whiteSpace: 'nowrap' }}
                        >
                          {score.score}点
                        </Typography>
                      </Stack>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(score.score, 100)}
                          color={cfg.progressColor}
                          sx={{ height: 4, borderRadius: 2, mb: 0.5 }}
                        />
                        <Stack direction="row" spacing={1} alignItems="center">
                          {score.alerts.length > 0 && (
                            <Typography variant="caption" color="text.secondary">
                              アラート {score.alerts.length}件
                            </Typography>
                          )}
                          {score.patterns.length > 0 && (
                            <Typography variant="caption" color="text.secondary">
                              パターン {score.patterns.length}件
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.disabled" sx={{ ml: 'auto' }}>
                            申し送り{score.totalHandoffs}件
                          </Typography>
                        </Stack>
                      </Box>
                    }
                  />
                </ListItemButton>
              );
            })}
            {totalUsersEvaluated > maxDisplay && (
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ pl: 2, pt: 0.5 }}>
                <TrendingUpIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                <Typography variant="caption" color="text.secondary">
                  他 {totalUsersEvaluated - maxDisplay}名
                </Typography>
              </Stack>
            )}
          </List>
        )}
      </CardContent>
    </Card>
  );
}
