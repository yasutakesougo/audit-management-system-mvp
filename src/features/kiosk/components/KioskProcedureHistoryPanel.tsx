import React, { useState, useMemo } from 'react';
import { 
  Box, 
  Typography, 
  IconButton, 
  Paper, 
  Stack, 
  Chip, 
  Divider, 
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  List,
  ListItem,
  ListItemText,
  Grid,
  Button
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History';
import { useHistoricalRecords } from '@/features/daily/hooks/useHistoricalRecords';
import { formatDateShort } from '@/lib/dateFormat';
import type { ExecutionRecord } from '@/features/daily/domain/legacy/executionRecordTypes';
import { KioskDailyProcedureFlowPreview } from './KioskDailyProcedureFlowPreview';
import { parseKioskProcedureMemo } from '../domain/kioskProcedureMemo';
import { toLocalDateISO } from '@/utils/getNow';

interface KioskProcedureHistoryPanelProps {
  userId: string;
  fallbackUserIds?: string[];
  scheduleItemId: string;
  fallbackScheduleItemIds?: string[];
  userName: string;
  procedureName: string;
  onClose: () => void;
}

type ViewMode = 'daily' | '7d' | '1m' | '3m';

export const KioskProcedureHistoryPanel: React.FC<KioskProcedureHistoryPanelProps> = ({
  userId,
  fallbackUserIds = [],
  scheduleItemId,
  fallbackScheduleItemIds = [],
  userName,
  procedureName,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [selectedFlowDate, setSelectedFlowDate] = useState<string | null>(null);
  const { records, isLoading, error, refresh, isCached, lastFetchedAt } = useHistoricalRecords(
    userId,
    scheduleItemId,
    fallbackScheduleItemIds,
    fallbackUserIds,
  );

  const selectedFlowRecords = useMemo(() => {
    if (!selectedFlowDate) return [];
    return records.filter((record) => String(record.date ?? '').slice(0, 10) === selectedFlowDate);
  }, [records, selectedFlowDate]);

  const handleViewChange = (
    _event: React.MouseEvent<HTMLElement>,
    nextView: ViewMode | null,
  ) => {
    if (nextView !== null) {
      setViewMode(nextView);
    }
  };

  const stats = useMemo(() => {
    if (!records.length) return null;

    const filterByDays = (days: number) => {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - days);
      const thresholdStr = toLocalDateISO(targetDate);
      return records.filter(r => {
        const recordDateStr = String(r.date ?? '').slice(0, 10);
        return recordDateStr >= thresholdStr;
      });
    };

    const calculateStats = (filteredRecords: ExecutionRecord[]) => {
      const total = filteredRecords.length;
      if (total === 0) return null;
      const completed = filteredRecords.filter(r => r.status === 'completed').length;
      const triggered = filteredRecords.filter(r => r.status === 'triggered').length;
      const rate = ((completed + triggered) / total) * 100;
      
      // Mood distribution
      const moods: Record<string, number> = {};
      filteredRecords.forEach(r => {
        const { mood } = parseKioskProcedureMemo(r.memo);
        if (mood) {
          moods[mood] = (moods[mood] || 0) + 1;
        }
      });

      return { total, completed, triggered, rate, moods };
    };

    return {
      '7d': calculateStats(filterByDays(7)),
      '1m': calculateStats(filterByDays(30)),
      '3m': calculateStats(filterByDays(90)),
    };
  }, [records]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (error && !records.length) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="error" sx={{ mb: 2 }}>履歴の読み込みに失敗しました</Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => refresh({ force: true })}
            sx={{ borderRadius: 2, fontWeight: 'bold' }}
          >
            再読み込み
          </Button>
        </Box>
      );
    }

    if (!records.length) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">過去の記録はありません</Typography>
        </Box>
      );
    }

    if (viewMode === 'daily') {
      return (
        <List sx={{ px: 2 }}>
          {records.map((record) => (
            <React.Fragment key={record.id}>
              <ListItem alignItems="flex-start" sx={{ px: 0, py: 2 }}>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                          {formatDateShort(record.date)}
                        </Typography>
                        <Chip 
                          size="small" 
                          label={record.status === 'completed' ? '実施' : record.status === 'triggered' ? '行動発生' : 'その他'} 
                          color={record.status === 'completed' ? 'success' : record.status === 'triggered' ? 'warning' : 'default'}
                          variant="outlined"
                        />
                      </Stack>
                    </Stack>
                  }
                  secondaryTypographyProps={{ component: 'div' }}
                  secondary={
                    <Stack spacing={1.5} sx={{ mt: 1 }}>
                      <Typography variant="body2" color="text.primary" sx={{ whiteSpace: 'pre-wrap' }}>
                        {record.memo || '（メモなし）'}
                      </Typography>
                      <Button
                        fullWidth
                        variant="outlined"
                        size="medium"
                        onClick={() => setSelectedFlowDate(record.date)}
                        sx={{ 
                          borderRadius: 2, 
                          fontWeight: 'bold', 
                          py: 0.75,
                          borderColor: 'primary.light',
                          '&:hover': {
                            bgcolor: 'action.hover',
                            borderColor: 'primary.main',
                          }
                        }}
                      >
                        この日の流れ（1日全体のプレビュー）を見る
                      </Button>
                    </Stack>
                  }
                />
              </ListItem>
              <Divider component="li" />
            </React.Fragment>
          ))}
        </List>
      );
    }

    const currentStats = stats ? stats[viewMode as '7d' | '1m' | '3m'] : null;

    if (!currentStats) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">この期間の記録はありません</Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 6 }}>
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 4, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary">実施率</Typography>
              <Typography variant="h3" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                {Math.round(currentStats.rate)}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {currentStats.completed + currentStats.triggered} / {currentStats.total} 回
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 4, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary">行動発生</Typography>
              <Typography variant="h3" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                {currentStats.triggered}回
              </Typography>
              <Typography variant="caption" color="text.secondary">
                対象期間中
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>様子の分布</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {Object.entries(currentStats.moods).map(([mood, count]) => (
                <Chip 
                  key={mood} 
                  label={`${mood} (${count})`} 
                  variant="outlined" 
                  sx={{ borderRadius: 2 }}
                />
              ))}
              {Object.keys(currentStats.moods).length === 0 && (
                <Typography variant="body2" color="text.secondary">様子の記録がありません</Typography>
              )}
            </Stack>
          </Grid>
        </Grid>
      </Box>
    );
  };

  if (selectedFlowDate) {
    return (
      <KioskDailyProcedureFlowPreview
        userId={userId}
        userName={userName}
        recordDate={selectedFlowDate}
        seedRecords={selectedFlowRecords}
        onClose={onClose}
        onBack={() => setSelectedFlowDate(null)}
      />
    );
  }

  return (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      bgcolor: 'background.paper',
      width: { xs: '100%', md: 450 }
    }}>
      {/* ヘッダー */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <HistoryIcon color="primary" />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>履歴・傾向</Typography>
            <Typography variant="caption" color="text.secondary">{userName} 様 - {procedureName}</Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* ビュー切り替え */}
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={handleViewChange}
          aria-label="view mode"
          size="small"
          fullWidth
        >
          <ToggleButton value="daily">日別</ToggleButton>
          <ToggleButton value="7d">7日間</ToggleButton>
          <ToggleButton value="1m">1ヶ月</ToggleButton>
          <ToggleButton value="3m">3ヶ月</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* ステータスバナー (キャッシュ表示中、または取得エラー時のフォールバック表示) */}
      {error && records.length > 0 && (
        <Box sx={{ px: 2, py: 1, bgcolor: 'error.light', color: 'error.contrastText', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
            最新履歴の取得に失敗しました。前回取得分を表示しています。
          </Typography>
          <Button
            size="small"
            color="inherit"
            onClick={() => refresh({ force: true })}
            sx={{ py: 0, fontWeight: 'bold', textDecoration: 'underline' }}
          >
            再試行
          </Button>
        </Box>
      )}

      {!error && isCached && lastFetchedAt && (
        <Box sx={{ px: 2, py: 0.75, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary">
            前回取得分を表示中 ({new Date(lastFetchedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 取得)
          </Typography>
          <Button
            size="small"
            color="primary"
            onClick={() => refresh({ force: true })}
            sx={{ py: 0, minWidth: 'auto', fontWeight: 'bold' }}
          >
            更新
          </Button>
        </Box>
      )}

      {/* コンテンツエリア */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
        {renderContent()}
      </Box>
    </Box>
  );
};
