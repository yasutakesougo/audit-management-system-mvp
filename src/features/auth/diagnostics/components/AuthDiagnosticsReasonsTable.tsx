import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  LinearProgress,
  Stack,
} from '@mui/material';
import HelpIcon from '@mui/icons-material/Help';
import { getRunbookLink, getReasonTitle } from '../runbook';
import type { AuthDiagnosticsSnapshot } from '../hooks/useAuthDiagnosticsSnapshot';
import type { AuthDiagnosticReason } from '../types';

interface AuthDiagnosticsReasonsTableProps {
  stats: AuthDiagnosticsSnapshot | null;
}

export default function AuthDiagnosticsReasonsTable({
  stats,
}: AuthDiagnosticsReasonsTableProps): React.ReactElement {
  const sortedReasons = stats
    ? Object.entries(stats.byReason)
        .sort(([, a], [, b]) => (b as number) - (a as number))
    : [];

  const total = stats?.total ?? 1;

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
            <TableCell sx={{ fontWeight: 'bold' }}>Reason</TableCell>
            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
              Count
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
              Percentage
            </TableCell>
            <TableCell align="center" sx={{ fontWeight: 'bold' }}>
              Runbook
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedReasons.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'textSecondary' }}>
                No diagnostic events yet
              </TableCell>
            </TableRow>
          ) : (
            sortedReasons.map(([reason, count]) => {
              const percentage = (((count as number) / total) * 100).toFixed(1);
              const runbookUrl = getRunbookLink(reason as AuthDiagnosticReason);
              const title = getReasonTitle(reason as AuthDiagnosticReason);

              return (
                <TableRow key={reason} hover>
                  <TableCell>
                    <Stack spacing={1} sx={{ width: '100%' }}>
                      <span>{title}</span>
                      <LinearProgress
                        variant="determinate"
                        value={Number(percentage)}
                        sx={{ height: 4 }}
                      />
                    </Stack>
                  </TableCell>
                  <TableCell align="right">{count}</TableCell>
                  <TableCell align="right">{percentage}%</TableCell>
                  <TableCell align="center">
                    {runbookUrl ? (
                      <Tooltip title="Open Runbook">
                        <IconButton
                          size="small"
                          href={runbookUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <HelpIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <span>-</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
