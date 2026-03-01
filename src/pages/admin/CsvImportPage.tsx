// ---------------------------------------------------------------------------
// CsvImportPage — CSVインポート管理画面
//
// 管理者がSupportTemplate / CarePoints CSVをアップロードし、
// プレビュー確認後にストアに保存する3ステップUI。
// ---------------------------------------------------------------------------
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import LinkIcon from '@mui/icons-material/Link';
import SaveIcon from '@mui/icons-material/Save';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ChangeEvent } from 'react';
import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { useCSVImport } from '@/features/import/hooks/useCSVImport';

export default function CsvImportPage() {
  const navigate = useNavigate();
  const {
    status,
    preview,
    error,
    selectFile,
    generatePreview,
    saveToStores,
    reset,
  } = useCSVImport();

  const supportInputRef = useRef<HTMLInputElement>(null);
  const careInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (type: 'support' | 'care') => (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      selectFile(type, file);
    },
    [selectFile],
  );

  const handleReset = useCallback(() => {
    reset();
    if (supportInputRef.current) supportInputRef.current.value = '';
    if (careInputRef.current) careInputRef.current.value = '';
  }, [reset]);

  const summary = preview?.summary;
  const isDone = status === 'done';
  const isPreviewing = status === 'previewing';

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', py: 3, px: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate(-1)} aria-label="戻る" size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight="bold">
          CSVインポート
        </Typography>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        SharePointからエクスポートした日課表（SupportTemplate）と要配慮事項（CarePoints）の
        CSVファイルをアップロードします。自動リンクにより、日課表の各ステップに関連する支援プランが紐付けられます。
      </Typography>

      {/* Step 1: File Selection */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            ① ファイル選択
          </Typography>

          <Stack spacing={2}>
            {/* SupportTemplate CSV */}
            <Box>
              <Typography variant="body2" fontWeight="bold" sx={{ mb: 0.5 }}>
                📋 日課表（SupportTemplate）CSV
              </Typography>
              <input
                ref={supportInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange('support')}
                disabled={isDone}
                data-testid="csv-input-support"
                style={{ fontSize: '14px' }}
              />
            </Box>

            <Divider />

            {/* CarePoints CSV */}
            <Box>
              <Typography variant="body2" fontWeight="bold" sx={{ mb: 0.5 }}>
                ⚠️ 要配慮事項（CarePoints）CSV
              </Typography>
              <input
                ref={careInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange('care')}
                disabled={isDone}
                data-testid="csv-input-care"
              />
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Preview Button */}
      {!isDone && (
        <Button
          variant="contained"
          startIcon={<CloudUploadIcon />}
          onClick={generatePreview}
          disabled={isPreviewing}
          fullWidth
          sx={{ mb: 2 }}
          data-testid="btn-preview"
        >
          プレビュー生成
        </Button>
      )}

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} data-testid="import-error">
          {error}
        </Alert>
      )}

      {/* Step 2: Preview Summary */}
      {summary && !isDone && (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              ② プレビュー結果
            </Typography>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
              <Chip
                label={`${summary.userCount} ユーザー`}
                color="primary"
                variant="outlined"
                size="small"
              />
              <Chip
                label={`${summary.procedureCount} 件の日課`}
                color="info"
                variant="outlined"
                size="small"
              />
              <Chip
                label={`${summary.planCount} 件の支援プラン`}
                color="warning"
                variant="outlined"
                size="small"
              />
              <Chip
                icon={<LinkIcon />}
                label={`${summary.linkCount} 件の自動リンク`}
                color="success"
                variant="filled"
                size="small"
              />
              {summary.skippedRows > 0 && (
                <Chip
                  label={`${summary.skippedRows} 行スキップ`}
                  color="default"
                  variant="outlined"
                  size="small"
                />
              )}
            </Stack>

            {summary.linkCount > 0 && (
              <Alert severity="success" variant="outlined" sx={{ mb: 1 }}>
                自動リンクにより、日課表のステップに支援プランが紐付けられました。
                現場のタブレットで即座に確認できます。
              </Alert>
            )}

            {summary.skippedRows > 0 && (
              <Alert severity="warning" variant="outlined">
                {summary.skippedRows} 行が必須フィールド不足のためスキップされました。
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Save */}
      {summary && !isDone && (
        <Button
          variant="contained"
          color="success"
          startIcon={status === 'saving' ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
          onClick={saveToStores}
          disabled={status === 'saving'}
          fullWidth
          sx={{ mb: 2 }}
          data-testid="btn-save"
        >
          {status === 'saving' ? '保存中…' : 'ストアに保存'}
        </Button>
      )}

      {/* Done */}
      {isDone && (
        <Card
          variant="outlined"
          sx={{
            mb: 2,
            bgcolor: 'success.50',
            borderColor: 'success.main',
          }}
        >
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
            <Typography variant="h6" fontWeight="bold" color="success.main">
              インポート完了
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {summary?.userCount} ユーザー分のデータが保存されました。
              日課表や支援プランの画面で確認できます。
            </Typography>
            <Button
              variant="outlined"
              onClick={handleReset}
              sx={{ mt: 2 }}
              data-testid="btn-reset"
            >
              別のCSVをインポート
            </Button>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
