import type { IcebergAnalysisRecord, IcebergAnalysisStatus } from '@/features/analysis/domain/icebergAnalysisRecord';
import { useIcebergAnalysisList } from '@/features/analysis/hooks/useIcebergAnalysisList';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { useMemo, useState } from 'react';

type StatusFilter = 'all' | IcebergAnalysisStatus;

type Props = {
  userId: string;
  activeRecordId?: string;
  onLoad: (record: IcebergAnalysisRecord) => void;
  onDuplicate: (record: IcebergAnalysisRecord) => void;
};

const formatDate = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
};

const statusChip = (status: IcebergAnalysisStatus) => (
  <Chip
    label={status === 'Draft' ? '下書き' : '確定'}
    color={status === 'Final' ? 'success' : 'default'}
    size="small"
    variant="outlined"
    sx={{ fontSize: '0.7rem', height: 20, minWidth: 46 }}
  />
);

/**
 * Iceberg session list panel.
 *
 * Shows saved analysis sessions for a given user.
 * Supports Draft/Final filtering, loading, and duplication.
 */
const IcebergSessionList: React.FC<Props> = ({ userId, activeRecordId, onLoad, onDuplicate }) => {
  const { data: records, isLoading, error } = useIcebergAnalysisList({ userId });
  const [filter, setFilter] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return records;
    return records.filter((r) => r.status === filter);
  }, [records, filter]);

  const handleFilterChange = (_: React.MouseEvent<HTMLElement>, value: StatusFilter | null) => {
    if (value !== null) setFilter(value);
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography variant="body2" color="error" sx={{ p: 2 }}>
        セッション一覧の取得に失敗しました
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Filter bar */}
      <Box sx={{ px: 1, py: 0.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
        <FolderOpenIcon fontSize="small" color="action" />
        <Typography variant="caption" fontWeight={600} sx={{ flex: 1 }}>
          セッション ({filtered.length})
        </Typography>
        <ToggleButtonGroup
          value={filter}
          exclusive
          onChange={handleFilterChange}
          size="small"
          sx={{ '& .MuiToggleButton-root': { py: 0, px: 1, fontSize: '0.7rem' } }}
        >
          <ToggleButton value="all">全件</ToggleButton>
          <ToggleButton value="Draft">下書き</ToggleButton>
          <ToggleButton value="Final">確定</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Session list */}
      {filtered.length === 0 ? (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            保存されたセッションはありません
          </Typography>
        </Box>
      ) : (
        <List dense disablePadding sx={{ flex: 1, overflow: 'auto' }}>
          {filtered.map((record) => (
            <ListItem
              key={record.id}
              disablePadding
              secondaryAction={
                <Tooltip title="複製して新規作成">
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={(e) => { e.stopPropagation(); onDuplicate(record); }}
                    data-testid={`iceberg-session-dup-${record.id}`}
                  >
                    <ContentCopyRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              }
            >
              <ListItemButton
                selected={record.id === activeRecordId}
                onClick={() => onLoad(record)}
                sx={{ pr: 5, py: 0.5 }}
                data-testid={`iceberg-session-load-${record.id}`}
              >
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={0.5}>
                      {statusChip(record.status)}
                      <Typography variant="body2" noWrap sx={{ maxWidth: 160 }}>
                        {record.title}
                      </Typography>
                    </Box>
                  }
                  secondary={formatDate(record.updatedAt)}
                  secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

export default IcebergSessionList;
