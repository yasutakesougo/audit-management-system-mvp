/**
 * FindingsTable — 統合 findings テーブル
 *
 * フィルタリング・ソートは useMemo で行い、state は持たない。
 */
import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';

import type { FindingEvidenceSummary } from '@/domain/regulatory/findingEvidenceSummary';
import { type AuditFindingSeverity, SEVERITY_CONFIG, type UnifiedFindingRow, buildRowActions } from './types';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface FindingsTableProps {
  rows: UnifiedFindingRow[];
  filterSeverity: AuditFindingSeverity | 'all';
  filterSource: 'all' | 'regular' | 'addon';
  filterDomain: 'all' | 'isp' | 'sheet';
  onNavigate: (url: string) => void;
  evidenceMap?: Map<string, FindingEvidenceSummary>;
  onSendToHandoff?: (row: UnifiedFindingRow) => void;
  sentFindingKeys?: Set<string>;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export const FindingsTable: React.FC<FindingsTableProps> = ({ rows, filterSeverity, filterSource, filterDomain, onNavigate, evidenceMap, onSendToHandoff, sentFindingKeys }) => {
  const filtered = useMemo(() => {
    let result = [...rows];
    if (filterSource !== 'all') result = result.filter(r => r.source === filterSource);
    if (filterSeverity !== 'all') result = result.filter(r => r.severity === filterSeverity);
    if (filterDomain !== 'all') result = result.filter(r => r.domain === filterDomain);
    // severity 順: high → medium → low
    const order: Record<AuditFindingSeverity, number> = { high: 0, medium: 1, low: 2 };
    result.sort((a, b) => order[a.severity] - order[b.severity]);
    return result;
  }, [rows, filterSeverity, filterSource, filterDomain]);

  if (filtered.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <CheckCircleOutlineIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
        <Typography variant="h6" color="text.secondary">
          該当する検出事項はありません
        </Typography>
        <Typography variant="body2" color="text.secondary">
          すべての制度要件が充足されています
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'grey.50' }}>
            <TableCell sx={{ fontWeight: 700, width: 60 }}>重要度</TableCell>
            <TableCell sx={{ fontWeight: 700, width: 90 }}>領域</TableCell>
            <TableCell sx={{ fontWeight: 700, width: 160 }}>検出種別</TableCell>
            <TableCell sx={{ fontWeight: 700, width: 100 }}>利用者</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>メッセージ</TableCell>
            <TableCell sx={{ fontWeight: 700, width: 120 }}>期限</TableCell>
            <TableCell sx={{ fontWeight: 700, width: 180 }}>対応</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filtered.map(row => {
            const cfg = SEVERITY_CONFIG[row.severity];
            const actions = buildRowActions(row);
            return (
              <TableRow key={row.id} hover>
                <TableCell>
                  <Chip
                    icon={cfg.icon as React.ReactElement}
                    label={cfg.label}
                    color={cfg.color}
                    size="small"
                    variant="filled"
                    sx={{ fontWeight: 700 }}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={row.domain === 'sheet' ? '支援計画シート' : '個別支援計画'}
                    size="small"
                    variant="outlined"
                    color={row.domain === 'sheet' ? 'secondary' : 'default'}
                    sx={{ fontWeight: 600, fontSize: '0.65rem' }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>
                    {row.typeLabel}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {row.userName || row.userId}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {row.message}
                  </Typography>
                  {/* 根拠サマリーインライン表示（regular findings のみ） */}
                  {evidenceMap?.has(row.id) && (() => {
                    const ev = evidenceMap.get(row.id)!;
                    if (!ev.displayText) return null;
                    return (
                      <Typography
                        variant="caption"
                        data-testid={`evidence-summary-${row.id}`}
                        sx={{
                          display: 'block',
                          mt: 0.5,
                          color: ev.hasEvidence ? 'success.main' : 'warning.main',
                          fontWeight: 600,
                          fontSize: '0.65rem',
                        }}
                      >
                        {ev.hasEvidence ? '📊 ' : '⚠ '}
                        {ev.displayText}
                      </Typography>
                    );
                  })()}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color={row.overdueDays && row.overdueDays < 0 ? 'error.main' : 'text.secondary'}>
                    {row.dueDate || '—'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {actions.map((action, i) => (
                      <Button
                        key={i}
                        size="small"
                        variant={action.kind === 'execute' || action.kind === 'review' ? 'contained' : 'outlined'}
                        color={
                          action.kind === 'execute' || action.kind === 'review' ? 'primary'
                            : action.kind === 'evidence' ? 'secondary'
                            : 'inherit'
                        }
                        startIcon={
                          action.kind === 'evidence'
                            ? <PsychologyRoundedIcon sx={{ fontSize: 14 }} />
                            : <OpenInNewRoundedIcon sx={{ fontSize: 14 }} />
                        }
                        onClick={() => onNavigate(action.url)}
                        sx={{
                          fontSize: '0.7rem',
                          textTransform: 'none',
                          py: 0.25,
                          px: 1,
                          minWidth: 'auto',
                        }}
                      >
                        {action.label}
                      </Button>
                    ))}
                    {onSendToHandoff && (() => {
                      const findingKey = row.source === 'addon'
                        ? `severe-addon-finding:${row.id}`
                        : `regulatory-finding:${row.id}`;
                      const isSent = sentFindingKeys?.has(findingKey) ?? false;
                      return (
                        <Button
                          size="small"
                          variant="outlined"
                          color="info"
                          disabled={isSent}
                          data-testid={`send-to-handoff-${row.id}`}
                          startIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 14 }} />}
                          onClick={() => onSendToHandoff(row)}
                          sx={{
                            fontSize: '0.7rem',
                            textTransform: 'none',
                            py: 0.25,
                            px: 1,
                            minWidth: 'auto',
                          }}
                        >
                          {isSent ? '送信済' : '申し送りへ'}
                        </Button>
                      );
                    })()}
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
