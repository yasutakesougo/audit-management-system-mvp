// ---------------------------------------------------------------------------
// PlanningSheetVersionPanel — 版管理UIパネル
//
// P2: 支援計画シートの版履歴一覧・現行版表示・改訂版作成・版切替・
//     アーカイブ・見直し期限アラートを提供する。
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ArchiveIcon from '@mui/icons-material/Archive';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditNoteIcon from '@mui/icons-material/EditNote';
import HistoryIcon from '@mui/icons-material/History';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import type { SupportPlanningSheet, PlanningSheetStatus } from '@/domain/isp/schema';
import { PLANNING_SHEET_STATUS_DISPLAY } from '@/domain/isp/schema';
import {
  computeReviewAlertLevel,
  computeVersionSummary,
  type PlanningSheetVersionSummary,
  type ReviewAlertLevel,
} from '@/domain/isp/planningSheetVersion';
import { usePlanningSheetRepositories } from '@/features/planning-sheet/hooks/usePlanningSheetRepositories';
import {
  activatePlanningSheetVersionInRepository,
  archivePlanningSheetVersionInRepository,
  createPlanningSheetRevision,
  listPlanningSheetSeries,
} from '@/features/planning-sheet/domain/planningSheetVersionWorkflow';

// ---------------------------------------------------------------------------
// Status colors
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<PlanningSheetStatus, 'success' | 'info' | 'warning' | 'default' | 'error'> = {
  active: 'success',
  draft: 'info',
  review: 'warning',
  revision_pending: 'warning',
  archived: 'default',
};

const ALERT_COLORS: Record<ReviewAlertLevel, string> = {
  good: '#2e7d32',
  warning: '#ed6c02',
  critical: '#d32f2f',
  none: '#757575',
};

const ALERT_LABELS: Record<ReviewAlertLevel, string> = {
  good: '正常',
  warning: '見直し期限接近',
  critical: '見直し期限超過',
  none: '期限未設定',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PlanningSheetVersionPanelProps {
  userId: string;
  ispId: string;
  /** データ変更後のコールバック */
  onChanged?: () => void;
}

// ---------------------------------------------------------------------------
// Revision Dialog
// ---------------------------------------------------------------------------

interface RevisionDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  submitting: boolean;
}

const RevisionDialog: React.FC<RevisionDialogProps> = ({
  open,
  onClose,
  onSubmit,
  submitting,
}) => {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>改訂版を作成</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="info">
            現行版をベースに改訂版（下書き）を作成します。
            改訂理由を記録してください。
          </Alert>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="改訂理由"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例：モニタリング結果に基づく支援方針の見直し"
            required
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">キャンセル</Button>
        <Button
          onClick={() => onSubmit(reason)}
          variant="contained"
          disabled={submitting || reason.trim().length === 0}
        >
          {submitting ? '作成中…' : '改訂版を作成'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// Main Panel
// ---------------------------------------------------------------------------

export const PlanningSheetVersionPanel: React.FC<PlanningSheetVersionPanelProps> = ({
  userId,
  ispId,
  onChanged,
}) => {
  const planningSheetRepository = usePlanningSheetRepositories();
  const [sheets, setSheets] = useState<SupportPlanningSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const versions = await listPlanningSheetSeries(
        planningSheetRepository,
        userId,
        ispId,
      );
      setSheets(versions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [ispId, planningSheetRepository, userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const summary = useMemo<PlanningSheetVersionSummary>(
    () => computeVersionSummary(sheets),
    [sheets],
  );

  const currentSheet = useMemo(
    () => sheets.find((s) => s.isCurrent && s.status === 'active') ?? null,
    [sheets],
  );

  const alertLevel = useMemo<ReviewAlertLevel>(
    () => (currentSheet ? computeReviewAlertLevel(currentSheet) : 'none'),
    [currentSheet],
  );

  // ── Actions ──

  const handleCreateRevision = async (reason: string) => {
    if (!currentSheet) return;
    try {
      setSubmitting(true);
      await createPlanningSheetRevision(planningSheetRepository, currentSheet.id, {
        changeReason: reason,
        changedBy: 'current-user',
      });
      setRevisionDialogOpen(false);
      await loadData();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '改訂版の作成に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivate = async (sheetId: string) => {
    try {
      setSubmitting(true);
      await activatePlanningSheetVersionInRepository(planningSheetRepository, sheetId, {
        activatedBy: 'current-user',
      });
      await loadData();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '版の昇格に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (sheetId: string) => {
    try {
      setSubmitting(true);
      await archivePlanningSheetVersionInRepository(planningSheetRepository, sheetId, {
        archivedBy: 'current-user',
      });
      await loadData();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'アーカイブに失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──

  if (loading) {
    return (
      <Box sx={{ py: 3 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box data-testid="planning-sheet-version-panel">
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
        <HistoryIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h6" fontWeight={700}>
          版管理
        </Typography>
        <Chip
          label={`${summary.totalVersions}版`}
          size="small"
          variant="outlined"
          sx={{ fontWeight: 700 }}
        />
        {alertLevel !== 'none' && (
          <Chip
            icon={alertLevel === 'critical' ? <WarningAmberIcon /> : undefined}
            label={ALERT_LABELS[alertLevel]}
            size="small"
            sx={{
              ml: 'auto',
              bgcolor: `${ALERT_COLORS[alertLevel]}15`,
              color: ALERT_COLORS[alertLevel],
              fontWeight: 700,
            }}
          />
        )}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* 現行版カード */}
      {currentSheet ? (
        <Card
          variant="outlined"
          sx={{
            mb: 3,
            borderLeft: `4px solid ${ALERT_COLORS[alertLevel]}`,
          }}
        >
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
              <CheckCircleIcon color="success" />
              <Typography variant="subtitle1" fontWeight={700}>
                現行版
              </Typography>
              <Chip
                label={`v${currentSheet.version}`}
                size="small"
                color="primary"
                variant="outlined"
              />
              <Chip
                label={PLANNING_SHEET_STATUS_DISPLAY[currentSheet.status]}
                size="small"
                color={STATUS_COLORS[currentSheet.status]}
              />
            </Stack>

            <Typography variant="body1" fontWeight={600} gutterBottom>
              {currentSheet.title}
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                mb: 2,
              }}
            >
              <Box>
                <Typography variant="body2" color="text.secondary">
                  適用開始日
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {currentSheet.appliedFrom ?? '—'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  次回見直し期限
                </Typography>
                <Typography
                  variant="body2"
                  fontWeight={600}
                  color={alertLevel === 'critical' ? 'error.main' : alertLevel === 'warning' ? 'warning.main' : 'text.primary'}
                >
                  {currentSheet.nextReviewAt ?? '未設定'}
                  {summary.daysUntilReview !== null && (
                    <Typography
                      component="span"
                      variant="body2"
                      sx={{ ml: 1 }}
                      color={
                        summary.daysUntilReview < 0
                          ? 'error.main'
                          : summary.daysUntilReview <= 30
                            ? 'warning.main'
                            : 'text.secondary'
                      }
                    >
                      ({summary.daysUntilReview > 0
                        ? `残り${summary.daysUntilReview}日`
                        : `${Math.abs(summary.daysUntilReview)}日超過`})
                    </Typography>
                  )}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  作成者
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {currentSheet.createdBy}
                </Typography>
              </Box>
            </Box>

            {alertLevel === 'critical' && (
              <Alert severity="error" sx={{ mb: 2 }}>
                見直し期限を超過しています。改訂版の作成を検討してください。
              </Alert>
            )}
            {alertLevel === 'warning' && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                見直し期限が30日以内に迫っています。
              </Alert>
            )}

            <Button
              variant="outlined"
              startIcon={<EditNoteIcon />}
              onClick={() => setRevisionDialogOpen(true)}
              disabled={submitting}
              size="small"
            >
              改訂版を作成
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Alert severity="info" sx={{ mb: 3 }}>
          現行版がありません。版を作成するか、既存の版を「現行版にする」で昇格してください。
        </Alert>
      )}

      <Divider sx={{ mb: 2 }} />

      {/* 版履歴テーブル */}
      <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
        <Typography variant="subtitle2" fontWeight={700}>
          バージョン履歴
        </Typography>
      </Stack>

      {sheets.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          版の履歴はまだありません
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 700 }}>版</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>タイトル</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>ステータス</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>適用開始日</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>作成日</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>作成者</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sheets.map((s) => (
                <TableRow
                  key={s.id}
                  hover
                  sx={{
                    bgcolor: s.isCurrent ? 'success.50' : undefined,
                    '&:hover': {
                      bgcolor: s.isCurrent ? 'success.100' : undefined,
                    },
                  }}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>
                      v{s.version}
                      {s.isCurrent && (
                        <Chip
                          label="現行"
                          size="small"
                          color="success"
                          sx={{ ml: 1, height: 20, fontSize: '0.65rem' }}
                        />
                      )}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                      {s.title}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={PLANNING_SHEET_STATUS_DISPLAY[s.status]}
                      size="small"
                      color={STATUS_COLORS[s.status]}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {s.appliedFrom ?? '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {s.createdAt.slice(0, 10)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{s.createdBy}</Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      {s.status !== 'active' && s.status !== 'archived' && (
                        <Tooltip title="この版を現行版にする">
                          <Button
                            size="small"
                            variant="outlined"
                            color="success"
                            onClick={() => handleActivate(s.id)}
                            disabled={submitting}
                            startIcon={<AddCircleOutlineIcon />}
                            sx={{ fontSize: '0.7rem', py: 0.25 }}
                          >
                            昇格
                          </Button>
                        </Tooltip>
                      )}
                      {s.status !== 'archived' && !s.isCurrent && (
                        <Tooltip title="この版をアーカイブ">
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => handleArchive(s.id)}
                            disabled={submitting}
                            startIcon={<ArchiveIcon />}
                            sx={{ fontSize: '0.7rem', py: 0.25 }}
                          >
                            廃止
                          </Button>
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 改訂ダイアログ */}
      <RevisionDialog
        open={revisionDialogOpen}
        onClose={() => setRevisionDialogOpen(false)}
        onSubmit={handleCreateRevision}
        submitting={submitting}
      />
    </Box>
  );
};
