// ---------------------------------------------------------------------------
// CsvImportPage — 統合CSVインポート管理画面 v2
//
// 管理者がCSVファイルをアップロードし、プレビュー確認後にストアに保存する
// タブ切替式UIです。利用者マスタ / 日課表 / 要配慮事項の3種をサポートします。
// ---------------------------------------------------------------------------
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SaveIcon from '@mui/icons-material/Save';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Fade from '@mui/material/Fade';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import ImportHistoryPanel from '@/features/import/components/ImportHistoryPanel';
import {
  useUnifiedCSVImport,
  type ImportTarget,
} from '@/features/import/hooks/useUnifiedCSVImport';

// ── Local (split) ──
import { TARGETS } from './csv-import/types';
import { PreviewSection } from './csv-import/PreviewSection';

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function CsvImportPage() {
  const navigate = useNavigate();
  const {
    activeTarget,
    status,
    preview,
    error,
    switchTarget,
    selectFile,
    generatePreview,
    saveToStores,
    reset,
  } = useUnifiedCSVImport();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const activeConfig = TARGETS.find((t) => t.id === activeTarget)!;
  const isDone = status === 'done';
  const isProcessing = status === 'previewing' || status === 'saving';

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      selectFile(file);
      setSelectedFileName(file?.name ?? null);
    },
    [selectFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0] ?? null;
      if (file && file.name.endsWith('.csv')) {
        selectFile(file);
        setSelectedFileName(file.name);
      }
    },
    [selectFile],
  );

  const handleTargetSwitch = useCallback(
    (target: ImportTarget) => {
      switchTarget(target);
      setSelectedFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [switchTarget],
  );

  const handleReset = useCallback(() => {
    reset();
    setSelectedFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [reset]);


  // 履歴パネルの更新トリガー
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  useEffect(() => {
    if (isDone) setHistoryRefreshKey((k) => k + 1);
  }, [isDone]);

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 3, px: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <IconButton onClick={() => navigate(-1)} aria-label="戻る" size="small">
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
            CSVインポート
          </Typography>
          <Typography variant="body2" color="text.secondary">
            既存データをCSVファイルからシステムに取り込みます
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* ── Target Selector Cards ── */}
      <Typography variant="overline" fontWeight="bold" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
        インポート対象を選択
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: 1.5,
          mb: 3,
        }}
      >
        {TARGETS.map((target) => {
          const isActive = activeTarget === target.id;
          return (
            <Card
              key={target.id}
              variant="outlined"
              data-testid={`import-target-${target.id}`}
              onClick={() => !isDone && handleTargetSwitch(target.id)}
              sx={{
                cursor: isDone ? 'default' : 'pointer',
                position: 'relative',
                overflow: 'hidden',
                border: isActive ? `2px solid ${target.color}` : '1px solid',
                borderColor: isActive ? target.color : 'divider',
                bgcolor: isActive ? `${target.color}08` : 'background.paper',
                transition: 'all 0.25s ease',
                transform: isActive ? 'scale(1.02)' : 'scale(1)',
                '&:hover': isDone
                  ? {}
                  : {
                      borderColor: target.color,
                      transform: 'scale(1.02)',
                      boxShadow: `0 4px 20px ${target.color}20`,
                    },
              }}
            >
              {/* Active Indicator */}
              {isActive && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: target.gradient,
                  }}
                />
              )}
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                  <Avatar
                    sx={{
                      width: 36,
                      height: 36,
                      background: isActive ? target.gradient : 'action.hover',
                      color: isActive ? '#fff' : 'text.secondary',
                      transition: 'all 0.25s ease',
                    }}
                  >
                    {target.icon}
                  </Avatar>
                  <Typography variant="subtitle2" fontWeight={700}>
                    {target.label}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                  {target.description}
                </Typography>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      {/* ── Step 1: File Upload ── */}
      {!isDone && (
        <Fade in>
          <Card variant="outlined" sx={{ mb: 2, borderRadius: 2 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Chip
                  label="STEP 1"
                  size="small"
                  sx={{
                    fontWeight: 800,
                    fontSize: '0.65rem',
                    background: activeConfig.gradient,
                    color: '#fff',
                  }}
                />
                <Typography variant="subtitle1" fontWeight={700}>
                  ファイルを選択
                </Typography>
              </Box>

              {/* Drop Zone */}
              <Box
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                data-testid="csv-drop-zone"
                sx={{
                  position: 'relative',
                  border: '2px dashed',
                  borderColor: dragActive ? activeConfig.color : 'divider',
                  borderRadius: 2,
                  p: 4,
                  textAlign: 'center',
                  cursor: 'pointer',
                  bgcolor: dragActive ? `${activeConfig.color}08` : 'action.hover',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: activeConfig.color,
                    bgcolor: `${activeConfig.color}05`,
                  },
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  data-testid="csv-file-input"
                />

                <CloudUploadIcon
                  sx={{
                    fontSize: 48,
                    color: dragActive ? activeConfig.color : 'text.disabled',
                    mb: 1,
                    transition: 'color 0.2s',
                  }}
                />

                {selectedFileName ? (
                  <Box>
                    <Typography variant="body1" fontWeight={600} color="text.primary">
                      📄 {selectedFileName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      クリックまたはドラッグで別のファイルに変更
                    </Typography>
                  </Box>
                ) : (
                  <Box>
                    <Typography variant="body1" fontWeight={600} color="text.secondary">
                      CSVファイルをドラッグ＆ドロップ
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      またはクリックしてファイルを選択
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Field hints */}
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.disabled', mt: 0.2 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    <strong>必須フィールド:</strong> {activeConfig.requiredFields}
                  </Typography>
                  <br />
                  <Typography variant="caption" color="text.disabled">
                    {activeConfig.acceptHint}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Fade>
      )}

      {/* Preview Button */}
      {!isDone && selectedFileName && !preview && (
        <Button
          variant="contained"
          size="large"
          startIcon={
            isProcessing
              ? <CircularProgress size={20} color="inherit" />
              : <CloudUploadIcon />
          }
          onClick={generatePreview}
          disabled={isProcessing}
          fullWidth
          data-testid="btn-preview"
          sx={{
            mb: 2,
            py: 1.5,
            fontWeight: 700,
            background: activeConfig.gradient,
            '&:hover': {
              background: activeConfig.gradient,
              filter: 'brightness(1.1)',
            },
          }}
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

      {/* ── Step 2: Preview ── */}
      {preview && !isDone && (
        <PreviewSection preview={preview} activeConfig={activeConfig} />
      )}

      {/* Step 3: Save */}
      {preview && !isDone && (
        <Button
          variant="contained"
          color="success"
          size="large"
          startIcon={
            status === 'saving'
              ? <CircularProgress size={20} color="inherit" />
              : <SaveIcon />
          }
          onClick={saveToStores}
          disabled={status === 'saving'}
          fullWidth
          data-testid="btn-save"
          sx={{
            mb: 2,
            py: 1.5,
            fontWeight: 700,
            borderRadius: 2,
          }}
        >
          {status === 'saving' ? '保存中…' : `${activeConfig.label}をストアに保存`}
        </Button>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <LinearProgress
          sx={{
            mb: 2,
            borderRadius: 1,
            '& .MuiLinearProgress-bar': {
              background: activeConfig.gradient,
            },
          }}
        />
      )}

      {/* ── Done ── */}
      {isDone && (
        <Fade in>
          <Card
            variant="outlined"
            sx={{
              mb: 2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'success.light',
              background: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'rgba(16, 185, 129, 0.08)'
                  : 'rgba(16, 185, 129, 0.04)',
            }}
          >
            <CardContent sx={{ textAlign: 'center', py: 5 }}>
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                  boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)',
                }}
              >
                <CheckCircleIcon sx={{ fontSize: 40, color: '#fff' }} />
              </Box>
              <Typography variant="h5" fontWeight={800} color="success.main" gutterBottom>
                インポート完了
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {preview?.summary.userCount} ユーザー分 / {preview?.summary.recordCount} レコードが正常に保存されました。
              </Typography>

              <Stack direction="row" spacing={1.5} justifyContent="center">
                <Button
                  variant="outlined"
                  onClick={handleReset}
                  data-testid="btn-reset"
                  sx={{ fontWeight: 600 }}
                >
                  別のCSVをインポート
                </Button>
                <Button
                  variant="contained"
                  onClick={() => navigate('/admin')}
                  sx={{ fontWeight: 600 }}
                >
                  管理ハブに戻る
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Fade>
      )}

      {/* ── Import History Section ── */}
      <Divider sx={{ my: 3 }} />

      <Box sx={{ mb: 1 }}>
        <Typography
          variant="overline"
          fontWeight="bold"
          color="text.secondary"
          sx={{ display: 'block', mb: 1.5 }}
        >
          📜 インポート履歴
        </Typography>
        <ImportHistoryPanel refreshKey={historyRefreshKey} />
      </Box>
    </Box>
  );
}
