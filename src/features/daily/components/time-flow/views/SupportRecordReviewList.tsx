// ---------------------------------------------------------------------------
// SupportRecordReviewList — 記録レビュー画面
// ---------------------------------------------------------------------------

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { DailySupportRecord } from '../timeFlowTypes';

interface SupportRecordReviewListProps {
  dailyRecord: DailySupportRecord;
}

const SupportRecordReviewList: React.FC<SupportRecordReviewListProps> = ({ dailyRecord }) => {
  const recorded = dailyRecord.records.filter((record) => record.status !== '未記録');

  if (recorded.length === 0) {
    return (
      <Alert severity="info">
        まだ記録はありません。タブを「記録入力」に切り替えて記録を追加してください。
      </Alert>
    );
  }

  return (
    <Stack spacing={2}>
      {recorded.map((record) => (
        <Paper key={record.id} variant="outlined" sx={{ p: 2.5 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {record.timeSlot ?? '時間未設定'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  記録者: {record.reporter.name || '未入力'}
                </Typography>
              </Box>
              <Chip
                label={record.status}
                color={record.status === '記録済み' ? 'success' : 'default'}
                size="small"
              />
            </Stack>

            <Divider />

            <Stack spacing={1}>
              <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 600 }}>
                👤 本人の様子
              </Typography>
              {record.userCondition.mood && (
                <Chip
                  label={`気分: ${record.userCondition.mood}`}
                  color={record.userCondition.mood === '良好' ? 'success' : 'default'}
                  size="small"
                  sx={{ alignSelf: 'flex-start' }}
                />
              )}
              {record.abc?.intensity && (
                <Chip
                  label={`強度: ${record.abc.intensity}`}
                  color={record.abc.intensity === '重度' ? 'warning' : record.abc.intensity === '中度' ? 'secondary' : 'default'}
                  size="small"
                  variant="outlined"
                  sx={{ alignSelf: 'flex-start' }}
                />
              )}
              <Typography variant="body2">{record.userCondition.behavior || '行動の記録はありません。'}</Typography>
              {record.userCondition.communication && (
                <Typography variant="body2" color="text.secondary">
                  発言: {record.userCondition.communication}
                </Typography>
              )}
            </Stack>

            <Stack spacing={1}>
              <Typography variant="subtitle2" color="success.main" sx={{ fontWeight: 600 }}>
                👥 支援者の支援内容
              </Typography>
              <Typography variant="body2">
                {record.staffActivities.actual || '支援内容の記録はありません。'}
              </Typography>
            </Stack>

            {(record.specialNotes.achievements || record.specialNotes.concerns || record.specialNotes.incidents) && (
              <Stack spacing={1}>
                {record.specialNotes.achievements && (
                  <Alert severity="success" variant="outlined">
                    成果: {record.specialNotes.achievements}
                  </Alert>
                )}
                {record.specialNotes.concerns && (
                  <Alert severity="warning" variant="outlined">
                    懸念: {record.specialNotes.concerns}
                  </Alert>
                )}
                {record.specialNotes.incidents && (
                  <Alert severity="info" variant="outlined">
                    出来事: {record.specialNotes.incidents}
                  </Alert>
                )}
              </Stack>
            )}

            {record.specialNotes.nextTimeConsiderations && (
              <Typography variant="body2" color="text.secondary">
                次回に向けた配慮: {record.specialNotes.nextTimeConsiderations}
              </Typography>
            )}

            {record.abc && (
              <Stack spacing={0.5}>
                <Typography variant="subtitle2" color="text.secondary">
                  ABC記録
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  A: {record.abc.antecedent ?? '未入力'} / B: {record.abc.behavior ?? '未入力'} / C: {record.abc.consequence ?? '未入力'}
                </Typography>
              </Stack>
            )}
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
};

export default SupportRecordReviewList;
