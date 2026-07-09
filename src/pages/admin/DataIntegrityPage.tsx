import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import ErrorIcon from '@mui/icons-material/Error';
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
import { z, type ZodTypeAny } from 'zod';
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

type DuplicateRule = {
  id: string;
  label: string;
  fields: readonly string[];
  ignoreMissing?: boolean;
};

/** 
 * Map technical registry keys to their corresponding validation schemas.
 * This bridge connects the operational registry (SSOT) with UI-level Zod validation.
 */
const SCHEMA_MAP: Record<string, ZodTypeAny> = {
  users_master: SpUserMasterItemSchema,
  schedule_events: SpScheduleRowSchema,
  daily_activity_records: SharePointDailyRecordItemSchema,
};

const FALLBACK_SCHEMA = z.unknown();

/** Duplicate-key checks for major operational lists */
const INTEGRITY_DUPLICATE_RULES: Record<string, readonly DuplicateRule[]> = {
  users_master: [
    {
      id: 'user-id',
      label: '利用者ID',
      fields: ['UserID'],
    },
  ],
  schedule_events: [
    {
      id: 'user-schedule-slot',
      label: '対象者の時間軸',
      fields: ['TargetUserId', 'EventDate', 'EndDate'],
      ignoreMissing: true,
    },
    {
      id: 'staff-schedule-slot',
      label: '担当者の時間軸',
      fields: ['AssignedStaffId', 'EventDate', 'EndDate'],
      ignoreMissing: true,
    },
  ],
  daily_activity_records: [
    {
      id: 'user-activity',
      label: '利用者別活動時刻',
      fields: ['UserCode', 'RecordDate', 'TimeSlot', 'PlanSlotKey'],
      ignoreMissing: true,
    },
  ],
  support_procedure_record_daily: [
    {
      id: 'isp-detail-key',
      label: 'ISP詳細キー',
      fields: ['UserCode', 'RecordDate', 'PlanningSheetId'],
      ignoreMissing: true,
    },
  ],
  isp_master: [
    {
      id: 'isp-master-user-start',
      label: 'ISP開始日',
      fields: ['UserCode', 'PlanStartDate'],
      ignoreMissing: true,
    },
  ],
  planning_sheet_master: [
    {
      id: 'planning-sheet-user',
      label: '支援計画シート',
      fields: ['UserCode', 'UserId', 'ISPId'],
      ignoreMissing: true,
    },
  ],
  planning_sheet_reassessment_master: [
    {
      id: 'reassessment-date',
      label: '再評価日',
      fields: ['PlanningSheetId', 'ReassessmentDate'],
      ignoreMissing: true,
    },
  ],
  support_plans: [
    {
      id: 'draft-id',
      label: 'ドラフトID',
      fields: ['DraftId'],
      ignoreMissing: true,
    },
  ],
  service_provision_records: [
    {
      id: 'service-entry',
      label: '提供実績エントリ',
      fields: ['EntryKey'],
      ignoreMissing: true,
    },
  ],
};

/**
 * Derived scan targets for depth-validation and duplicate checks.
 */
const SCAN_TARGETS: ScanTarget[] = getDriftProbeTargets()
  .filter((target) =>
    Object.prototype.hasOwnProperty.call(SCHEMA_MAP, target.key) ||
    Object.prototype.hasOwnProperty.call(INTEGRITY_DUPLICATE_RULES, target.key)
  )
  .map((target) => {
    const duplicateChecks = INTEGRITY_DUPLICATE_RULES[target.key];
    const duplicateFields = duplicateChecks ? [...new Set(duplicateChecks.flatMap((rule) => rule.fields))] : [];
    return {
      name: target.key,
      displayName: target.displayName,
      listTitle: target.listTitle,
      schema: SCHEMA_MAP[target.key] ?? FALLBACK_SCHEMA,
      selectFields: Array.from(new Set([...target.selectFields, ...duplicateFields])),
      duplicateChecks,
    };
  });

const csvEscape = (value: unknown): string => {
  const text = String(value ?? '').replace(/\r?\n/g, ' ');
  const escaped = text.replace(/"/g, '""');
  return `"${escaped}"`;
};

const buildDuplicateCsv = (results: ScanResult[]): string => {
  const header = [
    'リストキー',
    '表示名',
    '一覧名',
    'ルールID',
    'ルール名',
    '重複キー',
    '重複件数',
    '該当ID',
    'キー項目(見出し=値)',
  ];

  const rows = [header.join(',')];

  for (const result of results) {
    for (const issue of result.duplicateIssues) {
      rows.push([
        result.target,
        result.displayName ?? '',
        result.listTitle,
        issue.ruleId,
        issue.ruleLabel,
        issue.key,
        issue.duplicateCount,
        issue.recordIds.join(','),
        Object.entries(issue.keyValues)
          .map(([name, val]) => `${name}=${val}`)
          .join(' | '),
      ].map(csvEscape).join(','));
    }
  }

  return rows.join('\n');
};

const buildDuplicateJson = (results: ScanResult[]) => ({
  generatedAt: new Date().toISOString(),
  totals: {
    lists: results.length,
    records: results.reduce((sum, result) => sum + result.total, 0),
    invalid: results.reduce((sum, result) => sum + result.invalid, 0),
    duplicateGroups: results.reduce((sum, result) => sum + result.duplicateIssues.length, 0),
    duplicateRows: results.reduce((sum, result) => sum + result.duplicateCount, 0),
  },
  results,
});

const downloadText = (content: string, filename: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

/**
 * 管理者用データ整合性ダッシュボード。
 *
 * 全 SharePoint リストを Zod スキーマで一括検証し、重複キーを検知した結果を表示するページ。
 */
const DataIntegrityPage: React.FC = () => {
  const { spFetch } = useSP();
  const { status, progress, results, error: scanError, startScan, cancelScan } = useDataIntegrityScan();
  const [copied, setCopied] = useState(false);
  const [runId, setRunId] = useState<string>('');
  const [fetchingData, setFetchingData] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const handleStartScan = useCallback(async () => {
    const requestId = `di-${Date.now().toString(36)}`;
    try {
      setRunId(requestId);
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
          data.set(target.name, {
            items,
            fetchStatus: 'success',
            isTruncated,
            skippedFields,
          });

          if (skippedFields.length > 0) {
            emitSkippedFieldTelemetry({
              listKey: target.name,
              skippedFields,
              count: items.length,
              requestId,
            });
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

  const handleExportCsv = useCallback(() => {
    if (results.length === 0) return;
    const csv = buildDuplicateCsv(results);
    const filename = `data-integrity-duplicates-${runId || 'latest'}.csv`;
    downloadText(csv, filename, 'text/csv;charset=utf-8;');
  }, [results, runId]);

  const handleExportJson = useCallback(() => {
    if (results.length === 0) return;
    const json = JSON.stringify(buildDuplicateJson(results), null, 2);
    const filename = `data-integrity-duplicates-${runId || 'latest'}.json`;
    downloadText(json, filename, 'application/json;charset=utf-8;');
  }, [results, runId]);

  const totalStats = useMemo(() => {
    if (results.length === 0) return null;
    return {
      total: results.reduce((sum, r) => sum + r.total, 0),
      valid: results.reduce((sum, r) => sum + r.valid, 0),
      invalid: results.reduce((sum, r) => sum + r.invalid, 0),
      duplicates: results.reduce((sum, r) => sum + r.duplicateCount, 0),
      duplicateGroups: results.reduce((sum, r) => sum + r.duplicateIssues.length, 0),
      duration: results.reduce((sum, r) => sum + r.durationMs, 0),
      fetchFailures: results.filter((r) => r.fetchStatus === 'failed').length,
    };
  }, [results]);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }} data-testid="data-integrity-page">
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
        🔍 データ整合性チェック
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        SharePoint のデータを Zod スキーマで検証し、主要ビジネスキーの重複を検知します。
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

        {results.length > 0 && (
          <Button variant="outlined" onClick={handleExportCsv} data-testid="export-csv-btn">
            CSVエクスポート
          </Button>
        )}

        {results.length > 0 && (
          <Button variant="outlined" onClick={handleExportJson} data-testid="export-json-btn">
            JSONエクスポート
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
            severity={totalStats.invalid === 0 && totalStats.duplicates === 0 && totalStats.fetchFailures === 0 ? 'success' : 'warning'}
            icon={totalStats.invalid === 0 && totalStats.duplicates === 0 && totalStats.fetchFailures === 0 ? <CheckCircleIcon /> : <ErrorIcon />}
            sx={{ mb: 2 }}
            data-testid="scan-summary"
          >
            <AlertTitle sx={{ fontWeight: 700 }}>
            {totalStats.fetchFailures > 0
                ? `⚠ ${totalStats.fetchFailures}件のリストで取得エラー（検証未完了）`
                : totalStats.invalid > 0
                  ? `⚠ ${totalStats.invalid}件の不整合が検出されました`
                  : totalStats.duplicates > 0
                    ? `⚠ ${totalStats.duplicates}件の重複の可能性がある記録があります（重複種別 ${totalStats.duplicateGroups}）`
                    : '✅ すべてのデータが正常です'}
            </AlertTitle>
            {totalStats.total}件検証 / {totalStats.valid}件 OK / {totalStats.invalid}件 エラー / {totalStats.duplicates}件 重複 ({totalStats.duration}ms)
            {results.some((r) => r.isTruncated) && (
              <Typography variant="caption" display="block" sx={{ mt: 0.5, fontWeight: 700 }}>
                ※ 一部のリストで取得上限（10,000件）に到達したため、全件を検証できていない可能性があります。
              </Typography>
            )}
          </Alert>

          {/* SharePoint 8KB Limit Alert (Specific to welfare context) */}
          <Alert severity="info" sx={{ mb: 3 }}>
            <AlertTitle sx={{ fontWeight: 700, fontSize: '0.85rem' }}>ℹ️ SharePoint 行サイズ制限 (8KB) に関する注意</AlertTitle>
            <Typography variant="caption">
              Users_Master 等のフィールド数が多いリストでは、SharePoint の内部制限により一部の列が保存されない、あるいは「列の合計サイズが制限を超えている」エラーが発生する場合があります。
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
                  <TableCell align="right" sx={{ fontWeight: 700 }}>重複件数</TableCell>
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
                            label={r.isTruncated ? '上限到達' : '成功'}
                            size="small"
                            color={r.isTruncated ? 'warning' : 'success'}
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
                    <TableCell align="right">
                      {r.duplicateCount > 0 ? (
                        <Typography color="warning.main" variant="body2" fontWeight={700}>
                          {r.duplicateCount.toLocaleString()} ({r.duplicateIssues.length})
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
              <Box key={`issue-${r.target}`} sx={{ mb: 3 }}>
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

      {/* ── Duplicate Details ──────────────────────── */}
      {status === 'done' && results.some((r) => r.duplicateIssues.length > 0) && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            🔁 重複キー詳細
          </Typography>
          {results
            .filter((r) => r.duplicateIssues.length > 0)
            .map((r) => (
              <Box key={`dup-${r.target}`} sx={{ mb: 3 }}>
                <Typography variant="subtitle2" component="span" sx={{ mb: 1, color: 'warning.dark' }}>
                  {r.displayName || r.target} — {r.duplicateIssues.length}種
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small" data-testid={`duplicate-${r.target}`}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'warning.light', opacity: 0.12 }}>
                        <TableCell sx={{ fontWeight: 700 }}>ルール</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>キー</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>重複件数</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>対象ID</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {r.duplicateIssues.map((issue) => (
                        <TableRow key={`${issue.ruleId}-${issue.key}`}>
                          <TableCell>{issue.ruleLabel}</TableCell>
                          <TableCell>
                            {Object.entries(issue.keyValues).map(([field, value]) => `${field}=${value}`).join(', ')}
                          </TableCell>
                          <TableCell align="right">{issue.duplicateCount}</TableCell>
                          <TableCell>{issue.recordIds.map((id) => String(id)).join(', ')}</TableCell>
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
