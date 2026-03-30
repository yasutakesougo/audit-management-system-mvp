import React from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { UserSelectionGrid } from '@/features/users/components/UserSelectionGrid';
import { PLANNING_SHEET_STATUS_DISPLAY } from '@/domain/isp/schema';

import { type PlanningSheetListViewProps } from './types';

/**
 * 支援計画シート一覧画面の受動的ビュー (Passive View)。
 */
export const PlanningSheetListView: React.FC<PlanningSheetListViewProps> = ({
  viewModel,
  handlers,
}) => {
  const {
    userId,
    sheets,
    isLoading,
    error,
    allUsers,
    currentCount,
    totalCount,
  } = viewModel;

  // ---------- 利用者未選択 → グリッド表示 ----------
  if (!userId) {
    return (
      <Box sx={{ p: { xs: 2, md: 3 }, pb: 4 }}>
        <Stack spacing={3}>
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <DescriptionRoundedIcon color="primary" />
              <Typography variant="h5" fontWeight={700}>支援計画シート一覧</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              利用者を選択して、支援計画シートを表示します。
            </Typography>
          </Paper>
          <Paper elevation={1}>
            <UserSelectionGrid
              users={allUsers}
              onSelect={handlers.onUserSelect}
              title="対象利用者を選択してください"
              subtitle="支援計画シートの一覧を表示する利用者を選択します。"
            />
          </Paper>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, pb: 4 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1.5} alignItems="center">
              <DescriptionRoundedIcon color="primary" />
              <Typography variant="h5" fontWeight={700}>支援計画シート一覧</Typography>
              <Chip size="small" variant="outlined" label={`利用者: ${userId}`} />
            </Stack>
            <Stack direction="row" spacing={1}>
              {sheets.length > 0 && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<AddRoundedIcon />}
                  onClick={() => handlers.onNewSheet(userId)}
                >
                  新規作成
                </Button>
              )}
              <Button
                size="small"
                startIcon={<ArrowBackRoundedIcon />}
                onClick={handlers.onBackToIsp}
              >
                ISP 画面に戻る
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {/* Loading / Error / Empty */}
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && <Alert severity="error">{error}</Alert>}

        {!isLoading && !error && sheets.length === 0 && (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
            <Stack spacing={2} alignItems="center">
              <DescriptionRoundedIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
              <Typography color="text.secondary">
                この利用者の支援計画シートはまだ作成されていません。
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={() => handlers.onNewSheet(userId)}
              >
                新規作成
              </Button>
            </Stack>
          </Paper>
        )}

        {/* Sheet List */}
        {sheets.length > 0 && (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>タイトル</TableCell>
                  <TableCell>対象場面</TableCell>
                  <TableCell>ステータス</TableCell>
                  <TableCell>サービス</TableCell>
                  <TableCell>次回見直し</TableCell>
                  <TableCell align="right">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sheets.map((sheet) => (
                  <TableRow
                    key={sheet.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handlers.onNavigateToSheet(sheet.id)}
                  >
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" fontWeight={500}>
                          {sheet.title || '（無題）'}
                        </Typography>
                        {sheet.isCurrent && (
                          <Chip size="small" label="現行" color="success" variant="outlined" />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {sheet.targetScene || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={PLANNING_SHEET_STATUS_DISPLAY[sheet.status]}
                        color={sheet.statusColor}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{sheet.applicableServiceType}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {sheet.nextReviewAt || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="outlined">
                        開く
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Summary */}
        {sheets.length > 0 && (
          <Stack direction="row" spacing={2}>
            <Chip
              size="small"
              variant="outlined"
              label={`${currentCount} 件現行`}
              color="success"
            />
            <Chip
              size="small"
              variant="outlined"
              label={`${totalCount} 件合計`}
            />
          </Stack>
        )}
      </Stack>
    </Box>
  );
};
