/**
 * @fileoverview 保存済みドラフト履歴パネル
 * @description
 * Phase 5-E1:
 *   SupportPlanningSheet_Master に保存された判断レコードを
 *   バッチ単位（保存日時グループ）で一覧表示する。
 *
 * 責務:
 * - 保存済みレコードをバッチグルーピング
 * - 日時・ステータス要約の表示
 * - 最新バッジ表示
 * - 選択バッチの展開 → 詳細表示 → ISP エディタへ再反映
 *
 * 依存:
 * - SupportPlanningSheetRecord
 * - ispDraftFieldMapping (再反映用)
 */
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HistoryIcon from '@mui/icons-material/History';
import PublishIcon from '@mui/icons-material/Publish';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { SupportPlanningSheetRecord } from '../domain/supportPlanningSheetTypes';
import type { DecisionStatus } from '../domain/ispRecommendationDecisionTypes';

// ─── 定数 ───────────────────────────────────────────────

/** 同一バッチとみなす最大差分（ミリ秒） — 60 秒 */
const BATCH_THRESHOLD_MS = 60_000;

const STATUS_LABELS: Record<DecisionStatus, string> = {
  accepted: '採用',
  dismissed: '見送り',
  deferred: '保留',
  pending: '未判断',
};

const STATUS_COLORS: Record<DecisionStatus, 'success' | 'error' | 'warning' | 'default'> = {
  accepted: 'success',
  dismissed: 'error',
  deferred: 'warning',
  pending: 'default',
};

// ─── バッチグルーピング ──────────────────────────────────

export interface DraftBatch {
  /** バッチ ID（先頭レコードの decisionAt） */
  batchId: string;
  /** バッチ内のレコード群 */
  records: SupportPlanningSheetRecord[];
  /** バッチの代表日時 (ISO) */
  batchAt: string;
  /** ステータス別件数 */
  statusCounts: Record<DecisionStatus, number>;
  /** バッチ内の全目標名 */
  goalLabels: string[];
}

/**
 * レコード群を保存日時の近さでバッチに分割する。
 * decisionAt の差が BATCH_THRESHOLD_MS 以下なら同一バッチとみなす。
 */
export function groupRecordsIntoBatches(
  records: SupportPlanningSheetRecord[],
): DraftBatch[] {
  if (records.length === 0) return [];

  // 降順ソート済みの前提（Hook が保証）
  const sorted = [...records].sort(
    (a, b) => new Date(b.decisionAt).getTime() - new Date(a.decisionAt).getTime(),
  );

  const batches: DraftBatch[] = [];
  let currentBatch: SupportPlanningSheetRecord[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].decisionAt).getTime();
    const curr = new Date(sorted[i].decisionAt).getTime();
    if (prev - curr <= BATCH_THRESHOLD_MS) {
      currentBatch.push(sorted[i]);
    } else {
      batches.push(buildBatch(currentBatch));
      currentBatch = [sorted[i]];
    }
  }
  batches.push(buildBatch(currentBatch));

  return batches;
}

function buildBatch(records: SupportPlanningSheetRecord[]): DraftBatch {
  const statusCounts: Record<DecisionStatus, number> = {
    accepted: 0, dismissed: 0, deferred: 0, pending: 0,
  };
  const goalLabels: string[] = [];

  for (const r of records) {
    statusCounts[r.decisionStatus]++;
    if (r.goalLabel && !goalLabels.includes(r.goalLabel)) {
      goalLabels.push(r.goalLabel);
    }
  }

  return {
    batchId: records[0].decisionAt,
    records,
    batchAt: records[0].decisionAt,
    statusCounts,
    goalLabels,
  };
}

// ─── 日時フォーマット ────────────────────────────────────

function formatBatchDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ja-JP', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'たった今';
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}日前`;
  return formatBatchDate(iso);
}

// ─── Props ──────────────────────────────────────────────

export interface DraftHistoryPanelProps {
  /** 保存済みレコード一覧（降順前提） */
  records: SupportPlanningSheetRecord[];
  /** 再反映コールバック: バッチ内の全レコードのスナップショットを ISP エディタへ渡す */
  onReapply?: (batch: DraftBatch) => void;
}

// ─── メインコンポーネント ────────────────────────────────

const DraftHistoryPanel: React.FC<DraftHistoryPanelProps> = ({
  records,
  onReapply,
}) => {
  const [justCopied, setJustCopied] = React.useState<string | null>(null);
  const [justReapplied, setJustReapplied] = React.useState<string | null>(null);

  const batches = React.useMemo(() => groupRecordsIntoBatches(records), [records]);

  const handleCopy = React.useCallback((batch: DraftBatch) => {
    const lines: string[] = [];
    lines.push(`保存日時: ${formatBatchDate(batch.batchAt)}`);
    lines.push(`判断件数: ${batch.records.length}件`);
    lines.push('');
    for (const r of batch.records) {
      lines.push(`【${r.goalLabel}】 ${STATUS_LABELS[r.decisionStatus]}`);
      if (r.decisionNote) lines.push(`  判断メモ: ${r.decisionNote}`);
      if (r.snapshot.reason) lines.push(`  理由: ${r.snapshot.reason}`);
      lines.push('');
    }
    void navigator.clipboard.writeText(lines.join('\n'));
    setJustCopied(batch.batchId);
    setTimeout(() => setJustCopied(null), 3000);
  }, []);

  const handleReapply = React.useCallback((batch: DraftBatch) => {
    onReapply?.(batch);
    setJustReapplied(batch.batchId);
    setTimeout(() => setJustReapplied(null), 3000);
  }, [onReapply]);

  if (batches.length === 0) {
    return (
      <Box sx={{ py: 2, px: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <HistoryIcon fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary">
            保存済みのドラフトはありません
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <HistoryIcon fontSize="small" color="action" />
        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
          保存済みドラフト履歴
        </Typography>
        <Chip
          label={`${batches.length}件`}
          size="small"
          variant="outlined"
          color="primary"
        />
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        過去に保存した個別支援計画の判断ドラフトです。展開して詳細を確認し、再反映できます。
      </Typography>

      <Stack spacing={0.5}>
        {batches.map((batch, idx) => (
          <Accordion
            key={batch.batchId}
            disableGutters
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: idx === 0 ? 'primary.main' : 'divider',
              borderRadius: '8px !important',
              '&::before': { display: 'none' },
              overflow: 'hidden',
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                minHeight: 48,
                '& .MuiAccordionSummary-content': { my: 0.5 },
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                flexWrap="wrap"
                rowGap={0.5}
                sx={{ width: '100%' }}
              >
                {idx === 0 && (
                  <Chip label="最新" size="small" color="primary" />
                )}

                <Typography variant="body2" sx={{ fontWeight: idx === 0 ? 600 : 400 }}>
                  {formatBatchDate(batch.batchAt)}
                </Typography>

                <Typography variant="caption" color="text.secondary">
                  ({relativeTime(batch.batchAt)})
                </Typography>

                <Chip
                  label={`${batch.records.length}目標`}
                  size="small"
                  variant="outlined"
                />

                {/* ステータスチップ */}
                {(Object.entries(batch.statusCounts) as [DecisionStatus, number][])
                  .filter(([, count]) => count > 0)
                  .map(([status, count]) => (
                    <Chip
                      key={status}
                      label={`${STATUS_LABELS[status]} ${count}`}
                      size="small"
                      color={STATUS_COLORS[status]}
                      variant="outlined"
                    />
                  ))}
              </Stack>
            </AccordionSummary>

            <AccordionDetails sx={{ pt: 0 }}>
              <Divider sx={{ mb: 1 }} />

              {/* 各レコード詳細 */}
              <Stack spacing={1}>
                {batch.records.map((r) => (
                  <Box
                    key={r.id}
                    sx={{
                      p: 1,
                      borderRadius: 1,
                      bgcolor: 'action.hover',
                      fontSize: '0.8rem',
                    }}
                  >
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {r.goalLabel}
                      </Typography>
                      <Chip
                        label={STATUS_LABELS[r.decisionStatus]}
                        size="small"
                        color={STATUS_COLORS[r.decisionStatus]}
                      />
                    </Stack>

                    {r.decisionNote && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        判断メモ: {r.decisionNote}
                      </Typography>
                    )}

                    {r.snapshot.reason && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        📋 理由: {r.snapshot.reason}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Stack>

              {/* アクションボタン */}
              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                {onReapply && (
                  <Tooltip title="このドラフトの判断内容を個別支援計画書へ反映します">
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={
                        justReapplied === batch.batchId
                          ? <CheckCircleOutlineIcon />
                          : <PublishIcon />
                      }
                      color={justReapplied === batch.batchId ? 'success' : 'primary'}
                      onClick={() => handleReapply(batch)}
                    >
                      {justReapplied === batch.batchId ? '反映しました' : '個別支援計画書へ再反映'}
                    </Button>
                  </Tooltip>
                )}

                <Tooltip title="クリップボードへコピー">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={
                      justCopied === batch.batchId
                        ? <CheckCircleOutlineIcon />
                        : <ContentCopyRoundedIcon />
                    }
                    color={justCopied === batch.batchId ? 'success' : 'inherit'}
                    onClick={() => handleCopy(batch)}
                  >
                    {justCopied === batch.batchId ? 'コピーしました' : '全文コピー'}
                  </Button>
                </Tooltip>
              </Stack>
            </AccordionDetails>
          </Accordion>
        ))}
      </Stack>
    </Box>
  );
};

export default React.memo(DraftHistoryPanel);
