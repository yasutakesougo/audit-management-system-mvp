/**
 * ProvisionDailyTable — 日次サービス提供実績一覧テーブル
 *
 * 表示専用コンポーネント。クリック副作用や保存処理は持たない。
 *
 * @module features/service-provision/components/ProvisionDailyTable
 */

import ListAltIcon from '@mui/icons-material/ListAlt';
import {
    Chip,
    CircularProgress,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import React from 'react';
import type { ServiceProvisionRecord } from '../index';
import { formatHHMM, getAddonLabels, STATUS_COLOR } from '../serviceProvisionFormHelpers';

export interface ProvisionDailyTableProps {
  records: ServiceProvisionRecord[];
  loading: boolean;
  recordDate: string;
}

export const ProvisionDailyTable: React.FC<ProvisionDailyTableProps> = React.memo(({
  records,
  loading,
  recordDate,
}) => (
  <Paper sx={{ p: 3, mt: 3 }}>
    <Typography
      variant="h6"
      sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}
      data-testid="heading-daily-list"
    >
      <ListAltIcon color="primary" />
      {recordDate} の実績一覧
      {loading && <CircularProgress size={18} sx={{ ml: 1 }} />}
    </Typography>

    {records.length === 0 && !loading ? (
      <Typography color="text.secondary" variant="body2" sx={{ py: 2, textAlign: 'center' }}>
        この日の実績はまだありません
      </Typography>
    ) : (
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>利用者</TableCell>
              <TableCell>状況</TableCell>
              <TableCell>開始</TableCell>
              <TableCell>終了</TableCell>
              <TableCell>加算</TableCell>
              <TableCell>メモ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {records.map((r) => (
              <TableRow key={r.entryKey} hover>
                <TableCell sx={{ fontWeight: 500 }}>{r.userCode}</TableCell>
                <TableCell>
                  <Chip
                    label={r.status}
                    size="small"
                    color={STATUS_COLOR[r.status] ?? 'default'}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>{formatHHMM(r.startHHMM)}</TableCell>
                <TableCell>{formatHHMM(r.endHHMM)}</TableCell>
                <TableCell>
                  {getAddonLabels(r).map((label) => (
                    <Chip key={label} label={label} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                  ))}
                </TableCell>
                <TableCell
                  sx={{
                    maxWidth: 200,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.note || '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    )}
  </Paper>
));
ProvisionDailyTable.displayName = 'ProvisionDailyTable';
