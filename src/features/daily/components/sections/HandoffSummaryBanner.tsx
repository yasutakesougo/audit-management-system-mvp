/**
 * HandoffSummaryBanner — 申し送りサマリーバナー
 *
 * DailyRecordPage から切り出した presentational コンポーネント。
 * 本日の申し送り件数と重要件数を表示し、タイムラインへの導線を提供する。
 */

import AccessTimeIcon from '@mui/icons-material/AccessTime';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

interface HandoffSummaryBannerProps {
  /** 本日の申し送り総件数 */
  handoffTotal: number;
  /** 重要（critical）件数 */
  handoffCritical: number;
  /** タイムライン遷移ハンドラ */
  onNavigateToTimeline: () => void;
}

export function HandoffSummaryBanner({
  handoffTotal,
  handoffCritical,
  onNavigateToTimeline,
}: HandoffSummaryBannerProps) {
  if (handoffTotal <= 0) return null;

  return (
    <Card
      sx={{
        mb: 2,
        bgcolor: handoffCritical > 0 ? 'error.50' : 'info.50',
        border: '1px solid',
        borderColor: handoffCritical > 0 ? 'error.200' : 'info.200',
      }}
      data-testid="daily-handoff-summary"
    >
      <CardContent>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={2}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <AccessTimeIcon
              color={handoffCritical > 0 ? 'error' : 'primary'}
              sx={{ fontSize: 32 }}
            />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                本日の申し送り: {handoffTotal}件
              </Typography>
              {handoffCritical > 0 && (
                <Typography variant="body2" color="error.main" sx={{ mt: 0.5 }}>
                  ⚠️ 重要 {handoffCritical}件 - 要確認
                </Typography>
              )}
            </Box>
          </Stack>
          <Button
            variant="contained"
            size="medium"
            startIcon={<AccessTimeIcon />}
            onClick={onNavigateToTimeline}
            sx={{ minWidth: { xs: '100%', sm: 'auto' } }}
            data-testid="daily-handoff-summary-cta"
          >
            タイムラインで確認
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
