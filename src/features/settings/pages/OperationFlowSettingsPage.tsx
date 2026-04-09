/**
 * OperationFlowSettingsPage — 1日の流れ設定画面
 *
 * 目的:
 *   - 9フェーズの業務時間を管理者が確認・編集できる
 *   - 現在時刻でのプレビュー表示
 *   - Repository 経由で保存/リセット
 *
 * 設計方針:
 *   - MUI Card + Table 形式
 *   - 時刻入力は TextField type="time"
 *   - ローカル state で編集し、保存時に Repository.saveAll()
 */

import RestoreIcon from '@mui/icons-material/Restore';
import SaveIcon from '@mui/icons-material/Save';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { createOperationalPhaseRepository } from '@/features/operationFlow/data/createOperationalPhaseRepository';
import { getCurrentPhaseFromConfig } from '@/features/operationFlow/domain/getCurrentPhaseFromConfig';
import type {
  OperationFlowPhaseConfig,
  PrimaryScreen,
} from '@/features/operationFlow/domain/operationFlowTypes';

// ────────────────────────────────────────
// 定数
// ────────────────────────────────────────

/** 主役画面の選択肢 */
const PRIMARY_SCREEN_OPTIONS: { value: PrimaryScreen; label: string }[] = [
  { value: '/today', label: '/today — 今日の運営' },
  { value: '/handoff-timeline', label: '/handoff — 申し送り' },
  { value: '/daily', label: '/daily — 日々の記録' },
  { value: '/daily/attendance', label: '/daily/attendance — 出欠' },
  { value: '/dashboard', label: '/dashboard — ダッシュボード' },
];

// ────────────────────────────────────────
// コンポーネント
// ────────────────────────────────────────

const OperationFlowSettingsPage: React.FC = () => {
  const repo = useMemo(() => createOperationalPhaseRepository(), []);

  // ── State ──
  const [phases, setPhases] = useState<OperationFlowPhaseConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [now, setNow] = useState(() => new Date());

  // ── 初回ロード ──
  useEffect(() => {
    let cancelled = false;
    repo.getAll().then((data) => {
      if (!cancelled) {
        setPhases(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [repo]);

  // ── 1分ごとに現在時刻を更新 ──
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // ── 現在フェーズプレビュー ──
  const currentPhaseKey = useMemo(
    () => getCurrentPhaseFromConfig(now, phases),
    [now, phases],
  );
  const currentPhaseConfig = useMemo(
    () => phases.find((p) => p.phaseKey === currentPhaseKey),
    [phases, currentPhaseKey],
  );

  // ── フィールド変更ハンドラ ──
  const handleFieldChange = useCallback(
    (index: number, field: keyof OperationFlowPhaseConfig, value: string) => {
      setPhases((prev) =>
        prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
      );
    },
    [],
  );

  // ── 保存 ──
  const handleSave = useCallback(async () => {
    await repo.saveAll(phases);
    setSnackbar({ open: true, message: '設定を保存しました', severity: 'success' });
  }, [repo, phases]);

  // ── 初期値に戻す ──
  const handleReset = useCallback(async () => {
    const defaults = await repo.resetToDefault();
    setPhases(defaults);
    setSnackbar({ open: true, message: '初期値に戻しました', severity: 'info' });
  }, [repo]);

  // ── Snackbar 閉じ ──
  const handleSnackbarClose = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Typography>読込中...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }} data-testid="operation-flow-settings-page">
      {/* ── ヘッダー ── */}
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
        🕐 1日の流れ設定
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        朝会・通所受入・活動・記録仕上げなど、1日の業務時間を設定します
      </Typography>

      {/* ── 現在フェーズプレビュー ── */}
      <Card variant="outlined" sx={{ mb: 3 }} data-testid="phase-preview-card">
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            📍 現在のフェーズ（プレビュー）
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <Chip
              label={currentPhaseConfig?.label ?? '該当なし'}
              color="primary"
              variant="filled"
              data-testid="current-phase-chip"
            />
            <Typography variant="body2" color="text.secondary" data-testid="current-primary-screen">
              主役画面: {currentPhaseConfig?.primaryScreen ?? '—'}
            </Typography>
            <Typography variant="body2" color="text.secondary" data-testid="current-time-display">
              現在時刻: {now.getHours().toString().padStart(2, '0')}:{now.getMinutes().toString().padStart(2, '0')}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* ── フェーズ一覧テーブル ── */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <TableContainer>
          <Table size="small" data-testid="phase-config-table">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>フェーズ名</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 140 }}>開始</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 140 }}>終了</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 260 }}>主役画面</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 80, textAlign: 'center' }}>プレビュー</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {phases.map((phase, index) => {
                const isCurrentPhase = phase.phaseKey === currentPhaseKey;
                return (
                  <TableRow
                    key={phase.phaseKey}
                    data-testid={`phase-row-${phase.phaseKey}`}
                    sx={isCurrentPhase ? { bgcolor: 'primary.50' } : undefined}
                  >
                    {/* フェーズ名 */}
                    <TableCell>
                      <Typography variant="body2" fontWeight={isCurrentPhase ? 700 : 400}>
                        {phase.label}
                      </Typography>
                    </TableCell>

                    {/* 開始時刻 */}
                    <TableCell>
                      <TextField
                        type="time"
                        size="small"
                        value={phase.startTime}
                        onChange={(e) => handleFieldChange(index, 'startTime', e.target.value)}
                        inputProps={{
                          'data-testid': `start-time-${phase.phaseKey}`,
                          step: 300, // 5分刻み
                        }}
                        sx={{ width: 120 }}
                      />
                    </TableCell>

                    {/* 終了時刻 */}
                    <TableCell>
                      <TextField
                        type="time"
                        size="small"
                        value={phase.endTime}
                        onChange={(e) => handleFieldChange(index, 'endTime', e.target.value)}
                        inputProps={{
                          'data-testid': `end-time-${phase.phaseKey}`,
                          step: 300,
                        }}
                        sx={{ width: 120 }}
                      />
                    </TableCell>

                    {/* 主役画面 */}
                    <TableCell>
                      <TextField
                        select
                        size="small"
                        value={phase.primaryScreen}
                        onChange={(e) => handleFieldChange(index, 'primaryScreen', e.target.value)}
                        inputProps={{
                          'data-testid': `primary-screen-${phase.phaseKey}`,
                        }}
                        sx={{ width: 240 }}
                      >
                        {PRIMARY_SCREEN_OPTIONS.map((opt) => (
                          <MenuItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>

                    {/* プレビュー（現在フェーズ表示） */}
                    <TableCell sx={{ textAlign: 'center' }}>
                      {isCurrentPhase && (
                        <Chip
                          label="現在"
                          size="small"
                          color="primary"
                          data-testid={`current-indicator-${phase.phaseKey}`}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* ── アクションボタン ── */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<RestoreIcon />}
          onClick={handleReset}
          data-testid="reset-button"
        >
          初期値に戻す
        </Button>
        <Button
          variant="contained"
          color="primary"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          data-testid="save-button"
        >
          保存
        </Button>
      </Box>

      {/* ── Snackbar ── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={handleSnackbarClose} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default OperationFlowSettingsPage;
