/**
 * ImportTemplateDialog — SupportTemplate CSV → ProcedureStep 取り込みダイアログ
 *
 * EditablePlanningDesignSection から開かれ、
 * 既存の支援手順テンプレート CSV をプレビュー → PlanningSheet に取り込む。
 *
 * フロー:
 *  1. CSV ファイル選択
 *  2. ユーザー選択（CSV 内に複数ユーザーがいる場合）
 *  3. プレビュー表示
 *  4. 取り込み確定 → 親の onChange コールバックへ ProcedureStep[] を渡す
 */
import type { ProcedureStep } from '@/domain/isp/schema';
import type { SupportTemplateCsvRow } from '@/features/import/domain/csvImportTypes';
import { csvRowsToProcedureSteps } from '@/features/planning-sheet/bridge/supportTemplateBridge';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Papa from 'papaparse';
import React, { useCallback, useMemo, useRef, useState } from 'react';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  /** 取り込まれた ProcedureStep[] を受け取るコールバック */
  onImport: (steps: ProcedureStep[]) => void;
  /** 既存の ProcedureSteps の件数（上書き確認用） */
  existingStepCount: number;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export const ImportTemplateDialog: React.FC<Props> = ({
  open,
  onClose,
  onImport,
  existingStepCount,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<SupportTemplateCsvRow[]>([]);
  const [userCodes, setUserCodes] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');

  // ── File handling ──
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);

    try {
      const text = await file.text();
      const parsed = Papa.parse<SupportTemplateCsvRow>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
      });

      if (parsed.data.length === 0) {
        setError('CSV にデータ行がありません');
        return;
      }

      setParsedRows(parsed.data);

      // ユーザーコード一覧を抽出
      const codes = [...new Set(parsed.data.map((r) => r.UserCode?.trim()).filter(Boolean))];
      setUserCodes(codes);
      setSelectedUser(codes[0] ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV の読み込みに失敗しました');
    }
  }, []);

  // ── Filtered rows for selected user ──
  const filteredRows = useMemo(
    () => parsedRows.filter((r) => r.UserCode?.trim() === selectedUser),
    [parsedRows, selectedUser],
  );

  // ── Preview: converted ProcedureSteps ──
  const previewSteps = useMemo(
    () => csvRowsToProcedureSteps(filteredRows),
    [filteredRows],
  );

  // ── Import handler ──
  const handleImport = useCallback(() => {
    onImport(previewSteps);
    handleReset();
    onClose();
  }, [previewSteps, onImport, onClose]);

  // ── Reset ──
  const handleReset = useCallback(() => {
    setParsedRows([]);
    setUserCodes([]);
    setSelectedUser('');
    setError(null);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { minHeight: 400 } }}
    >
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <CloudUploadRoundedIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>テンプレートから取り込み</Typography>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5}>
          {/* ── Step 1: File Select ── */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              1. SupportTemplate CSV を選択
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <Button
                variant="outlined"
                component="label"
                startIcon={<CloudUploadRoundedIcon />}
              >
                CSV を選択
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  hidden
                  onChange={handleFileSelect}
                />
              </Button>
              {fileName && (
                <Chip size="small" label={fileName} variant="outlined" onDelete={handleReset} />
              )}
            </Stack>
          </Paper>

          {error && <Alert severity="error">{error}</Alert>}

          {/* ── Step 2: User Select ── */}
          {userCodes.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                2. 利用者を選択
              </Typography>
              <Stack direction="row" spacing={2} alignItems="center">
                <TextField
                  select
                  label="利用者コード"
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  size="small"
                  sx={{ minWidth: 200 }}
                >
                  {userCodes.map((code) => (
                    <MenuItem key={code} value={code}>
                      {code}（{parsedRows.filter((r) => r.UserCode?.trim() === code).length} 手順）
                    </MenuItem>
                  ))}
                </TextField>
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${userCodes.length} 名分のデータ`}
                />
              </Stack>
            </Paper>
          )}

          {/* ── Step 3: Preview ── */}
          {previewSteps.length > 0 && (
            <>
              <Divider />
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    3. プレビュー
                  </Typography>
                  <Chip
                    size="small"
                    label={`${previewSteps.length} ステップ`}
                    color="primary"
                    variant="outlined"
                  />
                </Stack>

                {existingStepCount > 0 && (
                  <Alert severity="warning" sx={{ mb: 1.5 }}>
                    現在 {existingStepCount} 件の手順があります。取り込みにより上書きされます。
                  </Alert>
                )}

                <TableContainer sx={{ maxHeight: 300 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: 40 }}>#</TableCell>
                        <TableCell>タイミング</TableCell>
                        <TableCell>手順内容</TableCell>
                        <TableCell>支援者</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {previewSteps.map((step) => (
                        <TableRow key={step.order}>
                          <TableCell>
                            <Typography variant="caption" fontWeight={600}>{step.order}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="primary.main">{step.timing || '—'}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{step.instruction}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {step.staff || '—'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose}>キャンセル</Button>
        <Button
          variant="contained"
          disabled={previewSteps.length === 0}
          onClick={handleImport}
          startIcon={<CheckCircleOutlineIcon />}
        >
          {previewSteps.length} ステップを取り込む
        </Button>
      </DialogActions>
    </Dialog>
  );
};
