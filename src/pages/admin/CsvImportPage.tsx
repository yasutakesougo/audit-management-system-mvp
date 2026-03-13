// ---------------------------------------------------------------------------
// CsvImportPage — 統合CSVインポート管理画面 v2
//
// 管理者がCSVファイルをアップロードし、プレビュー確認後にストアに保存する
// タブ切替式UIです。利用者マスタ / 日課表 / 要配慮事項の3種をサポートします。
// ---------------------------------------------------------------------------
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DescriptionIcon from '@mui/icons-material/Description';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import GroupIcon from '@mui/icons-material/Group';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SaveIcon from '@mui/icons-material/Save';
import ScheduleIcon from '@mui/icons-material/Schedule';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import Fade from '@mui/material/Fade';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import ImportHistoryPanel from '@/features/import/components/ImportHistoryPanel';
import {
  useUnifiedCSVImport,
  type ImportTarget,
} from '@/features/import/hooks/useUnifiedCSVImport';

// ---------------------------------------------------------------------------
// Import target configuration
// ---------------------------------------------------------------------------

type TargetConfig = {
  id: ImportTarget;
  label: string;
  description: string;
  icon: React.ReactNode;
  acceptHint: string;
  requiredFields: string;
  color: string;
  gradient: string;
};

const TARGETS: TargetConfig[] = [
  {
    id: 'users',
    label: '利用者マスタ',
    description: 'Users_Master CSVをインポートして利用者情報を一括登録',
    icon: <GroupIcon />,
    acceptHint: 'UserID, FullName, AttendanceDays, etc.',
    requiredFields: 'UserID（利用者ID）、FullName（氏名）',
    color: '#6366f1',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  },
  {
    id: 'support',
    label: '日課表',
    description: 'SupportTemplate CSVをインポートして日課表を一括登録',
    icon: <ScheduleIcon />,
    acceptHint: 'UserCode, 時間帯, 活動内容, etc.',
    requiredFields: 'UserCode、時間帯、活動内容',
    color: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)',
  },
  {
    id: 'care',
    label: '要配慮事項',
    description: 'CarePoints CSVをインポートして配慮事項を一括登録',
    icon: <DescriptionIcon />,
    acceptHint: 'Usercode, PointText, IsActive, etc.',
    requiredFields: 'Usercode、PointText',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
  },
];

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
          <Card
            variant="outlined"
            sx={{ mb: 2, borderRadius: 2 }}
          >
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
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          data-testid="import-error"
          icon={<ErrorOutlineIcon />}
        >
          {error}
        </Alert>
      )}

      {/* ── Step 2: Preview ── */}
      {preview && !isDone && (
        <Fade in>
          <Card variant="outlined" sx={{ mb: 2, borderRadius: 2 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Chip
                  label="STEP 2"
                  size="small"
                  sx={{
                    fontWeight: 800,
                    fontSize: '0.65rem',
                    background: activeConfig.gradient,
                    color: '#fff',
                  }}
                />
                <Typography variant="subtitle1" fontWeight={700}>
                  プレビュー確認
                </Typography>
              </Box>

              {/* Summary Stats */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: 1.5,
                  mb: 2,
                }}
              >
                <StatCard
                  label="ユーザー数"
                  value={preview.summary.userCount}
                  color={activeConfig.color}
                />
                <StatCard
                  label="レコード数"
                  value={preview.summary.recordCount}
                  color="#10b981"
                />
                <StatCard
                  label="総行数"
                  value={preview.summary.totalRows}
                  color="#8b5cf6"
                />
                {preview.summary.skippedRows > 0 && (
                  <StatCard
                    label="スキップ行"
                    value={preview.summary.skippedRows}
                    color="#ef4444"
                  />
                )}
              </Box>

              {/* Validation Issues */}
              {preview.validationIssues.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Alert
                    severity="warning"
                    variant="outlined"
                    icon={<WarningAmberIcon />}
                  >
                    {preview.validationIssues.length} 件のバリデーション警告があります
                  </Alert>
                  <Collapse in>
                    <Box sx={{ mt: 1, maxHeight: 200, overflow: 'auto' }}>
                      {preview.validationIssues.slice(0, 10).map((issue, i) => (
                        <Box
                          key={i}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            py: 0.5,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          <Chip
                            label={`行 ${issue.row}`}
                            size="small"
                            variant="outlined"
                            color={issue.severity === 'error' ? 'error' : 'warning'}
                            sx={{ minWidth: 60 }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            <strong>{issue.field}:</strong> {issue.message}
                          </Typography>
                        </Box>
                      ))}
                      {preview.validationIssues.length > 10 && (
                        <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
                          他 {preview.validationIssues.length - 10} 件の警告…
                        </Typography>
                      )}
                    </Box>
                  </Collapse>
                </Box>
              )}

              {/* Users Preview Table */}
              {preview.target === 'users' && (
                <UsersPreviewTable rows={preview.tableRows} maxRows={10} />
              )}

              {/* Support/Care Preview */}
              {(preview.target === 'support' || preview.target === 'care') && (
                <GenericPreviewTable
                  data={preview.data as Map<string, { id?: string; time?: string; activity?: string; targetBehavior?: string }[]>}
                  target={preview.target}
                  maxUsers={5}
                />
              )}
            </CardContent>
          </Card>
        </Fade>
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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        textAlign: 'center',
        borderRadius: 2,
        borderColor: `${color}30`,
        background: `${color}06`,
      }}
    >
      <Typography variant="h4" fontWeight={800} sx={{ color, letterSpacing: '-0.02em' }}>
        {value.toLocaleString()}
      </Typography>
      <Typography variant="caption" color="text.secondary" fontWeight={600}>
        {label}
      </Typography>
    </Paper>
  );
}

function UsersPreviewTable({
  rows,
  maxRows = 10,
}: {
  rows: { UserID: string; FullName: string; AttendanceDays: string[]; IsActive: boolean; IsHighIntensitySupportTarget: boolean }[];
  maxRows?: number;
}) {
  const display = rows.slice(0, maxRows);
  const remaining = rows.length - maxRows;

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
        📋 データプレビュー（先頭 {Math.min(rows.length, maxRows)} 件）
      </Typography>
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ borderRadius: 2, maxHeight: 400 }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover' }}>利用者ID</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover' }}>氏名</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover' }}>通所曜日</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover' }} align="center">状態</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover' }} align="center">強度行動障害</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {display.map((row) => (
              <TableRow key={row.UserID} hover>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                    {row.UserID}
                  </Typography>
                </TableCell>
                <TableCell>{row.FullName}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {row.AttendanceDays.map((day) => (
                      <Chip
                        key={day}
                        label={day}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem', height: 22 }}
                      />
                    ))}
                  </Stack>
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={row.IsActive ? '有効' : '無効'}
                    size="small"
                    color={row.IsActive ? 'success' : 'default'}
                    variant="filled"
                    sx={{ fontSize: '0.7rem' }}
                  />
                </TableCell>
                <TableCell align="center">
                  {row.IsHighIntensitySupportTarget && (
                    <Tooltip title="強度行動障害対象">
                      <Chip
                        label="対象"
                        size="small"
                        color="error"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem' }}
                      />
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {remaining > 0 && (
        <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
          他 {remaining} 件のレコード…
        </Typography>
      )}
    </Box>
  );
}

function GenericPreviewTable({
  data,
  target,
  maxUsers = 5,
}: {
  data: Map<string, Record<string, unknown>[]>;
  target: 'support' | 'care';
  maxUsers?: number;
}) {
  const entries = Array.from(data.entries()).slice(0, maxUsers);

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
        📋 データプレビュー（先頭 {Math.min(data.size, maxUsers)} ユーザー）
      </Typography>

      <Stack spacing={1}>
        {entries.map(([userCode, items]) => (
          <Paper key={userCode} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Chip
                label={userCode}
                size="small"
                variant="outlined"
                color="primary"
                sx={{ fontFamily: 'monospace', fontWeight: 700 }}
              />
              <Typography variant="caption" color="text.secondary">
                {items.length} 件
              </Typography>
            </Box>
            <Stack spacing={0.5}>
              {items.slice(0, 4).map((item, i) => (
                <Typography key={i} variant="caption" color="text.secondary" sx={{ pl: 1 }}>
                  {target === 'support'
                    ? `${(item as { time?: string }).time ?? '?'} — ${(item as { activity?: string }).activity ?? '?'}`
                    : (item as { targetBehavior?: string }).targetBehavior ?? '(データ)'}
                </Typography>
              ))}
              {items.length > 4 && (
                <Typography variant="caption" color="text.disabled" sx={{ pl: 1 }}>
                  他 {items.length - 4} 件…
                </Typography>
              )}
            </Stack>
          </Paper>
        ))}
      </Stack>

      {data.size > maxUsers && (
        <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
          他 {data.size - maxUsers} ユーザー…
        </Typography>
      )}
    </Box>
  );
}
