import type { PdcaStopRankingEntry } from '@/features/regulatory/hooks/usePdcaStopRanking';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

type Props = {
  ranking: PdcaStopRankingEntry[];
  isLoading: boolean;
  onNavigate: (url: string) => void;
};

const SEVERITY_COLOR: Record<PdcaStopRankingEntry['severity'], 'success' | 'warning' | 'error' | 'default'> = {
  low: 'success',
  medium: 'warning',
  high: 'error',
  critical: 'error',
};

const SEVERITY_LABEL: Record<PdcaStopRankingEntry['severity'], string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '危険',
};

export const PdcaStopRankingPanel: React.FC<Props> = ({
  ranking,
  isLoading,
  onNavigate,
}) => {
  const topRows = ranking.slice(0, 5);

  return (
    <Card variant="outlined" sx={{ p: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <TrendingUpIcon color="warning" />
        <Typography variant="subtitle1" fontWeight={800}>
          PDCA停止ランキング
        </Typography>
        <Chip
          label={`${ranking.length}件`}
          size="small"
          color={ranking.length > 0 ? 'warning' : 'default'}
          variant={ranking.length > 0 ? 'filled' : 'outlined'}
          sx={{ ml: 'auto', fontWeight: 700 }}
        />
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        未反映パッチ、期限超過、会議停滞をまとめて優先順位化しています。
      </Typography>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : topRows.length === 0 ? (
        <Alert severity="success" variant="outlined">
          現時点で PDCA 停止状態の利用者はありません。
        </Alert>
      ) : (
        <Stack spacing={1.5}>
          {topRows.map((row, index) => (
            <Box
              key={`${row.planningSheetId}-${row.userId}`}
              sx={{
                p: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                bgcolor: index === 0 ? 'rgba(237,108,2,0.06)' : 'background.paper',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Chip
                  label={`${index + 1}位`}
                  size="small"
                  color={index === 0 ? 'warning' : 'default'}
                  variant={index === 0 ? 'filled' : 'outlined'}
                  sx={{ fontWeight: 700 }}
                />
                <Typography variant="body2" fontWeight={700}>
                  {row.userName ?? row.userId}
                </Typography>
                <Chip
                  label={SEVERITY_LABEL[row.severity]}
                  size="small"
                  color={SEVERITY_COLOR[row.severity]}
                  variant="filled"
                  sx={{ fontWeight: 700 }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                  score {row.score}
                </Typography>
              </Box>

              <Box sx={{ mb: 1.5, px: 0.5 }}>
                <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  👉 判定理由：{[
                    row.overdueDays > 0 && `${row.overdueDays}日未更新`,
                    row.pendingPatchCount > 0 && `未反映${row.pendingPatchCount}件`,
                    row.daysSinceLastMeeting > 90 && '会議停滞',
                    row.manualOutcomeCount < 3 && '評価データ不足'
                  ].filter(Boolean).join(' / ') || '定期モニタリング中'}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                <Chip
                  icon={<ErrorOutlineIcon />}
                  label={`未反映 ${row.pendingPatchCount}件`}
                  size="small"
                  color={row.pendingPatchCount > 0 ? 'warning' : 'default'}
                  variant={row.pendingPatchCount > 0 ? 'filled' : 'outlined'}
                />
                <Chip
                  icon={<ScheduleIcon />}
                  label={`期限超過 ${row.overdueDays}日`}
                  size="small"
                  color={row.overdueDays > 0 ? 'error' : 'default'}
                  variant={row.overdueDays > 0 ? 'filled' : 'outlined'}
                />
                <Chip
                  label={`最終会議 ${row.daysSinceLastMeeting}日前`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`根拠 ${row.evidenceCount}件`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`改善成功率 ${Math.round(row.improvementSuccessRate * 100)}%`}
                  size="small"
                  color={row.improvementSuccessRate >= 0.5 ? 'success' : 'default'}
                  variant={row.improvementSuccessRate >= 0.5 ? 'filled' : 'outlined'}
                />
                <Chip
                  label={`KPI評価数 ${row.manualOutcomeCount}件`}
                  size="small"
                  variant="outlined"
                />
                {row.derivedOutcomeCount > 0 && (
                  <Chip
                    label={`自動分析 ${row.derivedOutcomeCount}件`}
                    size="small"
                    variant="outlined"
                    sx={{ borderStyle: 'dashed' }}
                  />
                )}
                <Chip
                  label={`信頼度：${row.confidenceScore === 'high' ? '高' : row.confidenceScore === 'medium' ? '中' : '低'}`}
                  size="small"
                  color={row.confidenceScore === 'high' ? 'success' : row.confidenceScore === 'medium' ? 'warning' : 'default'}
                  variant={row.confidenceScore !== 'low' ? 'filled' : 'outlined'}
                />
              </Box>

              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant={row.manualOutcomeCount < 3 ? 'outlined' : 'contained'}
                  color="primary"
                  onClick={() => onNavigate(`/support-planning-sheet/${row.planningSheetId}?tab=planning`)}
                >
                  計画更新を確認
                </Button>
                <Button
                  size="small"
                  variant={row.manualOutcomeCount < 3 ? 'contained' : 'outlined'}
                  color="primary"
                  startIcon={<AssignmentRoundedIcon />}
                  onClick={() => onNavigate(`/monitoring-meeting/${row.userId}`)}
                >
                  モニタリング会議
                </Button>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Card>
  );
};
