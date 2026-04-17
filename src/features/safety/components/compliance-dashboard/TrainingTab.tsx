/**
 * TrainingTab — 研修実施状況タブ
 */
import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import type { TrainingRecord, TrainingSummary } from '@/domain/safety/trainingRecord';
import { TESTIDS } from '@/testids';
import { formatDateJapanese, formatDateYmd } from '@/lib/dateFormat';

interface TrainingTabProps {
  records: TrainingRecord[];
  summary: TrainingSummary;
}

export const TrainingTab: React.FC<TrainingTabProps> = ({ records, summary }) => {
  const sorted = useMemo(
    () =>
      [...records]
        .filter((r) => r.status !== 'cancelled')
        .sort(
          (a, b) => new Date(b.trainingDate).getTime() - new Date(a.trainingDate).getTime(),
        ),
    [records],
  );

  return (
    <Box data-testid={TESTIDS['compliance-training-tab']}>
      {/* KPI Row */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          mb: 3,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, 1fr)' },
        }}
      >
        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            今年度の研修回数
          </Typography>
          <Typography variant="h5" fontWeight={800}>
            {summary.currentFiscalYearTrainings} / 2回
          </Typography>
        </Card>
        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            平均参加率
          </Typography>
          <Typography variant="h5" fontWeight={800}>
            {summary.averageAttendanceRate}%
          </Typography>
        </Card>
        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            延べ参加人数
          </Typography>
          <Typography variant="h5" fontWeight={800}>
            {summary.totalParticipantCount}名
          </Typography>
        </Card>
        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            次回推奨日
          </Typography>
          <Typography variant="h5" fontWeight={800}>
            {summary.nextRecommendedDate ? formatDateJapanese(summary.nextRecommendedDate) : '—'}
          </Typography>
        </Card>
      </Box>

      {/* Records Table */}
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        研修履歴
      </Typography>
      {sorted.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          研修記録はまだありません
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 700 }}>研修日</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>研修名</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>種別</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>形式</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>時間</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>参加者</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>ステータス</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>{formatDateYmd(r.trainingDate)}</TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                      {r.title || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={r.trainingType} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{r.format}</Typography>
                  </TableCell>
                  <TableCell>{r.durationMinutes}分</TableCell>
                  <TableCell>
                    {r.participants.filter((p) => p.attended).length} / {r.participants.length}名
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={r.status === 'completed' ? '完了' : '予定'}
                      size="small"
                      color={r.status === 'completed' ? 'success' : 'info'}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};
