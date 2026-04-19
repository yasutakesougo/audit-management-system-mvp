
import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Chip,
  CircularProgress,
  Stack,
  IconButton,
  Tooltip
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import HistoryIcon from '@mui/icons-material/History';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import { useSP } from '@/lib/spClient';
import { HybridRemediationAuditRepository } from '@/features/sp/health/remediation/HybridRemediationAuditRepository';
import type { ISpAuditOperations } from '@/features/sp/health/remediation/SharePointRemediationAuditRepository';
import type { SpFetcher } from '@/sharepoint/spListHealthCheck';
import type { RemediationAuditEntry } from '@/features/sp/health/remediation/audit';

export const RemediationAuditHistoryPanel: React.FC = () => {
  const sp = useSP();
  const [entries, setEntries] = useState<RemediationAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    if (!sp) return;
    setLoading(true);
    try {
      const repository = new HybridRemediationAuditRepository(sp as ISpAuditOperations & { spFetch: SpFetcher });
      const data = await repository.getEntries();
      // 最新順にソートしておき、UI 表示用とする
      setEntries(data.sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
    } catch (err) {
      console.error('Failed to fetch remediation history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [sp]);

  if (!sp) return null;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <HistoryIcon color="action" />
          <Typography variant="h6">操作監査履歴</Typography>
        </Stack>
        <Tooltip title="履歴を更新">
          <IconButton onClick={fetchHistory} size="small" disabled={loading}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {loading && entries.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress size={24} />
        </Box>
      ) : entries.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          履歴はありません。
        </Typography>
      ) : (
        <TableContainer sx={{ maxHeight: 400 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: '160px' }}>日時</TableCell>
                <TableCell sx={{ width: '80px' }}>フェーズ</TableCell>
                <TableCell>判断/実行の理由・結果</TableCell>
                <TableCell sx={{ width: '140px' }}>対象</TableCell>
                <TableCell sx={{ width: '100px' }}>ID</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry, idx) => (
                <TableRow key={idx} hover>
                  <TableCell sx={{ fontSize: '0.75rem' }}>
                    {entry.timestamp.replace('T', ' ').split('.')[0]}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      size="small" 
                      label={entry.phase === 'planned' ? '計画' : '実行'} 
                      color={entry.phase === 'planned' ? 'info' : 'success'}
                      variant={entry.phase === 'planned' ? 'outlined' : 'filled'}
                      sx={{ height: 18, fontSize: '0.6rem' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 500 }}>
                      {entry.reason}
                    </Typography>
                    {entry.phase === 'executed' && entry.executionStatus && (
                      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                        {entry.executionStatus === 'success' ? (
                          <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
                        ) : (
                          <InfoIcon sx={{ fontSize: 14, color: 'error.main' }} />
                        )}
                        <Typography variant="caption" color={entry.executionStatus === 'success' ? 'success.main' : 'error.main'} sx={{ fontWeight: 'bold' }}>
                          {entry.executionStatus === 'success' ? 'SUCCESS' : `FAILED: ${JSON.stringify(entry.executionError)}`}
                        </Typography>
                      </Stack>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ display: 'block' }}>
                      {entry.listKey}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {entry.fieldName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title={entry.correlationId}>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                        {entry.planId.slice(0, 8)}...
                      </Typography>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', borderTop: '1px solid #eee', pt: 1 }}>
        ※ 監査ログは correlationId で紐付けられ、SharePoint リスト「RemediationAuditLog」に永続化されています。
      </Typography>
    </Paper>
  );
};
