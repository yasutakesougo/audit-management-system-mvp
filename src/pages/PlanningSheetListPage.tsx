/**
 * PlanningSheetListPage — 支援計画シート一覧画面
 *
 * ISP 画面から「他 N シート」チップ経由、
 * または直接 /planning-sheet-list?userId=xxx でアクセス。
 *
 * 利用者ごとの支援計画シートを一覧し、
 * 現行 / 下書き / 改訂待ち をステータスチップで区別する。
 */
import { usePlanningSheetRepositories } from '@/features/planning-sheet/hooks/usePlanningSheetRepositories';
import {
  PLANNING_SHEET_STATUS_DISPLAY,
  type PlanningSheetListItem,
  type PlanningSheetStatus,
} from '@/domain/isp/schema';
import type { PlanningSheetRepository } from '@/domain/isp/port';
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
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function statusColor(status: PlanningSheetStatus): 'default' | 'info' | 'success' | 'warning' {
  switch (status) {
    case 'draft': return 'default';
    case 'review': return 'info';
    case 'active': return 'success';
    case 'revision_pending': return 'warning';
    case 'archived': return 'default';
    default: return 'default';
  }
}

// ─────────────────────────────────────────────
// Data fetching hook (inline, page-specific)
// ─────────────────────────────────────────────

function usePlanningSheetList(userId: string | null, repo: PlanningSheetRepository | null) {
  const [sheets, setSheets] = useState<PlanningSheetListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!userId || !repo) return;
    setIsLoading(true);
    setError(null);
    try {
      const items = await repo.listCurrentByUser(userId);
      setSheets(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [userId, repo]);

  useEffect(() => { fetch(); }, [fetch]);

  return { sheets, isLoading, error };
}

// ─────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────

export default function PlanningSheetListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('userId');
  const repo = usePlanningSheetRepositories();
  const { sheets, isLoading, error } = usePlanningSheetList(userId, repo);

  if (!userId) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">利用者IDが指定されていません（?userId=xxx）</Alert>
        <Button
          startIcon={<ArrowBackRoundedIcon />}
          onClick={() => navigate('/support-plan-guide')}
          sx={{ mt: 2 }}
        >
          ISP 画面へ
        </Button>
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
            <Button
              size="small"
              startIcon={<ArrowBackRoundedIcon />}
              onClick={() => navigate('/support-plan-guide')}
            >
              ISP 画面に戻る
            </Button>
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
          <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">
              この利用者の支援計画シートはまだ作成されていません。
            </Typography>
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
                    onClick={() => navigate(`/support-planning-sheet/${sheet.id}`)}
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
                        color={statusColor(sheet.status)}
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
              label={`${sheets.filter(s => s.isCurrent).length} 件現行`}
              color="success"
            />
            <Chip
              size="small"
              variant="outlined"
              label={`${sheets.length} 件合計`}
            />
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
