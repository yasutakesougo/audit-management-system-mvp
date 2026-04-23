import React from 'react';
import {
  Container,
  Typography,
  Stack,
  Button,
  Box,
  Paper,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import DirectionsBusRoundedIcon from '@mui/icons-material/DirectionsBusRounded';

import { TransportStatusCard } from '@/features/today/transport/TransportStatusCard';
import { useTransportStatus } from '@/features/today/transport/useTransportStatus';
import { useTransportHighlight } from '@/features/today/transport/useTransportHighlight';

/**
 * TransportExecutionPage — Dedicated page for recording transport status.
 *
 * Provides a focused view for staff to mark arrivals/departures,
 * distinct from the planning-oriented TransportAssignmentPage.
 */
const TransportExecutionPage: React.FC = () => {
  const transport = useTransportStatus();
  const transportHighlight = useTransportHighlight();

  return (
    <Container maxWidth="lg" sx={{ py: 3 }} data-testid="transport-execution-page">
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 2,
            }}
          >
            <DirectionsBusRoundedIcon sx={{ color: 'white' }} />
          </Box>
          <Box>
            <Typography variant="h4" component="h1" fontWeight="bold">
              送迎実施
            </Typography>
            <Typography variant="caption" color="text.secondary">
              本日の送迎状況の確認・到着記録
            </Typography>
          </Box>
        </Stack>
        <Button
          component={RouterLink}
          to="/today"
          startIcon={<ArrowBackRoundedIcon />}
          variant="outlined"
          sx={{ borderRadius: 2 }}
        >
          今日の業務へ戻る
        </Button>
      </Stack>

      {/* Main Content */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1-fr', md: '2fr 1fr' }, gap: 3 }}>
        {/* Left: The Main Status Card */}
        <Box sx={{ gridColumn: { xs: 'span 1', md: 'span 1' } }}>
          <TransportStatusCard
            legs={transport.status.legs}
            toSummary={transport.status.to}
            fromSummary={transport.status.from}
            activeDirection={transport.activeDirection}
            onDirectionChange={transport.setActiveDirection}
            onTransition={transport.transition}
            currentTime={transport.currentTime}
            highlightUserId={transportHighlight.userId}
          />
        </Box>

        {/* Right: Operational Info / Help */}
        <Stack spacing={3}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: 'grey.50' }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              💡 送迎実施のポイント
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              ・車両が出発したら「出発」をタップしてください。
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              ・到着したら「到着」ボタンで記録を完了します。
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ・配車の変更が必要な場合は「配車表を編集」から調整してください。
            </Typography>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              ⚙️ クイックアクション
            </Typography>
            <Stack spacing={1}>
              <Button
                component={RouterLink}
                to="/transport/assignments"
                variant="text"
                fullWidth
                sx={{ justifyContent: 'flex-start' }}
              >
                📅 配車表を編集
              </Button>
              <Button
                component={RouterLink}
                to="/daily/attendance"
                variant="text"
                fullWidth
                sx={{ justifyContent: 'flex-start' }}
              >
                👥 通所管理を開く
              </Button>
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </Container>
  );
};

export default TransportExecutionPage;
