import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    IconButton,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography
} from '@mui/material';
import { addMonths, format, parseISO, subMonths } from 'date-fns';
import { ja } from 'date-fns/locale';
import React, { useEffect } from 'react';
import { DashboardStatus, useSummaryDashboard } from './useSummaryDashboard';

const StatusIcon = ({ status }: { status: DashboardStatus }) => {
  switch (status) {
    case 'completed':
      return (
        <Tooltip title="完了">
          <CheckCircleRoundedIcon sx={{ color: 'success.main', fontSize: 18 }} />
        </Tooltip>
      );
    case 'inprogress':
      return (
        <Tooltip title="入力中">
          <EditRoundedIcon sx={{ color: 'warning.main', fontSize: 18 }} />
        </Tooltip>
      );
    case 'missing':
    default:
      return (
        <Tooltip title="未作成">
          <ErrorOutlineRoundedIcon sx={{ color: 'action.disabled', fontSize: 18 }} />
        </Tooltip>
      );
  }
};

export const SummaryDashboard: React.FC = () => {
  const {
    targetMonth,
    setTargetMonth,
    loading,
    error,
    daysInMonth,
    statusMatrix,
    loadData
  } = useSummaryDashboard();

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePrevMonth = () => {
    const prev = subMonths(parseISO(`${targetMonth}-01`), 1);
    setTargetMonth(format(prev, 'yyyy-MM'));
  };

  const handleNextMonth = () => {
    const next = addMonths(parseISO(`${targetMonth}-01`), 1);
    setTargetMonth(format(next, 'yyyy-MM'));
  };

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2, px: 1 }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            施設全体 記録実施状況
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            {format(parseISO(`${targetMonth}-01`), 'yyyy年 MMMM', { locale: ja })}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshRoundedIcon />}
            onClick={loadData}
            disabled={loading}
          >
            更新
          </Button>
          <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: 'action.hover', borderRadius: 1 }}>
            <IconButton size="small" onClick={handlePrevMonth}>
              <ChevronLeftRoundedIcon />
            </IconButton>
            <Typography variant="body2" sx={{ px: 1, fontWeight: 500, minWidth: 80, textAlign: 'center' }}>
              {targetMonth}
            </Typography>
            <IconButton size="small" onClick={handleNextMonth}>
              <ChevronRightRoundedIcon />
            </IconButton>
          </Box>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer
        component={Paper}
        sx={{
          flexGrow: 1,
          maxHeight: 'calc(100vh - 350px)',
          position: 'relative',
          boxShadow: 'none',
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        {loading && (
          <Box
            sx={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: 'rgba(255,255,255,0.7)',
              zIndex: 10
            }}
          >
            <CircularProgress size={32} />
          </Box>
        )}

        <Table stickyHeader size="small" sx={{ minWidth: 800 }}>
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  position: 'sticky',
                  top: 0,
                  left: 0,
                  zIndex: 4,
                  fontWeight: 700,
                  bgcolor: 'background.paper',
                  width: 150,
                  minWidth: 150,
                  borderRight: '1px solid',
                  borderColor: 'divider'
                }}
              >
                利用者名
              </TableCell>
              {daysInMonth.map(date => (
                <TableCell
                  key={date.toISOString()}
                  align="center"
                  sx={{
                    p: 0.5,
                    fontWeight: 600,
                    minWidth: 35,
                    color: [0, 6].includes(date.getDay()) ? 'error.main' : 'inherit'
                  }}
                >
                  {format(date, 'd')}
                  <Typography variant="caption" display="block" sx={{ fontSize: '0.65rem' }}>
                    {format(date, 'eee', { locale: ja })}
                  </Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {statusMatrix.map((row) => (
              <TableRow key={row.userId} hover>
                <TableCell
                  sx={{
                    position: 'sticky',
                    left: 0,
                    bgcolor: 'background.paper',
                    zIndex: 2,
                    fontWeight: 500,
                    borderRight: '1px solid',
                    borderColor: 'divider'
                  }}
                >
                  {row.userName}
                </TableCell>
                {daysInMonth.map(date => {
                  const day = format(date, 'd');
                  return (
                    <TableCell key={day} align="center" sx={{ p: 0.5 }}>
                      <StatusIcon status={row.statuses[day]} />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            {statusMatrix.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={daysInMonth.length + 1} align="center" sx={{ py: 4 }}>
                  データがありません
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack direction="row" spacing={3} sx={{ mt: 2, px: 1 }}>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <CheckCircleRoundedIcon sx={{ color: 'success.main', fontSize: 16 }} />
          <Typography variant="caption">完了</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <EditRoundedIcon sx={{ color: 'warning.main', fontSize: 16 }} />
          <Typography variant="caption">作成中（ドラフトあり）</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <ErrorOutlineRoundedIcon sx={{ color: 'action.disabled', fontSize: 16 }} />
          <Typography variant="caption">未作成 / 記録なし</Typography>
        </Stack>
      </Stack>
    </Box>
  );
};
