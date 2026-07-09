import React from 'react';
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import type { ExecutionRecord } from '@/features/daily/domain/executionRecordTypes';
import { parseKioskProcedureMemo } from '../domain/kioskProcedureMemo';

type SummaryMode = 'compact' | 'full';
type SyncState = 'confirmed' | 'local-uncertain' | 'unknown';

type KioskProcedureRecordSummaryProps = {
  record?: Pick<ExecutionRecord, 'memo' | 'recordedAt'> | null;
  mode?: SummaryMode;
  syncState?: SyncState;
  testId?: string;
};

const formatRecordedAt = (value?: string): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tokyo',
  }).format(date);
};

export const KioskProcedureRecordSummary: React.FC<KioskProcedureRecordSummaryProps> = ({
  record,
  mode = 'compact',
  syncState = 'confirmed',
  testId = 'kiosk-procedure-record-summary',
}) => {
  const parsed = parseKioskProcedureMemo(record?.memo);
  const items = [
    { key: 'mood', label: '様子', value: parsed.mood },
    { key: 'action', label: '対応', value: parsed.action },
    { key: 'result', label: '変化', value: parsed.result },
    { key: 'memo', label: 'メモ', value: parsed.memo },
  ].filter((item) => item.value.trim().length > 0);
  const recordedAt = formatRecordedAt(record?.recordedAt);

  if (items.length === 0 && !(mode === 'full' && recordedAt)) {
    return null;
  }

  if (mode === 'compact') {
    return (
      <Box
        data-testid={testId}
        sx={{
          mt: 1.25,
          p: 1.25,
          borderRadius: 2,
          bgcolor: syncState === 'local-uncertain' ? 'warning.lighter' : 'background.paper',
          border: '1px solid',
          borderColor: syncState === 'local-uncertain' ? 'warning.light' : 'success.light',
        }}
      >
        <Stack spacing={0.5}>
          {items.map((item) => (
            <Typography
              key={item.key}
              variant="caption"
              color="text.secondary"
              data-testid={`${testId}-${item.key}`}
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: item.key === 'memo' ? 2 : 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                overflowWrap: 'anywhere',
              }}
            >
              <Box component="span" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                {item.label}:
              </Box>{' '}
              {item.value}
            </Typography>
          ))}
        </Stack>
      </Box>
    );
  }

  return (
    <Paper
      elevation={0}
      data-testid={testId}
      sx={{
        p: 3,
        mb: 3,
        borderRadius: 4,
        border: '1px solid',
        borderColor: 'success.light',
        bgcolor: 'success.lighter',
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" spacing={1} useFlexGap flexWrap="wrap">
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'success.dark' }}>
            保存済みの記録内容
          </Typography>
          {recordedAt && (
            <Chip
              size="small"
              variant="outlined"
              color="success"
              label={`保存日時 ${recordedAt}`}
              data-testid={`${testId}-recorded-at`}
            />
          )}
        </Stack>
        <Stack spacing={1.25}>
          {items.map((item) => (
            <Box key={item.key} data-testid={`${testId}-${item.key}`}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                {item.label}
              </Typography>
              <Typography
                variant="body1"
                color="text.primary"
                sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
              >
                {item.value}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
};
