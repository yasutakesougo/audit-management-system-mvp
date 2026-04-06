/**
 * SpIndexPressurePanel — sp_index_pressure シグナル時のインデックス候補提示UI
 *
 * - sp_index_pressure シグナルがある場合のみレンダリング
 * - SP REST で現在のインデックス済みフィールドを取得
 * - 削除候補（理由付き） / 追加候補（理由付き）を2列で提示
 * - 提案のみ。自動実行はしない（Stage 1）
 * - 「再チェック」ボタンで再フェッチ → 改善/変化なし を差分表示
 * - 既知設定なしのリストには設定テンプレートのコピー機能を提供
 */

import React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import BuildIcon from '@mui/icons-material/Build';
import type { SpHealthSignal } from '../spHealthSignalStore';
import { useSpIndexCandidates, type SpIndexedField } from './useSpIndexCandidates';
import { useSP } from '@/lib/spClient';
import { executeIndexRemediation, type RemediationResult } from './spIndexRemediationService';

interface Props {
  signal: SpHealthSignal | null;
}

// ── Snapshot / Diff types ─────────────────────────────────────────────────────

interface IndexSnapshot {
  indexCount: number;
  deletionCount: number;
  additionCount: number;
}

interface ReloadDiff {
  indexCountDelta: number;
  deletionDelta: number;
  additionDelta: number;
  prevSnapshot: IndexSnapshot;
  checkedAt: string;
}

// ── Config template generator ─────────────────────────────────────────────────

function buildConfigTemplate(listName: string, fields: SpIndexedField[]): string {
  const fieldLines = fields
    .map(
      (f) =>
        `    { internalName: '${f.internalName}', displayName: '${f.displayName}', reason: '/* TODO: このフィールドを $filter/$orderby で利用する理由 */' },`,
    )
    .join('\n');
  return [
    `// spIndexKnownConfig.ts の KNOWN_REQUIRED_INDEXED_FIELDS に追加してください`,
    `'${listName}': [`,
    fieldLines,
    `],`,
  ].join('\n');
}

async function copyText(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch { /* fallback */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } finally { document.body.removeChild(ta); }
}

// ── Diff summary text ─────────────────────────────────────────────────────────

interface DiffLine {
  text: string;
  kind: 'improvement' | 'regression' | 'neutral';
}

function buildDiffLines(diff: ReloadDiff): DiffLine[] {
  const lines: DiffLine[] = [];

  const indexDiff = diff.indexCountDelta;
  if (indexDiff < 0) {
    lines.push({
      text: `インデックス数 ${diff.prevSnapshot.indexCount} → ${diff.prevSnapshot.indexCount + indexDiff} に削減 (${indexDiff})`,
      kind: 'improvement',
    });
  } else if (indexDiff > 0) {
    lines.push({
      text: `インデックス数 ${diff.prevSnapshot.indexCount} → ${diff.prevSnapshot.indexCount + indexDiff} に増加 (+${indexDiff})`,
      kind: 'regression',
    });
  }

  const delDiff = diff.deletionDelta;
  if (delDiff < 0) {
    lines.push({
      text: `削除候補が ${diff.prevSnapshot.deletionCount} → ${diff.prevSnapshot.deletionCount + delDiff} に減少`,
      kind: 'improvement',
    });
  } else if (delDiff > 0) {
    lines.push({
      text: `削除候補が ${diff.prevSnapshot.deletionCount} → ${diff.prevSnapshot.deletionCount + delDiff} に増加`,
      kind: 'regression',
    });
  }

  const addDiff = diff.additionDelta;
  if (addDiff < 0) {
    lines.push({
      text: `追加候補が ${diff.prevSnapshot.additionCount} → ${diff.prevSnapshot.additionCount + addDiff} に減少`,
      kind: 'improvement',
    });
  } else if (addDiff > 0) {
    lines.push({
      text: `追加候補が ${diff.prevSnapshot.additionCount} → ${diff.prevSnapshot.additionCount + addDiff} に増加`,
      kind: 'regression',
    });
  }

  return lines;
}

// ── Component ─────────────────────────────────────────────────────────────────

// ── Remediation code → user message ──────────────────────────────────────────

const REMEDIATION_CODE_MESSAGES: Record<string, string> = {
  daily_limit_exceeded: '本日の自動修復上限（5件）に達しました。翌日以降に再試行してください。',
  duplicate_action: 'このフィールドはこのセッションですでに修復済みです。',
  delete_disabled: '削除操作はこのフェーズでは無効です。',
  update_failed: 'SharePoint 側で更新に失敗しました。管理センターを確認してください。',
  registry_not_found: 'リストがレジストリで見つかりません。設定を確認してください。',
  validation_error: 'リストまたはフィールド名が不正です。',
};

function remediationMessage(result: RemediationResult): string {
  if (result.ok) return `✅ ${result.internalName} のインデックスを追加しました。`;
  return REMEDIATION_CODE_MESSAGES[result.code] ?? result.message;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SpIndexPressurePanel({ signal }: Props) {
  const sp = useSP();
  const [expanded, setExpanded] = React.useState(true);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [copied, setCopied] = React.useState(false);
  const [reloadDiff, setReloadDiff] = React.useState<ReloadDiff | null>(null);

  // 修復アクション状態
  const [runningKey, setRunningKey] = React.useState<string | null>(null);
  const [resultMap, setResultMap] = React.useState<Record<string, RemediationResult>>({});

  // 再チェック前のスナップショット
  const prevSnapshotRef = React.useRef<IndexSnapshot | null>(null);
  // loading の前回値（true→false の遷移検知）
  const wasLoadingRef = React.useRef(false);

  const listName = signal?.reasonCode === 'sp_index_pressure' ? signal.listName : undefined;
  const isActive = signal?.reasonCode === 'sp_index_pressure';

  const { currentIndexed, deletionCandidates, additionCandidates, hasKnownConfig, loading, error } =
    useSpIndexCandidates(isActive ? listName : undefined, reloadKey);

  const currentCount = currentIndexed.length;

  // loading: true → false のタイミングで差分を確定
  React.useEffect(() => {
    const wasLoading = wasLoadingRef.current;
    wasLoadingRef.current = loading;

    if (wasLoading && !loading && !error && prevSnapshotRef.current !== null) {
      const prev = prevSnapshotRef.current;
      prevSnapshotRef.current = null;
      setReloadDiff({
        indexCountDelta: currentCount - prev.indexCount,
        deletionDelta: deletionCandidates.length - prev.deletionCount,
        additionDelta: additionCandidates.length - prev.additionCount,
        prevSnapshot: prev,
        checkedAt: new Date().toISOString(),
      });
    }
  }, [loading, error, currentCount, deletionCandidates.length, additionCandidates.length]);

  if (!isActive) return null;

  const spLimit = 20;
  const pressureLevel = currentCount >= spLimit ? 'error' : currentCount >= spLimit - 3 ? 'warning' : 'info';

  const handleReload = () => {
    // 現在の状態を「前回値」として保存してから再取得
    prevSnapshotRef.current = {
      indexCount: currentCount,
      deletionCount: deletionCandidates.length,
      additionCount: additionCandidates.length,
    };
    setReloadDiff(null);
    setReloadKey((k) => k + 1);
  };

  const handleCopyTemplate = async () => {
    const template = buildConfigTemplate(listName ?? 'UnknownList', currentIndexed);
    await copyText(template);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRemediate = async (internalName: string) => {
    if (!listName || !sp) return;
    const key = `${listName}:${internalName}:add`;
    setRunningKey(key);
    const result = await executeIndexRemediation(sp, {
      listTitle: listName,
      internalName,
      action: 'create',
    });
    setResultMap((prev) => ({ ...prev, [key]: result }));
    setRunningKey(null);
    if (result.ok) handleReload();
  };

  const diffLines = reloadDiff ? buildDiffLines(reloadDiff) : [];
  const hasImprovement = diffLines.some((l) => l.kind === 'improvement');
  const hasRegression = diffLines.some((l) => l.kind === 'regression');
  const allUnchanged = diffLines.length === 0;

  return (
    <Paper
      variant="outlined"
      sx={{
        border: '2px solid',
        borderColor: 'warning.main',
        bgcolor: 'warning.50',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ── */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2, py: 1.5, bgcolor: 'warning.light', cursor: 'pointer' }}
        onClick={() => setExpanded((p) => !p)}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            🔍 Self-Healing 候補
          </Typography>
          <Chip
            size="small"
            label="インデックス逼迫"
            color="warning"
            variant="filled"
            sx={{ fontSize: '0.7rem', height: 22 }}
          />
          {listName && (
            <Chip
              size="small"
              label={listName}
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 22 }}
            />
          )}
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center" onClick={(e) => e.stopPropagation()}>
          <Tooltip title="SP から再取得して差分を確認">
            <IconButton size="small" onClick={handleReload} disabled={loading}>
              {loading ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={() => setExpanded((p) => !p)}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Stack>
      </Stack>

      <Collapse in={expanded}>
        <Box sx={{ p: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 1 }}>
              インデックス情報の取得に失敗しました: {error}
            </Alert>
          )}

          {/* ── 再チェック差分バナー ── */}
          {reloadDiff && !loading && !error && (
            <Alert
              severity={hasImprovement ? 'success' : hasRegression ? 'error' : 'info'}
              icon={
                allUnchanged
                  ? <RemoveCircleOutlineIcon fontSize="inherit" />
                  : hasImprovement
                    ? <CheckCircleOutlineIcon fontSize="inherit" />
                    : <InfoOutlinedIcon fontSize="inherit" />
              }
              onClose={() => setReloadDiff(null)}
              sx={{ mb: 2, py: 0.5 }}
            >
              <Stack spacing={0.25}>
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>🔄 再チェック結果</span>
                  <span style={{ fontSize: '0.9em', opacity: 0.8, fontWeight: 400 }}>
                    （最終再チェック時刻: {reloadDiff.checkedAt.slice(11, 19)}）
                  </span>
                </Typography>
                {allUnchanged ? (
                  <Box>
                    <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
                      変化なし
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      SharePoint 側の変更がまだシステムに反映されていない可能性があります。
                      数分待ってから再度「再チェック」を試してください。
                    </Typography>
                  </Box>
                ) : (
                  diffLines.map((line, i) => (
                    <Typography
                      key={i}
                      variant="caption"
                      sx={{ 
                        fontWeight: 600,
                        color: line.kind === 'improvement' ? 'success.dark' : 
                               line.kind === 'regression' ? 'error.main' : 'text.primary' 
                      }}
                    >
                      {line.kind === 'improvement' ? '✅ ' : line.kind === 'regression' ? '❌ ' : '• '}
                      {line.text}
                    </Typography>
                  ))
                )}
              </Stack>
            </Alert>
          )}

          {!loading && !error && (
            <>
              {/* ── 現在の状況サマリ ── */}
              <Alert
                severity={pressureLevel}
                icon={<InfoOutlinedIcon fontSize="inherit" />}
                sx={{ mb: 2, py: 0.5 }}
              >
                {listName ? `${listName} の現在のインデックス数: ` : '現在のインデックス数: '}
                <strong>{currentCount} / {spLimit}</strong>
                {!listName && ' （リスト名不明 — シグナルに listName が含まれていません）'}
              </Alert>

              {/* ── 候補テーブル ── */}
              {hasKnownConfig ? (
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  divider={<Divider orientation="vertical" flexItem />}
                >
                  {/* 削除候補 */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="subtitle2" color="error.main" sx={{ fontWeight: 700 }}>
                        🗑 削除候補
                      </Typography>
                      <Chip
                        size="small"
                        label={deletionCandidates.length}
                        color={deletionCandidates.length > 0 ? 'error' : 'default'}
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.65rem' }}
                      />
                      <Tooltip title="必須セットに含まれないインデックス済みフィールド。削除するとインデックススロットを解放できます。">
                        <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      </Tooltip>
                    </Stack>
                    {deletionCandidates.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        削除候補なし（全フィールドが必須セットに含まれています）
                      </Typography>
                    ) : (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600, fontSize: '0.72rem', width: '35%' }}>
                              フィールド名
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '0.72rem', width: '20%' }}>
                              型
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '0.72rem' }}>
                              候補理由
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {deletionCandidates.map((f) => (
                            <TableRow key={f.internalName}>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                                  {f.internalName}
                                </Typography>
                                {f.displayName !== f.internalName && (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                    {f.displayName}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  label={f.typeAsString}
                                  variant="outlined"
                                  sx={{ fontSize: '0.65rem', height: 20 }}
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption" color="text.secondary">
                                  {f.deletionReason}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </Box>

                  {/* 追加候補 */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="subtitle2" color="success.dark" sx={{ fontWeight: 700 }}>
                        ➕ 追加候補
                      </Typography>
                      <Chip
                        size="small"
                        label={additionCandidates.length}
                        color={additionCandidates.length > 0 ? 'warning' : 'default'}
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.65rem' }}
                      />
                      <Tooltip title="必須セットに定義されているが SP にインデックスがないフィールド。追加するとクエリ性能が改善します。">
                        <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      </Tooltip>
                    </Stack>
                    {additionCandidates.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        追加候補なし（必須インデックスはすべて設定済みです）
                      </Typography>
                    ) : (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600, fontSize: '0.72rem', width: '35%' }}>
                              フィールド名
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '0.72rem' }}>
                              必要な理由（クエリ/機能）
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '0.72rem', width: '110px' }}>
                              修復
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {additionCandidates.map((f) => {
                            const rowKey = `${listName}:${f.internalName}:add`;
                            const rowResult = resultMap[rowKey];
                            const isRunning = runningKey === rowKey;
                            return (
                              <TableRow key={f.internalName}>
                                <TableCell>
                                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                                    {f.internalName}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                    {f.displayName}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="caption" color="text.secondary">
                                    {f.reason}
                                  </Typography>
                                  {rowResult && (
                                    <Typography
                                      variant="caption"
                                      sx={{ display: 'block', mt: 0.5, fontWeight: 600,
                                        color: rowResult.ok ? 'success.dark' : 'error.main' }}
                                    >
                                      {remediationMessage(rowResult)}
                                    </Typography>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Tooltip title={rowResult?.ok ? '修復済み' : 'インデックスを追加'}>
                                    <span>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        color={rowResult?.ok ? 'success' : 'primary'}
                                        disabled={!!runningKey || rowResult?.ok === true || !listName}
                                        onClick={() => handleRemediate(f.internalName)}
                                        startIcon={isRunning
                                          ? <CircularProgress size={12} color="inherit" />
                                          : <BuildIcon fontSize="inherit" />}
                                        sx={{ fontSize: '0.7rem', py: 0.25, minWidth: 0 }}
                                      >
                                        {rowResult?.ok ? '完了' : 'インデックス追加'}
                                      </Button>
                                    </span>
                                  </Tooltip>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </Box>
                </Stack>
              ) : (
                /* 既知設定なし → 現在のインデックス一覧 + テンプレートコピー */
                <Box>
                  <Alert
                    severity="info"
                    sx={{ mb: 1.5 }}
                    action={
                      currentIndexed.length > 0 ? (
                        <Button
                          size="small"
                          startIcon={<ContentCopyIcon fontSize="inherit" />}
                          onClick={handleCopyTemplate}
                          color={copied ? 'success' : 'info'}
                        >
                          {copied ? 'コピー済み' : '設定テンプレートをコピー'}
                        </Button>
                      ) : undefined
                    }
                  >
                    <strong>{listName ?? '不明'}</strong> の必須インデックスセットは未定義です。
                    {' '}「設定テンプレートをコピー」で <code>spIndexKnownConfig.ts</code> 用の雛形を取得できます。
                    <br />
                    <Typography variant="caption" color="text.secondary">
                      ヒント: 各フィールドの <code>reason</code> に「$filter=X eq Y（機能名）」を記入すると追加候補の説明が充実します
                    </Typography>
                  </Alert>
                  {currentIndexed.length > 0 && (
                    <>
                      <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                        現在のインデックス済みフィールド（{currentIndexed.length}件）
                      </Typography>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600, fontSize: '0.72rem', width: '35%' }}>
                              フィールド名
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '0.72rem', width: '20%' }}>
                              型
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '0.72rem' }}>
                              削除候補の可能性（参考）
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {currentIndexed.map((f) => (
                            <TableRow key={f.internalName}>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                                  {f.internalName}
                                </Typography>
                                {f.displayName !== f.internalName && (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                    {f.displayName}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  label={f.typeAsString}
                                  variant="outlined"
                                  sx={{ fontSize: '0.65rem', height: 20 }}
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption" color="text.secondary">
                                  {f.deletionReason}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  )}
                </Box>
              )}

              {/* ── 注意事項 ── */}
              <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary">
                  ⚠️ これは提案です。実際の変更は SharePoint 管理センターで行ってください。
                  インデックス削除は <strong>$filter クエリのパフォーマンス低下</strong> を招く可能性があります。
                  変更後はヘッダーの再チェックボタン（↻）で差分を確認してください。
                </Typography>
              </Box>
            </>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}
