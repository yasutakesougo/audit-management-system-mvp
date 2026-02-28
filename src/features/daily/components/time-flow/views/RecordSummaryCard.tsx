// ---------------------------------------------------------------------------
// RecordSummaryCard — 記録サマリー表示カード
// ---------------------------------------------------------------------------

import AssignmentIcon from '@mui/icons-material/Assignment';
import Alert from '@mui/material/Alert';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { DailySupportRecord } from '../timeFlowTypes';

interface RecordSummaryCardProps {
  record: DailySupportRecord;
  date: string;
}

const RecordSummaryCard: React.FC<RecordSummaryCardProps> = ({ record, date }) => (
  <Card sx={{ mb: 4 }} elevation={2}>
    <CardContent>
      <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
        <AssignmentIcon color="primary" />
        記録サマリー - {record.personName} ({date})
      </Typography>
      <Divider sx={{ my: 2 }} />

      <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', mb: 2 }}>
        <Chip
          label={`記録済み活動: ${record.summary.recordedTimeSlots}/${record.summary.totalTimeSlots}`}
          color="info"
        />
        <Chip
          label={`成果のあった活動: ${record.summary.achievementHighlights}`}
          color="success"
        />
        <Chip
          label={`全体的な進捗: ${record.summary.overallProgress}`}
          color={
            record.summary.overallProgress === '良好'
              ? 'success'
              : record.summary.overallProgress === '順調'
                ? 'info'
                : 'warning'
          }
        />
        <Chip
          label={`記録状態: ${record.status}`}
          color={record.status === '完了' ? 'success' : record.status === '作成中' ? 'info' : 'default'}
        />
      </Stack>

      {record.completedAt && (
        <Typography variant="caption" color="text.secondary">
          最終更新: {new Date(record.completedAt).toLocaleString('ja-JP')}
        </Typography>
      )}

      {record.dailyNotes && (
        <Alert severity="info" sx={{ mt: 2 }}>
          <strong>日次コメント:</strong> {record.dailyNotes}
        </Alert>
      )}
    </CardContent>
  </Card>
);

export default RecordSummaryCard;
