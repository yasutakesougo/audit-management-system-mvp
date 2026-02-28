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
import React, { useCallback, useMemo, useState } from 'react';

import { SharePointDailyRecordItemSchema } from '@/features/daily/schema';
import { SpUserMasterItemSchema } from '@/features/users/schema';
import { useDataIntegrityScan } from '@/hooks/useDataIntegrityScan';
import { formatScanSummary, type ScanResult, type ScanTarget } from '@/lib/dataIntegrityScanner';
import { fetchSp } from '@/lib/fetchSp';
import { ensureConfig } from '@/lib/spClient';
import { USERS_SELECT_FIELDS_SAFE } from '@/sharepoint/fields';

// ────────────────────────────────────────────────────────────────────────────
// Pre-defined scan targets
// ────────────────────────────────────────────────────────────────────────────

const SCAN_TARGETS: ScanTarget[] = [
  {
    name: 'users',
    listTitle: 'Users_Master',
    schema: SpUserMasterItemSchema,
    selectFields: USERS_SELECT_FIELDS_SAFE,
  },
  {
    name: 'daily',
    listTitle: 'DailyActivityRecords',
    schema: SharePointDailyRecordItemSchema,
    selectFields: ['Id', 'Title', 'RecordDate', 'ReporterName', 'ReporterRole', 'UserRowsJSON', 'UserCount', 'Created', 'Modified'],
  },
];

const MAX_ITEMS_PER_REQUEST = 500;
const MAX_PAGES = 4; // Safety limit: 500 × 4 = 2000 items max

/**
 * Fetch all raw items from a SharePoint list via REST API.
 * Uses pagination ($skiptoken / odata.nextLink) to collect all items.
 */
async function fetchRawItems(
  baseUrl: string,
  listTitle: string,
  selectFields: readonly string[],
  signal?: AbortSignal,
): Promise<unknown[]> {
  const allItems: unknown[] = [];
  const select = selectFields.join(',');
  let url: string | null =
    `${baseUrl}/_api/web/lists/GetByTitle('${encodeURIComponent(listTitle)}')/items?$select=${select}&$top=${MAX_ITEMS_PER_REQUEST}`;

  for (let page = 0; page < MAX_PAGES && url; page++) {
    if (signal?.aborted) break;

    const response = await fetchSp(url);
    if (!response.ok) {
      console.warn(`[DataIntegrityPage] Failed to fetch ${listTitle}`, { status: response.status });
      break;
    }

    const payload = (await response.json()) as {
      value?: unknown[];
      'odata.nextLink'?: string;
    };

    if (payload.value) {
      allItems.push(...payload.value);
    }

    url = payload['odata.nextLink'] ?? null;
  }

  return allItems;
}

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
  const { status, progress, results, error, startScan, cancelScan } = useDataIntegrityScan();
  const [copied, setCopied] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);

  const handleStartScan = useCallback(async () => {
    try {
      setFetchingData(true);
      const { baseUrl } = ensureConfig();

      // Fetch raw data from SharePoint for each target
      const data = new Map<string, unknown[]>();
      for (const target of SCAN_TARGETS) {
        const items = await fetchRawItems(baseUrl, target.listTitle, target.selectFields);
        data.set(target.name, items);
      }

      setFetchingData(false);
      startScan(SCAN_TARGETS, data);
    } catch (err) {
      setFetchingData(false);
      console.error('[DataIntegrityPage] Failed to fetch data for scan', err);
    }
  }, [startScan]);


  const handleCopy = useCallback(async () => {
    if (results.length === 0) return;
    const summary = formatScanSummary(results);
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // eslint-disable-next-line no-console
      console.warn('[DataIntegrityPage] clipboard API not available');
    }
  }, [results]);

  const totalStats = useMemo(() => {
    if (results.length === 0) return null;
    return {
      total: results.reduce((s, r) => s + r.total, 0),
      valid: results.reduce((s, r) => s + r.valid, 0),
      invalid: results.reduce((s, r) => s + r.invalid, 0),
      duration: results.reduce((s, r) => s + r.durationMs, 0),
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
            {progress.target} をスキャン中... ({progress.scanned}/{progress.total})
          </Typography>
          <LinearProgress
            variant={progress.total > 0 ? 'determinate' : 'indeterminate'}
            value={progress.total > 0 ? (progress.scanned / progress.total) * 100 : 0}
          />
        </Paper>
      )}

      {/* ── Error ──────────────────────── */}
      {status === 'error' && error && (
        <Alert severity="error" sx={{ mb: 3 }} data-testid="scan-error">
          <AlertTitle>スキャンエラー</AlertTitle>
          {error}
        </Alert>
      )}

      {/* ── Summary ──────────────────────── */}
      {status === 'done' && totalStats && (
        <Alert
          severity={totalStats.invalid === 0 ? 'success' : 'warning'}
          icon={totalStats.invalid === 0 ? <CheckCircleIcon /> : <ErrorIcon />}
          sx={{ mb: 3 }}
          data-testid="scan-summary"
        >
          <AlertTitle>
            {totalStats.invalid === 0 ? '✅ すべてのデータが正常です' : `⚠ ${totalStats.invalid}件の不整合が検出されました`}
          </AlertTitle>
          {totalStats.total}件検証 / {totalStats.valid}件 OK / {totalStats.invalid}件 エラー ({totalStats.duration}ms)
        </Alert>
      )}

      {/* ── Results Table ──────────────────────── */}
      {status === 'done' && results.length > 0 && (
        <Paper sx={{ mb: 3 }}>
          <TableContainer>
            <Table size="small" data-testid="scan-results-table">
              <TableHead>
                <TableRow>
                  <TableCell>対象</TableCell>
                  <TableCell align="right">件数</TableCell>
                  <TableCell align="right">OK</TableCell>
                  <TableCell align="right">エラー</TableCell>
                  <TableCell align="right">時間</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((r: ScanResult) => (
                  <TableRow key={r.target}>
                    <TableCell>
                      <Chip
                        label={r.target}
                        size="small"
                        color={r.invalid === 0 ? 'success' : 'warning'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">{r.total}</TableCell>
                    <TableCell align="right">{r.valid}</TableCell>
                    <TableCell align="right">
                      {r.invalid > 0 ? (
                        <Typography color="error.main" variant="body2" fontWeight={700}>
                          {r.invalid}
                        </Typography>
                      ) : (
                        '0'
                      )}
                    </TableCell>
                    <TableCell align="right">{r.durationMs}ms</TableCell>
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
                  {r.target} — {r.issues.length}件
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small" data-testid={`issues-${r.target}`}>
                    <TableHead>
                      <TableRow>
                        <TableCell width={100}>ID</TableCell>
                        <TableCell>エラー内容</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
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
