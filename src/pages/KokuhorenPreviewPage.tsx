/**
 * KokuhorenPreviewPage — 国保連 月次プレビュー
 *
 * 出力可否判定 + Issue一覧 + CSV出力ボタン制御
 */
import DescriptionIcon from '@mui/icons-material/Description';
import ErrorIcon from '@mui/icons-material/Error';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import RefreshIcon from '@mui/icons-material/Refresh';
import VerifiedIcon from '@mui/icons-material/Verified';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import React, { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';

import { useKokuhorenMonthlyPreview } from '@/features/kokuhoren-preview/useKokuhorenMonthlyPreview';
import type { ValidationLevel } from '@/features/kokuhoren-validation/types';
// Imports for CSV and Official Forms are deferred to their respective PRs

// ─── ヘルパー ────────────────────────────────────────────────

const currentMonth = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const LEVEL_CONFIG: Record<ValidationLevel, {
  color: 'error' | 'warning' | 'info';
  label: string;
}> = {
  BLOCK: { color: 'error', label: 'BLOCK' },
  WARNING: { color: 'warning', label: '注意' },
  INFO: { color: 'info', label: '情報' },
};

// ─── コンポーネント ──────────────────────────────────────────

const KokuhorenPreviewPage: React.FC = () => {
  const [month, setMonth] = useState(currentMonth());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { result, lastInput, loading, error, refresh } = useKokuhorenMonthlyPreview(month);

  const hasBlock = (result?.summary.blockCount ?? 0) > 0;
  const hasWarning = (result?.summary.warningCount ?? 0) > 0;

  // ── 票面保存 Hook ──

  const handleExportClick = () => {
    if (hasWarning) {
      setConfirmOpen(true);
    } else {
      handleExport();
    }
  };

  const handleExport = () => {
    setConfirmOpen(false);

    if (!lastInput) return;

    toast('CSV生成・ダウンロード機能は別PRで提供されます', { icon: 'ℹ️' });
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 3, px: 2 }}>
      <Toaster position="top-center" />

      {/* ── ヘッダー ─────────────────────────────────── */}
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography
          variant="h5"
          component="h1"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          data-testid="heading-kokuhoren-preview"
        >
          <VerifiedIcon color="primary" />
          国保連プリバリデーション
        </Typography>
        <Typography color="text.secondary" variant="body2">
          月次の提供実績を検証し、返戻ゼロを目指します。
        </Typography>
      </Stack>

      {/* ── 月選択 + リフレッシュ ────────────────────────── */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            label="対象月"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
            data-testid="input-month"
          />
          <Button
            variant="outlined"
            startIcon={loading ? <CircularProgress size={18} /> : <RefreshIcon />}
            onClick={refresh}
            disabled={loading}
          >
            再検証
          </Button>
        </Stack>
      </Paper>

      {/* ── エラー表示 ────────────────────────────────── */}
      {!!error && (
        <Alert severity="error" sx={{ mb: 2 }} data-testid="alert-error">
          検証に失敗しました。権限・ネットワーク・リスト設定を確認してください。
        </Alert>
      )}

      {/* ── サマリー ─────────────────────────────────── */}
      {result && (
        <>
          {/* BLOCK がある場合の警告 */}
          {hasBlock && (
            <Alert
              severity="error"
              icon={<ErrorIcon />}
              sx={{ mb: 2 }}
              data-testid="alert-block"
            >
              BLOCK が {result.summary.blockCount} 件あるため CSV 出力できません。
              対象のレコードを修正してください。
            </Alert>
          )}

          {/* BLOCK なし + WARNING あり */}
          {!hasBlock && hasWarning && (
            <Alert
              severity="warning"
              icon={<WarningAmberIcon />}
              sx={{ mb: 2 }}
              data-testid="alert-warning"
            >
              注意事項が {result.summary.warningCount} 件あります。確認の上、出力できます。
            </Alert>
          )}

          {/* BLOCK も WARNING もなし */}
          {!hasBlock && !hasWarning && result.summary.totalRecords > 0 && (
            <Alert severity="success" sx={{ mb: 2 }} data-testid="alert-ok">
              問題なし — {result.summary.totalRecords} 件すべて出力可能です。
            </Alert>
          )}

          {/* サマリーチップ */}
          <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
            <Chip
              label={`BLOCK ${result.summary.blockCount}`}
              color="error"
              variant={result.summary.blockCount > 0 ? 'filled' : 'outlined'}
              size="small"
            />
            <Chip
              label={`WARNING ${result.summary.warningCount}`}
              color="warning"
              variant={result.summary.warningCount > 0 ? 'filled' : 'outlined'}
              size="small"
            />
            <Chip
              label={`INFO ${result.summary.infoCount}`}
              color="info"
              variant="outlined"
              size="small"
            />
            <Chip
              label={`全 ${result.summary.totalRecords} 件`}
              variant="outlined"
              size="small"
            />
          </Stack>

          {/* ── Issue一覧 ─────────────────────────────── */}
          {result.issues.length > 0 && (
            <Paper sx={{ mb: 3 }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width={80}>レベル</TableCell>
                      <TableCell width={100}>ルール</TableCell>
                      <TableCell width={100}>利用者</TableCell>
                      <TableCell width={110}>日付</TableCell>
                      <TableCell>内容</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.issues.map((issue, idx) => (
                      <TableRow key={`${issue.ruleId}-${issue.userCode}-${issue.targetDate ?? 'monthly'}-${idx}`} hover>
                        <TableCell>
                          <Chip
                            label={LEVEL_CONFIG[issue.level].label}
                            color={LEVEL_CONFIG[issue.level].color}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {issue.ruleId}
                        </TableCell>
                        <TableCell>{issue.userCode}</TableCell>
                        <TableCell>{issue.targetDate ?? '月次'}</TableCell>
                        <TableCell>{issue.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* レコードなし */}
          {result.summary.totalRecords === 0 && result.issues.length === 0 && (
            <Paper sx={{ p: 3, textAlign: 'center', mb: 3 }}>
              <Typography color="text.secondary">
                {month} のレコードがありません
              </Typography>
            </Paper>
          )}

          {/* Issue なし（レコードあり）*/}
          {result.summary.totalRecords > 0 && result.issues.length === 0 && (
            <Paper sx={{ p: 3, textAlign: 'center', mb: 3 }}>
              <Typography>問題は検出されませんでした。</Typography>
            </Paper>
          )}

          {/* ── アクションボタン ────────────────────────── */}
          <Stack direction="row" spacing={2} sx={{ mt: 2 }} flexWrap="wrap">
            <Button
              variant="contained"
              size="large"
              color={hasBlock ? 'error' : 'primary'}
              startIcon={<FileDownloadIcon />}
              onClick={handleExportClick}
              disabled={hasBlock || loading}
              data-testid="btn-export"
            >
              {hasBlock ? 'BLOCK あり — 出力不可' : 'CSV 出力（様式71）'}
            </Button>

            <Button
              variant="outlined"
              size="large"
              startIcon={<DescriptionIcon />}
              onClick={() => toast('票面保存機能は別PRで提供されます', { icon: 'ℹ️' })}
              disabled={true}
              data-testid="btn-save-official-forms"
            >
              票面を保存（Excel）
            </Button>
          </Stack>
        </>
      )}

      {/* ローディング */}
      {loading && !result && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <CircularProgress />
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            検証中...
          </Typography>
        </Box>
      )}

      {/* ── 確認ダイアログ ───────────────────────────── */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>⚠️ 注意事項があります</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {result?.summary.warningCount} 件の注意事項があります。
            このまま CSV を出力しますか？
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>キャンセル</Button>
          <Button onClick={handleExport} variant="contained" autoFocus>
            出力する
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default KokuhorenPreviewPage;
