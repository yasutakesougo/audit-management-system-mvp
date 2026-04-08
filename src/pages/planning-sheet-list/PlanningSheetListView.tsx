import React from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
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
import { alpha } from '@mui/material/styles';
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
    isIcebergTarget,
    isIcebergEnabled,
    icebergSummary,
    differenceInsight,
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
              {userId && isIcebergEnabled && isIcebergTarget && (
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  startIcon={<InsightsRoundedIcon />}
                  onClick={() => handlers.onOpenIceberg(userId)}
                >
                  氷山分析を開く
                </Button>
              )}
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
        
        {/* Iceberg Summary Bar (Only if summary exists) */}
        {isIcebergEnabled && icebergSummary && (
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 2, 
              bgcolor: alpha('#ed6c02', 0.04), 
              borderColor: alpha('#ed6c02', 0.2),
              borderRadius: 2
            }}
          >
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="center">
              <Stack direction="row" spacing={1} alignItems="center">
                <InsightsRoundedIcon color="warning" fontSize="small" />
                <Typography variant="subtitle2" fontWeight={700} color="warning.dark">
                  最新の氷山分析要約
                </Typography>
              </Stack>
              <Stack direction="row" spacing={2} sx={{ flex: 1 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">分析日</Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {new Date(icebergSummary.updatedAt).toLocaleDateString()}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">主要対象行動</Typography>
                  <Typography variant="body2" fontWeight={500}>{icebergSummary.primaryBehavior}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">主要な要因/背景</Typography>
                  <Typography variant="body2" fontWeight={500}>{icebergSummary.primaryFactor}</Typography>
                </Box>
              </Stack>
              <Button 
                size="small" 
                variant="text" 
                color="warning" 
                onClick={() => handlers.onOpenIceberg(userId!)}
                sx={{ fontWeight: 600 }}
              >
                詳細を見る
              </Button>
              {(() => {
                const currentSheet = sheets.find(s => s.isCurrent);
                if (currentSheet) {
                  return (
                    <Button 
                      size="small" 
                      variant="contained" 
                      color="warning" 
                      onClick={() => handlers.onReviseFromIceberg(userId!, currentSheet.id)}
                      sx={{ fontWeight: 700, px: 2 }}
                    >
                      この分析に基づき改定
                    </Button>
                  );
                }
                return null;
              })()}
            </Stack>
          </Paper>
        )}

        {/* Difference Insight Bar (Only if changes exist) */}
        {isIcebergEnabled && differenceInsight && differenceInsight.changes.length > 0 && (
          <Box sx={{ px: 1 }}>
            <Paper 
              variant="outlined" 
              sx={{ 
                p: 1.5, 
                borderLeft: '4px solid #d32f2f',
                bgcolor: alpha('#d32f2f', 0.02),
                borderRadius: '0 8px 8px 0'
              }}
            >
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" fontWeight={700} color="error.main" sx={{ letterSpacing: 1 }}>
                    前回計画からの重要な変化 (DIFFERENCE INSIGHT)
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap', gap: 2 }}>
                  {differenceInsight.changes.map((change, idx) => (
                    <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Chip 
                        label={change.label} 
                        size="small" 
                        color={change.level === 'high' ? 'error' : change.level === 'medium' ? 'warning' : 'default'}
                        variant="outlined" 
                        sx={{ height: 20, fontSize: '0.65rem' }} 
                      />
                      <Typography 
                        variant="body2" 
                        fontWeight={600} 
                        color={change.level === 'high' ? 'error.main' : change.level === 'medium' ? 'warning.main' : 'text.primary'}
                      >
                        {change.value}
                      </Typography>
                    </Box>
                  ))}
                  <Box sx={{ flex: 1 }} />
                  <Typography variant="caption" color="text.disabled">
                    Evidence Session: {differenceInsight.sourceSessionId.substring(0, 8)}...
                  </Typography>
                </Stack>
              </Stack>
            </Paper>
          </Box>
        )}

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
              <Stack direction="row" spacing={2}>
                {isIcebergEnabled && isIcebergTarget && (
                  <Button
                    variant="contained"
                    color="warning"
                    startIcon={<AutoAwesomeRoundedIcon />}
                    onClick={() => handlers.onCreateFromIceberg(userId)}
                    sx={{ boxShadow: 3 }}
                  >
                    氷山分析から新規作成
                  </Button>
                )}
                <Button
                  variant={isIcebergTarget ? "outlined" : "contained"}
                  startIcon={<AddRoundedIcon />}
                  onClick={() => handlers.onNewSheet(userId)}
                >
                  新規作成
                </Button>
              </Stack>
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
                          <Chip 
                            size="small" 
                            label="現行運用中" 
                            color="success" 
                            variant="filled" 
                            icon={<CheckCircleRoundedIcon />}
                            sx={{ fontWeight: 'bold' }}
                          />
                        )}
                        {sheet.status === 'revision_pending' && (
                          <Chip size="small" label="改訂待ち" color="warning" variant="outlined" />
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
