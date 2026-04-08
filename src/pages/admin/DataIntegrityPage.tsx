import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ErrorIcon from '@mui/icons-material/Error';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import type { ZodTypeAny } from 'zod';
import React, { useCallback, useMemo, useState } from 'react';

import { SharePointDailyRecordItemSchema } from '@/features/daily/domain/schema';
import { SpScheduleRowSchema } from '@/features/schedules/data/spRowSchema';
import { SpUserMasterItemSchema } from '@/features/users/schema';
import { useDataIntegrityScan } from '@/hooks/useDataIntegrityScan';
import { emitSkippedFieldTelemetry } from '@/lib/dataIntegrity/skippedFieldTelemetry';
import { formatScanSummary, type ScanResult, type ScanTarget, type TargetData } from '@/lib/dataIntegrityScanner';
import { auditLog } from '@/lib/debugLogger';
import { 
  fetchRawItemsWithFieldFallback 
} from '@/lib/sp/helpers';
import { useSP } from '@/lib/spClient';
import { getDriftProbeTargets } from '@/sharepoint/driftProbeRegistry';

// ────────────────────────────────────────────────────────────────────────────
// Pre-defined scan targets
// ────────────────────────────────────────────────────────────────────────────

/** 
 * Map technical registry keys to their corresponding validation schemas.
 * This bridge connects the operational registry (SSOT) with UI-level Zod validation.
 */
const SCHEMA_MAP: Record<string, ZodTypeAny> = {
  'users_master': SpUserMasterItemSchema,
  'schedules': SpScheduleRowSchema,
  'daily_activity_records': SharePointDailyRecordItemSchema,
};

/**
 * Derived scan targets for depth-validation.
 * We only deep-scan a subset of all drift-probed lists which have defined schemas.
 */
const SCAN_TARGETS: ScanTarget[] = getDriftProbeTargets()
  .filter(t => t.key in SCHEMA_MAP)
  .map(t => ({
    name: t.key,
    displayName: t.displayName,
    listTitle: t.listTitle,
    schema: SCHEMA_MAP[t.key],
    selectFields: t.selectFields,
  }));


// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

/**
 * 管理者用データ整合性ダッシュボード。
 *
 * 全 SharePoint リストのデータを Zod スキーマで一括検証し、
 * 不整合レコードの一覧を表示するページ。
 */
const DataIntegrityPage: React.FC = () => {
  const { spFetch } = useSP();
  const { status, progress, results, error: scanError, startScan, cancelScan } = useDataIntegrityScan();
  const [copied, setCopied] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const handleStartScan = useCallback(async () => {
    const requestId = `di-${Date.now().toString(36)}`;
    try {
      setFetchingData(true);
      setFetchError(null);

      // Fetch raw data from SharePoint for each target
      const data = new Map<string, TargetData>();
      for (const target of SCAN_TARGETS) {
        try {
          const { items, isTruncated, skippedFields } = await fetchRawItemsWithFieldFallback(
            spFetch,
            target.listTitle,
            target.selectFields,
          );
          data.set(target.name, { items, fetchStatus: 'success', isTruncated, skippedFields });

          if (skippedFields.length > 0) {
            emitSkippedFieldTelemetry({ listKey: target.name, skippedFields, count: items.length, requestId });
          }
        } catch (fetchErr) {
          // eslint-disable-next-line no-console
          console.warn(`[data-integrity] Failed to fetch ${target.listTitle}:`, fetchErr);
          data.set(target.name, {
            items: [],
            fetchStatus: 'failed',
            fetchError: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
          });
        }
      }

      setFetchingData(false);
      startScan(SCAN_TARGETS, data);
    } catch (err) {
      setFetchingData(false);
      const msg = err instanceof Error ? err.message : String(err);
      setFetchError(msg);
      auditLog.error('data-integrity', 'fetch_scan_data_failed', { error: msg });
    }
  }, [spFetch, startScan]);


  const handleCopy = useCallback(async () => {
    if (results.length === 0) return;
    const summary = formatScanSummary(results);
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      auditLog.warn('data-integrity', 'clipboard_api_unavailable');
    }
  }, [results]);

  const totalStats = useMemo(() => {
    if (results.length === 0) return null;
    return {
      total: results.reduce((s, r) => s + r.total, 0),
      valid: results.reduce((s, r) => s + r.valid, 0),
      invalid: results.reduce((s, r) => s + r.invalid, 0),
      duration: results.reduce((s, r) => s + r.durationMs, 0),
      // fetchStatus === 'failed' のリスト数。0件成功を「正常」と誤判定しないための必須フラグ
      fetchFailures: results.filter(r => r.fetchStatus === 'failed').length,
    };
  }, [results]);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }} data-testid="data-integrity-page">
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
        🔍 データ整合性チェック
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        SharePoint のデータを Zod スキーマで一括検証し、不整合レコードを特定します。
      </Typography>

      {/* ── Control Bar ──────────────────────── */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Button
          variant="contained"
          color="primary"
          disabled={fetchingData}
          startIcon={fetchingData || status === 'scanning' ? <StopIcon /> : <PlayArrowIcon />}
          onClick={status === 'scanning' ? cancelScan : handleStartScan}
          data-testid="scan-action-btn"
        >
          {fetchingData ? 'データ取得中...' : status === 'scanning' ? 'スキャン中断' : 'スキャン開始'}
        </Button>

        {results.length > 0 && (
          <Button
            variant="outlined"
            startIcon={<ContentCopyIcon />}
            onClick={handleCopy}
            data-testid="copy-report-btn"
          >
            {copied ? 'コピー済み ✓' : 'レポートをコピー'}
          </Button>
        )}
      </Stack>

      {/* ── Progress ──────────────────────── */}
      {status === 'scanning' && progress && (
        <Paper sx={{ p: 2, mb: 3 }} data-testid="scan-progress">
          <Typography variant="body2" sx={{ mb: 1 }}>
            {progress.displayName || progress.target} をスキャン中... ({progress.scanned}/{progress.total})
          </Typography>
          <LinearProgress
            variant={progress.total > 0 ? 'determinate' : 'indeterminate'}
            value={progress.total > 0 ? (progress.scanned / progress.total) * 100 : 0}
          />
        </Paper>
      )}

      {/* ── Error ──────────────────────── */}
      {(fetchError || (status === 'error' && scanError)) && (
        <Alert severity="error" sx={{ mb: 3 }} data-testid="scan-error">
          <AlertTitle>スキャンエラー</AlertTitle>
          {fetchError || scanError}
        </Alert>
      )}

      {/* ── Summary ──────────────────────── */}
      {status === 'done' && totalStats && (
        <>
          <Alert
            severity={totalStats.invalid === 0 && totalStats.fetchFailures === 0 ? 'success' : 'warning'}
            icon={totalStats.invalid === 0 && totalStats.fetchFailures === 0 ? <CheckCircleIcon /> : <ErrorIcon />}
            sx={{ mb: 2 }}
            data-testid="scan-summary"
          >
            <AlertTitle sx={{ fontWeight: 700 }}>
              {totalStats.fetchFailures > 0
                ? `⚠ ${totalStats.fetchFailures}件のリストで取得エラー（検証未完了）`
                : totalStats.invalid === 0
                  ? '✅ すべてのデータが正常です'
                  : `⚠ ${totalStats.invalid}件の不整合が検出されました`}
            </AlertTitle>
            {totalStats.total}件検証 / {totalStats.valid}件 OK / {totalStats.invalid}件 エラー ({totalStats.duration}ms)
            {results.some(r => r.isTruncated) && (
              <Typography variant="caption" display="block" sx={{ mt: 0.5, fontWeight: 700 }}>
                ※ 一部のリストで取得上限（10,000件）に到達したため、全件を検証できていない可能性があります。
              </Typography>
            )}
          </Alert>

          {/* SharePoint 8KB Limit Alert (Specific to welfare context) */}
          <Alert severity="info" sx={{ mb: 3 }}>
            <AlertTitle sx={{ fontWeight: 700, fontSize: '0.85rem' }}>ℹ️ SharePoint 行サイズ制限 (8KB) に関する注意</AlertTitle>
            <Typography variant="caption">
              Users_Master 等のフィールド数が多いリストでは、SharePoint の内部制限により一部の列が保存されない、
              あるいは「列の合計サイズが制限を超えている」エラーが発生する場合があります。
              本ツールで「取得エラー」や「必須欠落」が頻発する場合、不要な列の削除や統合を検討してください。
            </Typography>
          </Alert>

          {/* ── Skipped Fields Warning Banner (Phase C) ── */}
          {results.some((r) => (r.skippedFields ?? []).length > 0) && (
            <Alert severity="warning" sx={{ mb: 3 }} data-testid="skipped-fields-banner">
              <AlertTitle sx={{ fontWeight: 700 }}>⚠ 列スキップが検出されました</AlertTitle>
              Nightly Patrol レポートで persistent_drift の有無を確認してください。
            </Alert>
          )}
        </>
      )}

      {/* ── Results Table ──────────────────────── */}
      {status === 'done' && results.length > 0 && (
        <Paper sx={{ mb: 3 }}>
          <TableContainer>
            <Table size="small" data-testid="scan-results-table">
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 700 }}>対象リスト</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>取得状況</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>取得数</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>検証OK</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>検証NG</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>時間</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((r: ScanResult) => (
                  <TableRow key={r.target} hover>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {r.displayName || r.target}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">{r.listTitle}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5} alignItems="flex-start">
                        {r.fetchStatus === 'success' ? (
                          <Chip
                            label={r.isTruncated ? "上限到達" : "成功"}
                            size="small"
                            color={r.isTruncated ? "warning" : "success"}
                            variant="filled"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        ) : (
                          <Chip
                            label="失敗"
                            size="small"
                            color="error"
                            variant="filled"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                        {r.skippedFields && r.skippedFields.length > 0 && (
                          <>
                            <Typography variant="caption" color="warning.main">
                              ⚠ 列スキップ: {r.skippedFields.join(', ')}
                            </Typography>
                            <Button
                              component="a"
                              href="/admin/status"
                              size="small"
                              variant="text"
                              color="warning"
                              sx={{ fontSize: '0.65rem', p: 0, minWidth: 0, textTransform: 'none', lineHeight: 1.4 }}
                              data-testid={`skipped-fields-link-${r.target}`}
                            >
                              構成診断を確認する →
                            </Button>
                          </>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">{r.total.toLocaleString()}件</TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="success.main">{r.valid.toLocaleString()}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      {r.invalid > 0 ? (
                        <Typography color="error.main" variant="body2" fontWeight={700}>
                          {r.invalid.toLocaleString()}
                        </Typography>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell align="right" color="text.secondary">{r.durationMs}ms</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* ── Issue Details ──────────────────────── */}
      {status === 'done' && results.some((r) => r.issues.length > 0) && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            📋 不整合レコード詳細
          </Typography>
          {results
            .filter((r) => r.issues.length > 0)
            .map((r) => (
              <Box key={r.target} sx={{ mb: 3 }}>
                <Typography variant="subtitle2" component="span" sx={{ mb: 1, color: 'warning.dark' }}>
                  {r.displayName || r.target} — {r.issues.length}件
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small" data-testid={`issues-${r.target}`}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'error.light', opacity: 0.1 }}>
                        <TableCell width={100} sx={{ fontWeight: 700 }}>ID</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>内容</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {r.fetchStatus === 'failed' && (
                        <TableRow>
                          <TableCell sx={{ color: 'error.main' }}>Fetch Error</TableCell>
                          <TableCell sx={{ color: 'error.main', fontWeight: 600 }}>
                            {r.fetchError} (リストが存在しないか、アクセス権限がありません)
                          </TableCell>
                        </TableRow>
                      )}
                      {r.issues.map((issue, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <code>{String(issue.recordId)}</code>
                          </TableCell>
                          <TableCell>
                            {issue.messages.map((msg, mi) => (
                              <Typography key={mi} variant="body2" sx={{ color: 'error.main' }}>
                                {msg}
                              </Typography>
                            ))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            ))}
        </>
      )}
    </Container>
  );
};

export default DataIntegrityPage;
