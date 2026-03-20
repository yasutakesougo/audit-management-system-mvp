/**
 * PdcaCycleBoard — PDCA 4列サイクルボード
 *
 * PDCA アイテムを Plan / Do / Check / Act の 4 列に振り分けて表示する。
 * 各カードはタイトル・概要・更新日・逆引きトレースを表示し、
 * 編集・削除のアクションを持つ。
 *
 * @module features/ibd/analysis/pdca/components/PdcaCycleBoard
 */

import * as React from 'react';
import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';

import type { IcebergPdcaItem, IcebergPdcaPhase } from '../types';
import { PdcaReverseTraceSection } from './PdcaReverseTraceSection';

// ════════════════════════════════════════════════
// Column metadata
// ════════════════════════════════════════════════

interface ColumnMeta {
  key: IcebergPdcaPhase;
  label: string;
  sublabel: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
}

const COLUMNS: ColumnMeta[] = [
  {
    key: 'PLAN',
    label: 'Plan',
    sublabel: '計画',
    color: '#1565c0',
    bgColor: '#e3f2fd',
    icon: <FlagRoundedIcon sx={{ fontSize: 18 }} />,
  },
  {
    key: 'DO',
    label: 'Do',
    sublabel: '実行',
    color: '#2e7d32',
    bgColor: '#e8f5e9',
    icon: <PlayArrowRoundedIcon sx={{ fontSize: 18 }} />,
  },
  {
    key: 'CHECK',
    label: 'Check',
    sublabel: '確認',
    color: '#e65100',
    bgColor: '#fff3e0',
    icon: <FactCheckRoundedIcon sx={{ fontSize: 18 }} />,
  },
  {
    key: 'ACT',
    label: 'Act',
    sublabel: '改善',
    color: '#6a1b9a',
    bgColor: '#f3e5f5',
    icon: <AutorenewRoundedIcon sx={{ fontSize: 18 }} />,
  },
];

// ════════════════════════════════════════════════
// Phase advance mapping (forward-only)
// ════════════════════════════════════════════════

const NEXT_PHASE: Partial<Record<IcebergPdcaPhase, IcebergPdcaPhase>> = {
  PLAN: 'DO',
  DO: 'CHECK',
  CHECK: 'ACT',
  // ACT has no next — it's the final stage
};

const ADVANCE_LABEL: Partial<Record<IcebergPdcaPhase, string>> = {
  PLAN: 'Doへ進める',
  DO: 'Checkへ進める',
  CHECK: 'Actへ進める',
};

/** Find the color of the next phase for the advance button */
function nextPhaseColor(phase: IcebergPdcaPhase): string {
  const next = NEXT_PHASE[phase];
  if (!next) return '#666';
  return COLUMNS.find((c) => c.key === next)?.color ?? '#666';
}

// ════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════

/** 日付文字列から "3/19" のような短い月日表示へ */
function shortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch {
    return iso.slice(5, 10);
  }
}

/** 日時を "3/19 14:12" のように表示 */
function shortDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return iso.slice(5, 16);
  }
}

/** Phase short labels for trace display */
const PHASE_SHORT: Record<IcebergPdcaPhase, string> = {
  PLAN: 'Plan',
  DO: 'Do',
  CHECK: 'Check',
  ACT: 'Act',
};

/** stalled = 7日以上更新がないかどうか */
function isStalled(item: IcebergPdcaItem): boolean {
  const diff = Date.now() - new Date(item.updatedAt).getTime();
  return diff > 7 * 24 * 60 * 60 * 1000;
}

// ════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════

export interface PdcaCycleBoardProps {
  items: IcebergPdcaItem[];
  canWrite: boolean;
  isMutating: boolean;
  onStartEdit: (item: IcebergPdcaItem) => void;
  onDelete: (item: IcebergPdcaItem) => void;
  /** カードから次フェーズへ進めるコールバック */
  onAdvancePhase?: (item: IcebergPdcaItem, nextPhase: IcebergPdcaPhase) => void;
  /** ACT → 支援計画モニタリング導線 */
  onNavigateToMonitoring?: (userId: string) => void;
  /** ディープリンクハイライト */
  highlightPdcaId?: string;
  source?: string;
}

// ════════════════════════════════════════════════
// Card Component
// ════════════════════════════════════════════════

interface CardProps {
  item: IcebergPdcaItem;
  column: ColumnMeta;
  canWrite: boolean;
  isMutating: boolean;
  onEdit: () => void;
  onDel: () => void;
  onAdvance?: () => void;
  onMonitor?: () => void;
  isHighlighted: boolean;
}

const PdcaCard: React.FC<CardProps> = ({
  item,
  column,
  canWrite,
  isMutating,
  onEdit,
  onDel,
  onAdvance,
  onMonitor,
  isHighlighted,
}) => {
  const stalled = isStalled(item);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderLeftWidth: 3,
        borderLeftColor: column.color,
        transition: 'box-shadow 0.2s, border-color 0.2s',
        '&:hover': {
          boxShadow: 2,
        },
        ...(isHighlighted && {
          borderColor: 'primary.main',
          borderWidth: 2,
          bgcolor: 'primary.50',
          animation: 'highlightPulse 2s ease-in-out',
          '@keyframes highlightPulse': {
            '0%': { boxShadow: '0 0 0 0 rgba(25,118,210,0.4)' },
            '50%': { boxShadow: '0 0 0 6px rgba(25,118,210,0.0)' },
            '100%': { boxShadow: '0 0 0 0 rgba(25,118,210,0.0)' },
          },
        }),
        ...(stalled && !isHighlighted && {
          borderLeftColor: '#f44336',
        }),
      }}
    >
      {/* Title + stalled badge */}
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 600,
            fontSize: '0.82rem',
            lineHeight: 1.3,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {item.title}
        </Typography>
        {stalled && (
          <Tooltip title="7日以上更新なし">
            <Chip
              label="停滞"
              size="small"
              color="error"
              variant="outlined"
              sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }}
            />
          </Tooltip>
        )}
      </Stack>

      {/* Summary (truncated) */}
      {item.summary && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.35,
            mb: 0.75,
          }}
        >
          {item.summary}
        </Typography>
      )}

      {/* Date */}
      <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
        更新 {shortDate(item.updatedAt)}
      </Typography>

      {/* Phase change trace */}
      {item.lastPhaseChange && (
        <Tooltip
          title={`${item.lastPhaseChange.by} が ${shortDateTime(item.lastPhaseChange.at)} に変更`}
          arrow
          placement="top"
        >
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.5}
            sx={{
              mt: 0.5,
              px: 0.75,
              py: 0.25,
              bgcolor: 'action.hover',
              borderRadius: 0.75,
              cursor: 'default',
            }}
          >
            <ArrowForwardRoundedIcon sx={{ fontSize: 10, color: 'text.disabled' }} />
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.6rem',
                color: 'text.secondary',
                fontWeight: 600,
                lineHeight: 1,
              }}
            >
              {PHASE_SHORT[item.lastPhaseChange.from]} → {PHASE_SHORT[item.lastPhaseChange.to]}
            </Typography>
            <Typography
              variant="caption"
              sx={{ fontSize: '0.55rem', color: 'text.disabled', lineHeight: 1 }}
            >
              {shortDateTime(item.lastPhaseChange.at)} / {item.lastPhaseChange.by}
            </Typography>
          </Stack>
        </Tooltip>
      )}

      {/* Reverse trace */}
      <PdcaReverseTraceSection pdcaItemId={item.id} />

      {/* Actions */}
      {canWrite && (
        <Stack spacing={0.5} sx={{ mt: 1 }}>
          {/* Phase advance button — prominent, full-width */}
          {onAdvance && (
            <Button
              size="small"
              variant="outlined"
              onClick={onAdvance}
              disabled={isMutating}
              startIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 14 }} />}
              sx={{
                fontSize: '0.7rem',
                fontWeight: 600,
                textTransform: 'none',
                borderColor: nextPhaseColor(item.phase),
                color: nextPhaseColor(item.phase),
                '&:hover': {
                  bgcolor: `${nextPhaseColor(item.phase)}10`,
                  borderColor: nextPhaseColor(item.phase),
                },
              }}
            >
              {ADVANCE_LABEL[item.phase]}
            </Button>
          )}

          {/* Secondary actions */}
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="編集">
              <Button
                size="small"
                variant="text"
                onClick={onEdit}
                disabled={isMutating}
                sx={{ minWidth: 0, px: 0.75 }}
              >
                <EditRoundedIcon sx={{ fontSize: 16 }} />
              </Button>
            </Tooltip>
            <Tooltip title="削除">
              <Button
                size="small"
                variant="text"
                color="error"
                onClick={onDel}
                disabled={isMutating}
                sx={{ minWidth: 0, px: 0.75 }}
              >
                <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
              </Button>
            </Tooltip>
            {item.phase === 'ACT' && onMonitor && item.userId && (
              <Tooltip title="支援計画に反映">
                <Button
                  size="small"
                  variant="text"
                  color="success"
                  onClick={onMonitor}
                  disabled={isMutating}
                  sx={{ minWidth: 0, px: 0.75 }}
                >
                  <AssignmentTurnedInIcon sx={{ fontSize: 16 }} />
                </Button>
              </Tooltip>
            )}
          </Stack>
        </Stack>
      )}
    </Paper>
  );
};

// ════════════════════════════════════════════════
// Board Component
// ════════════════════════════════════════════════

export const PdcaCycleBoard: React.FC<PdcaCycleBoardProps> = ({
  items,
  canWrite,
  isMutating,
  onStartEdit,
  onDelete,
  onAdvancePhase,
  onNavigateToMonitoring,
  highlightPdcaId,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Stalled filter state
  const [stalledOnly, setStalledOnly] = React.useState(false);
  const stalledCount = React.useMemo(() => items.filter(isStalled).length, [items]);

  // Group items by phase (with optional stalled filter)
  const grouped = React.useMemo(() => {
    const filtered = stalledOnly ? items.filter(isStalled) : items;
    const map: Record<IcebergPdcaPhase, IcebergPdcaItem[]> = {
      PLAN: [],
      DO: [],
      CHECK: [],
      ACT: [],
    };
    for (const item of filtered) {
      (map[item.phase] ??= []).push(item);
    }
    // Sort each column by updatedAt desc
    for (const key of Object.keys(map) as IcebergPdcaPhase[]) {
      map[key].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    return map;
  }, [items, stalledOnly]);

  const [showHighlight, setShowHighlight] = React.useState(!!highlightPdcaId);
  const highlightRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (highlightPdcaId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightPdcaId, items]);

  React.useEffect(() => {
    if (!highlightPdcaId) return;
    setShowHighlight(true);
    const timer = setTimeout(() => setShowHighlight(false), 4000);
    return () => clearTimeout(timer);
  }, [highlightPdcaId]);

  if (items.length === 0) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 4,
          textAlign: 'center',
          bgcolor: 'grey.50',
          borderStyle: 'dashed',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          PDCA項目はまだありません。上のフォームから作成してください。
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      {/* ── Stalled filter ── */}
      {stalledCount > 0 && (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1, mb: 0.5 }}>
          <Chip
            icon={<FilterListRoundedIcon sx={{ fontSize: 16 }} />}
            label={`停滞のみ表示 (${stalledCount})`}
            size="small"
            variant={stalledOnly ? 'filled' : 'outlined'}
            color={stalledOnly ? 'error' : 'default'}
            onClick={() => setStalledOnly((prev) => !prev)}
            sx={{
              fontWeight: 600,
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          />
        </Stack>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
          gap: 1.5,
          mt: 1,
        }}
      >
      {COLUMNS.map((col) => {
        const colItems = grouped[col.key];

        return (
          <Box key={col.key}>
            {/* Column header */}
            <Paper
              elevation={0}
              sx={{
                px: 1.5,
                py: 1,
                mb: 1,
                bgcolor: col.bgColor,
                borderRadius: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
              }}
            >
              <Box sx={{ color: col.color, display: 'flex' }}>{col.icon}</Box>
              <Typography variant="subtitle2" sx={{ color: col.color, fontWeight: 700, flex: 1 }}>
                {col.label}
              </Typography>
              <Typography variant="subtitle2" sx={{ color: col.color, fontSize: '0.7rem' }}>
                {col.sublabel}
              </Typography>
              <Chip
                label={colItems.length}
                size="small"
                sx={{
                  height: 20,
                  minWidth: 24,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  bgcolor: col.color,
                  color: '#fff',
                }}
              />
            </Paper>

            {/* Cards */}
            <Stack spacing={1}>
              {colItems.map((item) => {
                const isHighlighted = showHighlight && item.id === highlightPdcaId;
                return (
                  <Box
                    key={item.id}
                    ref={item.id === highlightPdcaId ? highlightRef : undefined}
                  >
                    <PdcaCard
                      item={item}
                      column={col}
                      canWrite={canWrite}
                      isMutating={isMutating}
                      onEdit={() => onStartEdit(item)}
                      onDel={() => onDelete(item)}
                      onAdvance={
                        onAdvancePhase && NEXT_PHASE[item.phase]
                          ? () => onAdvancePhase(item, NEXT_PHASE[item.phase]!)
                          : undefined
                      }
                      onMonitor={
                        onNavigateToMonitoring && item.userId
                          ? () => onNavigateToMonitoring(item.userId)
                          : undefined
                      }
                      isHighlighted={isHighlighted}
                    />
                  </Box>
                );
              })}

              {/* Empty column placeholder */}
              {colItems.length === 0 && (
                <Box
                  sx={{
                    py: 3,
                    textAlign: 'center',
                    border: '1px dashed',
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="caption" color="text.disabled">
                    {stalledOnly ? '停滞なし' : '項目なし'}
                  </Typography>
                </Box>
              )}
            </Stack>
          </Box>
        );
      })}
      </Box>
    </Box>
  );
};
