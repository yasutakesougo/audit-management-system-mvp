/**
 * CommitteeTab — 委員会開催状況タブ
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
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

import type { CommitteeMeetingRecord, CommitteeSummary } from '@/domain/safety/complianceCommittee';
import { TESTIDS } from '@/testids';
import { formatDateJapanese, formatDateYmd } from '@/lib/dateFormat';

interface CommitteeTabProps {
  records: CommitteeMeetingRecord[];
  summary: CommitteeSummary;
}

export const CommitteeTab: React.FC<CommitteeTabProps> = ({ records, summary }) => {
  const sorted = useMemo(
    () =>
      [...records].sort(
        (a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime(),
      ),
    [records],
  );

  return (
    <Box data-testid={TESTIDS['compliance-committee-tab']}>
      {/* KPI Row */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          mb: 3,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
        }}
      >
        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            今年度の開催回数
          </Typography>
          <Typography variant="h5" fontWeight={800}>
            {summary.currentFiscalYearMeetings} / 4回
          </Typography>
        </Card>
        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            身体拘束検討率
          </Typography>
          <Typography variant="h5" fontWeight={800}>
            {summary.restraintDiscussionRate}%
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
        開催履歴
      </Typography>
      {sorted.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          委員会記録はまだありません
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 700 }}>開催日</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>種別</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>議題</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>拘束検討</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>参加者数</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>ステータス</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>{formatDateYmd(r.meetingDate)}</TableCell>
                  <TableCell>
                    <Chip label={r.committeeType} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                      {r.agenda || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {r.restraintDiscussed ? (
                      <CheckCircleIcon fontSize="small" color="success" />
                    ) : (
                      <CancelIcon fontSize="small" color="disabled" />
                    )}
                  </TableCell>
                  <TableCell>{r.attendees.length}名</TableCell>
                  <TableCell>
                    <Chip
                      label={r.status === 'finalized' ? '確定' : '下書き'}
                      size="small"
                      color={r.status === 'finalized' ? 'success' : 'default'}
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
