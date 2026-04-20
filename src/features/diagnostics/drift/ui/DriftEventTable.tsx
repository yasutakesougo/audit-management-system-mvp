import React, { useEffect, useState } from 'react';
import { 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
  Paper, Typography, Box, Chip, IconButton, Tooltip, CircularProgress
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HistoryIcon from '@mui/icons-material/History';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useDriftEventRepository } from '../infra/driftEventRepositoryFactory';
import type { DriftEvent, DriftType } from '../domain/driftLogic';

const renderDriftType = (type?: DriftType) => {
  switch (type) {
    case 'case_mismatch':
      return <Chip label="大文字小文字" size="small" variant="outlined" color="primary" sx={{ fontSize: '0.7rem' }} />;
    case 'suffix_mismatch':
      return <Chip label="サフィックス" size="small" variant="outlined" color="warning" sx={{ fontSize: '0.7rem' }} />;
    case 'fallback':
      return <Chip label="代替カラム" size="small" variant="outlined" color="error" sx={{ fontSize: '0.7rem' }} />;
    case 'fuzzy_match':
      return <Chip label="曖昧一致" size="small" variant="outlined" color="info" sx={{ fontSize: '0.7rem' }} />;
    default:
      return <Chip label="不明" size="small" variant="outlined" color="default" sx={{ fontSize: '0.7rem' }} />;
  }
};

/**
 * DriftEventTable — ドリフト履歴を表示・管理するテーブル
 */
export const DriftEventTable: React.FC = () => {
  const repository = useDriftEventRepository();
  const [events, setEvents] = useState<DriftEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = React.useCallback(async () => {
    setLoading(true);
    const data = await repository.getEvents();
    setEvents(data);
    setLoading(false);
  }, [repository]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleResolve = async (id: string) => {
    await repository.markResolved(id);
    fetchEvents(); // 再取得
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress size={24} sx={{ mr: 2 }} />
        <Typography>ドリフト履歴を読み込み中...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <HistoryIcon sx={{ mr: 1, color: 'text.secondary' }} />
        <Typography variant="h6" fontWeight={700}>
          SharePoint Schema Drift History
        </Typography>
      </Box>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: 'action.hover' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>検知日時</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>対象リスト</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>フィールド</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>傾向</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>解決方法</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>ステータス</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  現在記録されているドリフトイベントはありません。システムは正常です。
                </TableCell>
              </TableRow>
            ) : (
              events.map((event) => (
                <TableRow key={event.id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                  <TableCell>{new Date(event.detectedAt).toLocaleString('ja-JP')}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{event.listName}</Typography>
                  </TableCell>
                  <TableCell>
                    <code>{event.fieldName}</code>
                  </TableCell>
                  <TableCell>
                    {renderDriftType(event.driftType)}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={event.resolutionType} 
                      size="small" 
                      variant="outlined" 
                      color="info"
                      sx={{ fontSize: '0.7rem' }}
                    />
                  </TableCell>
                  <TableCell>
                    {event.resolved ? (
                      <Chip label="解消済" size="small" color="success" icon={<CheckCircleOutlineIcon />} />
                    ) : (
                      <Chip label="未解消 (Fuzzy)" size="small" color="warning" icon={<WarningAmberIcon />} />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {!event.resolved && (
                      <Tooltip title="解消済みとしてマーク">
                        <IconButton size="small" color="success" onClick={() => event.id && handleResolve(event.id)}>
                          <CheckCircleOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary">
          ※ ドリフト（内部名の不一致）は自動で吸収されていますが、将来的なスキーマ整理の対象とするため記録しています。
        </Typography>
      </Box>
    </Box>
  );
};
