import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import { ModuleSummary } from './dashboardSummary.types';

interface ModuleSummaryCardProps {
  summary: ModuleSummary;
  testid?: string;
  onClick?: () => void;
}

/**
 * モジュールサマリーカード
 * 各モジュール（通所管理・支援記録（ケース記録）・IRC）の進捗と状況を表示
 */
export function ModuleSummaryCard({ summary, testid, onClick }: ModuleSummaryCardProps) {
  const getProgressColor = (rate: number) => {
    if (rate >= 90) return 'success';
    if (rate >= 70) return 'warning';
    return 'error';
  };

  const getBackgroundColor = (rate: number) => {
    if (rate >= 90) return 'success.light';
    if (rate >= 70) return 'warning.light';
    return 'error.light';
  };

  return (
    <Card
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': onClick ? {
          transform: 'translateY(-2px)',
          boxShadow: 4
        } : {}
      }}
      onClick={onClick}
      data-testid={testid}
    >
      <CardContent>
        {/* ヘッダー */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="h3">
            {summary.label}
          </Typography>
          <Chip
            label={`${summary.rate}%`}
            color={getProgressColor(summary.rate)}
            size="small"
            sx={{ fontWeight: 'bold' }}
          />
        </Box>

        {/* 進捗バー */}
        <Box sx={{ mb: 2 }}>
          <LinearProgress
            variant="determinate"
            value={summary.rate}
            color={getProgressColor(summary.rate)}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: getBackgroundColor(summary.rate),
            }}
          />
        </Box>

        {/* 統計情報 */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            完了 / 総数
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            {summary.done} / {summary.total}
          </Typography>
        </Box>

        {/* サブ情報 */}
        {summary.total - summary.done > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            残り: {summary.total - summary.done}件
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}