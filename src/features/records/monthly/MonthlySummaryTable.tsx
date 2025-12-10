import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningIcon from '@mui/icons-material/Warning';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React from 'react';
import { TESTIDS } from '../../../testids';
import { getCurrentYearMonth } from './map';
import type { MonthlyRecordSort, MonthlyRecordSortKey, MonthlySummary, YearMonth } from './types';

interface MonthlySummaryTableProps {
  summaries: MonthlySummary[];
  loading?: boolean;
  onReaggregate?: (userId: string, yearMonth: YearMonth) => Promise<void>;
  onUserSelect?: (userId: string, yearMonth: YearMonth) => void;
}

export const MonthlySummaryTable: React.FC<MonthlySummaryTableProps> = ({
  summaries,
  loading = false,
  onReaggregate,
  onUserSelect,
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedMonth, setSelectedMonth] = React.useState<YearMonth>(getCurrentYearMonth());
  const [completionRateFilter, setCompletionRateFilter] = React.useState<string>('all');
  const [sort, setSort] = React.useState<MonthlyRecordSort>({
    key: 'completionRate',
    direction: 'desc',
  });
  const [reaggregatingUsers, setReaggregatingUsers] = React.useState<Set<string>>(new Set());
  const [statusMessage, setStatusMessage] = React.useState('');

  // フィルタリング
  const filteredSummaries = React.useMemo(() => {
    return summaries.filter((summary) => {
      // 検索クエリ
      const matchesSearch =
        summary.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        summary.userId.toLowerCase().includes(searchQuery.toLowerCase());

      // 月フィルタ
      const matchesMonth = !selectedMonth || summary.yearMonth === selectedMonth;

      // 完了率フィルタ
      let matchesCompletionRate = true;
      if (completionRateFilter === 'high') {
        matchesCompletionRate = summary.completionRate >= 90;
      } else if (completionRateFilter === 'medium') {
        matchesCompletionRate = summary.completionRate >= 70 && summary.completionRate < 90;
      } else if (completionRateFilter === 'low') {
        matchesCompletionRate = summary.completionRate < 70;
      }

      return matchesSearch && matchesMonth && matchesCompletionRate;
    });
  }, [summaries, searchQuery, selectedMonth, completionRateFilter]);

  // ソート
  const sortedSummaries = React.useMemo(() => {
    return [...filteredSummaries].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sort.key) {
        case 'displayName':
          aValue = a.displayName;
          bValue = b.displayName;
          break;
        case 'yearMonth':
          aValue = a.yearMonth;
          bValue = b.yearMonth;
          break;
        case 'completionRate':
          aValue = a.completionRate;
          bValue = b.completionRate;
          break;
        case 'completedRows':
          aValue = a.kpi.completedRows;
          bValue = b.kpi.completedRows;
          break;
        case 'lastUpdatedUtc':
          aValue = new Date(a.lastUpdatedUtc).getTime();
          bValue = new Date(b.lastUpdatedUtc).getTime();
          break;
        default:
          aValue = a.displayName;
          bValue = b.displayName;
      }

      if (aValue < bValue) {
        return sort.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sort.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [filteredSummaries, sort]);

  const handleSort = (key: MonthlyRecordSortKey) => {
    setSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleReaggregate = async (userId: string, yearMonth: YearMonth) => {
    if (!onReaggregate) return;

    setReaggregatingUsers((prev) => new Set(prev).add(`${userId}#${yearMonth}`));

    try {
      await onReaggregate(userId, yearMonth);

      const summary = summaries.find(s => s.userId === userId && s.yearMonth === yearMonth);
      setStatusMessage(`再集計完了: ${summary?.displayName || userId} ${yearMonth}`);
    } catch (error) {
      console.error('再集計エラー:', error);
      setStatusMessage('再集計エラーが発生しました');
    } finally {
      setReaggregatingUsers((prev) => {
        const next = new Set(prev);
        next.delete(`${userId}#${yearMonth}`);
        return next;
      });
    }
  };

  const getCompletionRateColor = (rate: number): 'success' | 'warning' | 'error' => {
    if (rate >= 90) return 'success';
    if (rate >= 70) return 'warning';
    return 'error';
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Box data-testid={TESTIDS['monthly-summary-table']}>
      {/* ステータスアナウンス（A11y） */}
      <Box
        component="div"
        role="status"
        aria-live="polite"
        data-testid={TESTIDS['monthly-summary-status']}
        sx={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px' }}
      >
        {statusMessage}
      </Box>

      {/* フィルタ・検索 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            月次記録フィルタ
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              size="small"
              placeholder="利用者名またはIDで検索"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid={TESTIDS['monthly-summary-search']}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
              sx={{ minWidth: 200 }}
            />

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>対象月</InputLabel>
              <Select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value as YearMonth)}
                label="対象月"
                data-testid={TESTIDS['monthly-summary-month-select']}
              >
                <MenuItem value="">すべての月</MenuItem>
                <MenuItem value="2025-11">2025年11月</MenuItem>
                <MenuItem value="2025-10">2025年10月</MenuItem>
                <MenuItem value="2025-09">2025年9月</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>完了率</InputLabel>
              <Select
                value={completionRateFilter}
                onChange={(e) => setCompletionRateFilter(e.target.value)}
                label="完了率"
                data-testid={TESTIDS['monthly-summary-rate-filter']}
              >
                <MenuItem value="all">すべて</MenuItem>
                <MenuItem value="high">90%以上</MenuItem>
                <MenuItem value="medium">70-89%</MenuItem>
                <MenuItem value="low">70%未満</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              onClick={() => {
                setSearchQuery('');
                setSelectedMonth(getCurrentYearMonth());
                setCompletionRateFilter('all');
              }}
            >
              クリア
            </Button>

            <Button
              variant="contained"
              color="primary"
              startIcon={<RefreshIcon />}
              onClick={async () => {
                if (onReaggregate) {
                  // 表示中の全利用者を再集計
                  for (const summary of sortedSummaries) {
                    await handleReaggregate(summary.userId, summary.yearMonth);
                  }
                }
              }}
              data-testid={TESTIDS['monthly-summary-reaggregate-btn']}
            >
              全体再集計
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* 統計サマリー */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }}>
          <Typography variant="h6" color="primary">
            {sortedSummaries.length}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            対象利用者
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }}>
          <Typography variant="h6" color="success.main">
            {sortedSummaries.filter(s => s.completionRate >= 90).length}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            高完了率 (90%+)
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }}>
          <Typography variant="h6" color="warning.main">
            {sortedSummaries.filter(s => s.completionRate >= 70 && s.completionRate < 90).length}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            中完了率 (70-89%)
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }}>
          <Typography variant="h6" color="error.main">
            {sortedSummaries.filter(s => s.completionRate < 70).length}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            低完了率 (&lt;70%)
          </Typography>
        </Paper>
      </Stack>

      {/* テーブル */}
      <TableContainer component={Paper} data-testid="monthly-summary-table-container">
        {loading && <LinearProgress />}

        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={sort.key === 'displayName'}
                  direction={sort.direction}
                  onClick={() => handleSort('displayName')}
                >
                  利用者名
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sort.key === 'yearMonth'}
                  direction={sort.direction}
                  onClick={() => handleSort('yearMonth')}
                >
                  対象月
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={sort.key === 'completionRate'}
                  direction={sort.direction}
                  onClick={() => handleSort('completionRate')}
                >
                  完了率
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">完了</TableCell>
              <TableCell align="right">進行中</TableCell>
              <TableCell align="right">未入力</TableCell>
              <TableCell align="center">特記事項</TableCell>
              <TableCell>
                <TableSortLabel
                  active={sort.key === 'lastUpdatedUtc'}
                  direction={sort.direction}
                  onClick={() => handleSort('lastUpdatedUtc')}
                >
                  最終更新
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">アクション</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedSummaries.map((summary) => {
              const isReaggregating = reaggregatingUsers.has(`${summary.userId}#${summary.yearMonth}`);

              return (
                <TableRow
                  key={`${summary.userId}#${summary.yearMonth}`}
                  data-testid={`monthly-summary-row-${summary.userId}-${summary.yearMonth}`}
                >
                  <TableCell>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                        {summary.displayName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ID: {summary.userId}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{summary.yearMonth}</TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                      <Chip
                        label={`${summary.completionRate}%`}
                        color={getCompletionRateColor(summary.completionRate)}
                        size="small"
                        icon={summary.completionRate >= 90 ? <TrendingUpIcon /> : <WarningIcon />}
                      />
                    </Box>
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                    {summary.kpi.completedRows}
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'warning.main' }}>
                    {summary.kpi.inProgressRows}
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'text.secondary' }}>
                    {summary.kpi.emptyRows}
                  </TableCell>
                  <TableCell align="center">
                    {summary.kpi.specialNotes > 0 && (
                      <Chip
                        label={summary.kpi.specialNotes}
                        size="small"
                        color="info"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {formatDate(summary.lastUpdatedUtc)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1}>
                      {onReaggregate && (
                        <Tooltip title="この月を再集計">
                          <IconButton
                            size="small"
                            onClick={() => handleReaggregate(summary.userId, summary.yearMonth)}
                            disabled={isReaggregating}
                            data-testid={`monthly-reaggregate-btn-${summary.userId}-${summary.yearMonth}`}
                          >
                            <RefreshIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {onUserSelect && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => onUserSelect(summary.userId, summary.yearMonth)}
                          data-testid={`monthly-detail-btn-${summary.userId}-${summary.yearMonth}`}
                        >
                          詳細
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {sortedSummaries.length === 0 && !loading && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              条件に一致する月次記録がありません
            </Typography>
          </Box>
        )}
      </TableContainer>
    </Box>
  );
};