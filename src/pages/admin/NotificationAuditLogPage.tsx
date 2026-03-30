/**
 * @fileoverview NotificationAuditLogPage — 通知監査ログ閲覧画面
 */
import React, { useState } from 'react';
import { 
  Box, 
  Container, 
  Stack, 
  Typography, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Tooltip,
  SelectChangeEvent
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useNotificationAuditViewer } from '@/features/exceptions/hooks/useNotificationAuditViewer';
import type { NotificationAuditLog, NotificationAuditStatus } from '@/features/exceptions/domain/notificationAuditTypes';
import type { EscalationLevel } from '@/features/exceptions/domain/escalationTypes';

const STATUS_CONFIG = {
  sent: { label: '送信済', color: 'success' as const, icon: null },
  failed: { label: '失敗', color: 'error' as const, icon: <ErrorOutlineIcon fontSize="small" /> },
  suppressed: { label: '抑制中', color: 'warning' as const, icon: <VisibilityOffIcon fontSize="small" /> },
  skipped: { label: 'スキップ', color: 'default' as const, icon: null }
};

export const NotificationAuditLogPage: React.FC = () => {
  const { logs, summary, filters, updateFilter, resetFilters, isLoading } = useNotificationAuditViewer();
  const [selectedLog, setSelectedLog] = useState<NotificationAuditLog | null>(null);

  if (isLoading) return <Box sx={{ p: 4 }}>読み込み中...</Box>;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack spacing={4}>
        {/* Header */}
        <Box>
          <Typography variant="h4" fontWeight={800} gutterBottom>
            📜 Notification Audit Log
          </Typography>
          <Typography variant="body1" color="text.secondary">
            通知システムの配送実績、失敗理由、および抑制状況を時系列で監査できます
          </Typography>
        </Box>

        {/* Statistics Summary */}
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' } }}>
          <StatCard title="全ログ件数" value={summary.total} color="primary" />
          <StatCard title="送信成功 (Sent)" value={summary.sentCount} color="success" />
          <StatCard title="送信失敗 (Failed)" value={summary.failedCount} color="error" />
          <StatCard title="抑制件数 (Suppressed)" value={summary.suppressedCount} color="warning" />
        </Box>

        {/* Filters */}
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>ステータス</InputLabel>
              <Select 
                value={filters.status} 
                label="ステータス" 
                onChange={(e: SelectChangeEvent) => updateFilter({ status: e.target.value as NotificationAuditStatus | 'all' })}
              >
                <MenuItem value="all">すべて</MenuItem>
                <MenuItem value="sent">送信済</MenuItem>
                <MenuItem value="failed">失敗</MenuItem>
                <MenuItem value="suppressed">抑制中</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>重要度</InputLabel>
              <Select 
                value={filters.level} 
                label="重要度" 
                onChange={(e: SelectChangeEvent) => updateFilter({ level: e.target.value as EscalationLevel | 'all' })}
              >
                <MenuItem value="all">すべて</MenuItem>
                <MenuItem value="emergency">緊急</MenuItem>
                <MenuItem value="warning">警告</MenuItem>
                <MenuItem value="alert">アラート</MenuItem>
              </Select>
            </FormControl>

            <TextField 
              label="利用者名" 
              size="small" 
              value={filters.userId || ''} 
              onChange={(e) => updateFilter({ userId: e.target.value })}
            />

            <Button onClick={resetFilters} size="small">リセット</Button>
          </Stack>
        </Paper>

        {/* Audit Table */}
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: 'background.default' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>時刻</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>ステータス</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>ロール / 対象</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>内容</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>理由 / トレース</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>詳細</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} hover>
                  <TableCell>
                    <Typography variant="body2">{new Date(log.createdAt).toLocaleTimeString()}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={STATUS_CONFIG[log.status].label} 
                      color={STATUS_CONFIG[log.status].color}
                      icon={STATUS_CONFIG[log.status].icon || undefined}
                      size="small"
                      variant="outlined"
                      sx={{ fontWeight: 700 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {log.targetRoles.join('/')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {log.userName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                      {log.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {log.channel.toUpperCase()} 配送
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Trace ID: click to copy">
                      <Chip 
                        label={log.traceId} 
                        size="small" 
                        icon={<ContentCopyIcon sx={{ fontSize: '0.8rem !important' }} />}
                        onClick={() => navigator.clipboard.writeText(log.traceId)}
                        sx={{ fontSize: '0.65rem' }}
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setSelectedLog(log)}>
                      <InfoOutlinedIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    該当する監査ログは見つかりませんでした
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>

      {/* Detail Dialog */}
      <Dialog 
        open={!!selectedLog} 
        onClose={() => setSelectedLog(null)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Audit Log Detail</DialogTitle>
        <DialogContent dividers>
          {selectedLog && (
            <Stack spacing={2}>
              <Box>
                <Typography variant="caption" color="text.secondary">Message Summary</Typography>
                <Typography variant="subtitle1" fontWeight={700}>{selectedLog.title}</Typography>
                <Typography variant="body2">{selectedLog.message}</Typography>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <InfoItem label="Trace ID" value={selectedLog.traceId} />
                <InfoItem label="Channel" value={selectedLog.channel.toUpperCase()} />
                <InfoItem label="Escalation Level" value={selectedLog.escalationLevel} />
                <InfoItem label="Target Roles" value={selectedLog.targetRoles.join(', ')} />
                <InfoItem label="Reason Codes" value={selectedLog.reasons.join(', ')} />
                {selectedLog.errorMessage && (
                  <InfoItem label="Error Message" value={selectedLog.errorMessage} color="error.main" />
                )}
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">Payload Snapshot (JSON)</Typography>
                <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'background.default', mt: 0.5 }}>
                  <pre style={{ fontSize: '0.75rem', overflow: 'auto', margin: 0 }}>
                    {JSON.stringify(selectedLog.payloadSnapshot, null, 2)}
                  </pre>
                </Paper>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedLog(null)}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

const StatCard: React.FC<{ title: string; value: number; color: string }> = ({ 
  title, value, color 
}) => (
  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderTop: 4, borderTopColor: `${color}.main` }}>
    <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
      {title}
    </Typography>
    <Typography variant="h4" fontWeight={800} sx={{ my: 1 }}>
      {value}
    </Typography>
  </Paper>
);

const InfoItem: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <Box>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="body2" fontWeight={700} sx={{ color }}>{value}</Typography>
  </Box>
);

export default NotificationAuditLogPage;
