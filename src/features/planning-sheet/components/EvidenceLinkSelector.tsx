/**
 * EvidenceLinkSelector — 支援戦略に紐づくABC/PDCA根拠を選択するUI
 *
 * 各戦略セクション（先行事象/教授/後続事象）の直下に配置し、
 * ユーザーが蓄積されたABC記録やPDCA項目を根拠として選択できる。
 *
 * @module features/planning-sheet/components/EvidenceLinkSelector
 */

import * as React from 'react';
import {
  Autocomplete,
  Box,
  Chip,
  Collapse,
  Divider,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import BubbleChartRoundedIcon from '@mui/icons-material/BubbleChartRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';

import type { EvidenceLink, EvidenceLinkType } from '@/domain/isp/evidenceLink';
import type { AbcRecord } from '@/domain/abc/abcRecord';
import type { IcebergPdcaItem } from '@/features/ibd/analysis/pdca/types';

// ── Types ──

interface EvidenceLinkSelectorProps {
  /** 戦略セクションの日本語ラベル */
  sectionLabel: string;
  /** 現在紐づいている根拠リンク */
  links: EvidenceLink[];
  /** 紐づけ変更時のコールバック */
  onChange: (links: EvidenceLink[]) => void;
  /** 利用可能なABC記録 */
  abcRecords: AbcRecord[];
  /** 利用可能なPDCA項目 */
  pdcaItems: IcebergPdcaItem[];
  /** 読み取り専用モード */
  readOnly?: boolean;
  /** 根拠チップクリック時のコールバック（遷移導線用） */
  onEvidenceClick?: (type: EvidenceLinkType, referenceId: string) => void;
}

interface EvidenceOption {
  type: EvidenceLinkType;
  id: string;
  label: string;
  detail: string;
  isValidated?: boolean;
}

// ── Constants ──

const SECTION_LABELS: Record<EvidenceLinkType, { icon: React.ReactNode; label: string; color: string }> = {
  abc: { icon: <EditNoteRoundedIcon fontSize="inherit" />, label: 'ABC', color: '#4caf50' },
  pdca: { icon: <BubbleChartRoundedIcon fontSize="inherit" />, label: 'PDCA', color: '#2196f3' },
};

const ABC_INTENSITY: Record<string, string> = { low: '軽度', medium: '中度', high: '重度' };

// ── Helpers ──

function buildOptions(abcRecords: AbcRecord[], pdcaItems: IcebergPdcaItem[]): EvidenceOption[] {
  const opts: EvidenceOption[] = [];

  for (const r of abcRecords) {
    const d = new Date(r.occurredAt);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
    opts.push({
      type: 'abc',
      id: r.id,
      label: `[ABC] ${dateStr} ${r.behavior.slice(0, 20)}`,
      detail: `${r.setting || '—'} / ${ABC_INTENSITY[r.intensity] || r.intensity}${r.riskFlag ? ' ⚠' : ''}`,
    });
  }

  for (const p of pdcaItems) {
    opts.push({
      type: 'pdca',
      id: p.id,
      label: `[PDCA] ${p.title.slice(0, 25)}`,
      detail: `Phase: ${p.phase}${p.isValidated ? ' (検証済み)' : ''}`,
      isValidated: p.isValidated,
    });
  }

  // Sort: Validated first, then by type, then by label
  return opts.sort((a, b) => {
    if (a.isValidated && !b.isValidated) return -1;
    if (!a.isValidated && b.isValidated) return 1;
    return 0;
  });
}

function getChipColor(type: EvidenceLinkType): 'success' | 'info' {
  return type === 'abc' ? 'success' : 'info';
}

// ── Component ──

export const EvidenceLinkSelector: React.FC<EvidenceLinkSelectorProps> = ({
  sectionLabel,
  links,
  onChange,
  abcRecords,
  pdcaItems,
  readOnly = false,
  onEvidenceClick,
}) => {
  const [expanded, setExpanded] = React.useState(links.length > 0);
  const options = React.useMemo(() => buildOptions(abcRecords, pdcaItems), [abcRecords, pdcaItems]);

  const linkedIds = React.useMemo(() => new Set(links.map(l => l.referenceId)), [links]);
  const availableOptions = React.useMemo(
    () => options.filter(o => !linkedIds.has(o.id)),
    [options, linkedIds],
  );

  const handleAdd = React.useCallback((_: unknown, option: EvidenceOption | null) => {
    if (!option) return;
    const newLink: EvidenceLink = {
      type: option.type,
      referenceId: option.id,
      label: option.label,
      linkedAt: new Date().toISOString(),
    };
    onChange([...links, newLink]);
  }, [links, onChange]);

  const handleRemove = React.useCallback((referenceId: string) => {
    onChange(links.filter(l => l.referenceId !== referenceId));
  }, [links, onChange]);

  const abcCount = links.filter(l => l.type === 'abc').length;
  const pdcaCount = links.filter(l => l.type === 'pdca').length;
  const totalCount = links.length;

  return (
    <Paper
      variant="outlined"
      sx={{
        overflow: 'hidden',
        borderColor: totalCount > 0 ? 'primary.main' : 'divider',
        borderStyle: totalCount > 0 ? 'solid' : 'dashed',
        opacity: readOnly && totalCount === 0 ? 0.6 : 1,
      }}
    >
      {/* ── Header ── */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
        sx={{
          px: 1.5,
          py: 0.75,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
        }}
        onClick={() => setExpanded(e => !e)}
      >
        <Stack direction="row" spacing={0.75} alignItems="center">
          <LinkRoundedIcon fontSize="small" color={totalCount > 0 ? 'primary' : 'disabled'} />
          <Typography variant="caption" fontWeight={600} color={totalCount > 0 ? 'primary' : 'text.secondary'}>
            {sectionLabel}の根拠
          </Typography>
          {totalCount > 0 ? (
            <Stack direction="row" spacing={0.5}>
              {abcCount > 0 && (
                <Chip label={`ABC ${abcCount}`} size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
              )}
              {pdcaCount > 0 && (
                <Chip label={`PDCA ${pdcaCount}`} size="small" color="info" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
              )}
            </Stack>
          ) : (
            <Typography variant="caption" color="text.disabled">
              未選択
            </Typography>
          )}
        </Stack>
        {expanded ? <ExpandLessRoundedIcon fontSize="small" /> : <ExpandMoreRoundedIcon fontSize="small" />}
      </Stack>

      <Collapse in={expanded}>
        <Divider />
        <Box sx={{ px: 1.5, py: 1 }}>
          {/* ── Linked items ── */}
          {links.length > 0 && (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
              {links.map(link => (
                <Tooltip
                  key={link.referenceId}
                  title={
                    onEvidenceClick
                      ? `クリックして${link.type === 'abc' ? 'ABC記録' : 'PDCA項目'}を開く`
                      : `${link.type === 'abc' ? 'ABC記録' : 'PDCA項目'} — 紐づけ: ${new Date(link.linkedAt).toLocaleDateString('ja-JP')}`
                  }
                >
                  <Chip
                    size="small"
                    label={link.label}
                    color={getChipColor(link.type)}
                    variant="outlined"
                    icon={link.type === 'abc' ? <EditNoteRoundedIcon /> : <BubbleChartRoundedIcon />}
                    onClick={onEvidenceClick ? () => onEvidenceClick(link.type, link.referenceId) : undefined}
                    onDelete={readOnly ? undefined : () => handleRemove(link.referenceId)}
                    sx={{
                      maxWidth: 250,
                      ...(onEvidenceClick && {
                        cursor: 'pointer',
                        '&:hover': { borderWidth: 2, fontWeight: 600 },
                        transition: 'all 0.15s ease-in-out',
                      }),
                    }}
                  />
                </Tooltip>
              ))}
            </Stack>
          )}

          {/* ── Add selector ── */}
          {!readOnly && (
            <Autocomplete
              options={availableOptions}
              groupBy={(opt) => opt.type === 'abc' ? 'ABC記録' : '氷山PDCA'}
              getOptionLabel={(opt) => opt.label}
              renderOption={(props, opt) => (
                <Box component="li" {...props} key={opt.id} sx={{ borderLeft: opt.isValidated ? '3px solid' : 'none', borderLeftColor: 'primary.main' }}>
                  <Stack sx={{ width: '100%' }}>
                    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="space-between">
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Box sx={{ color: SECTION_LABELS[opt.type].color, display: 'flex', fontSize: 16 }}>
                          {SECTION_LABELS[opt.type].icon}
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: opt.isValidated ? 700 : 400 }}>
                          {opt.label}
                        </Typography>
                      </Stack>
                      {opt.isValidated && (
                        <Chip label="検証済み" size="small" color="primary" sx={{ height: 16, fontSize: '0.6rem' }} />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ pl: 2.5 }}>
                      {opt.detail}
                    </Typography>
                  </Stack>
                </Box>
              )}
              onChange={handleAdd}
              value={null}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="ABC記録やPDCAを根拠として追加..."
                  size="small"
                  variant="outlined"
                />
              )}
              size="small"
              noOptionsText="選択可能な根拠がありません"
              blurOnSelect
              clearOnBlur
            />
          )}

          {/* ── Empty state ── */}
          {links.length === 0 && readOnly && (
            <Typography variant="caption" color="text.disabled">
              根拠が紐づけられていません
            </Typography>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

// ── ReadOnly compact display for non-edit mode ──

interface EvidenceLinksDisplayProps {
  sectionLabel: string;
  links: EvidenceLink[];
  /** 根拠チップクリック時のコールバック（遷移導線用） */
  onEvidenceClick?: (type: EvidenceLinkType, referenceId: string) => void;
}

export const EvidenceLinksDisplay: React.FC<EvidenceLinksDisplayProps> = ({ sectionLabel, links, onEvidenceClick }) => {
  if (links.length === 0) return null;

  return (
    <Stack spacing={0.5} sx={{ mt: 0.5 }}>
      <Stack direction="row" spacing={0.5} alignItems="center">
        <LinkRoundedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
        <Typography variant="caption" color="text.secondary">
          {sectionLabel}の根拠:
        </Typography>
      </Stack>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        {links.map(link => (
          <Tooltip
            key={link.referenceId}
            title={
              onEvidenceClick
                ? `クリックして${link.type === 'abc' ? 'ABC記録' : 'PDCA項目'}を開く`
                : link.label
            }
          >
            <Chip
              size="small"
              label={link.label}
              color={link.type === 'abc' ? 'success' : 'info'}
              variant="outlined"
              icon={link.type === 'abc' ? <EditNoteRoundedIcon /> : <BubbleChartRoundedIcon />}
              onClick={onEvidenceClick ? () => onEvidenceClick(link.type, link.referenceId) : undefined}
              sx={{
                height: 22,
                fontSize: '0.65rem',
                ...(onEvidenceClick && {
                  cursor: 'pointer',
                  '&:hover': { borderWidth: 2, fontWeight: 600 },
                  transition: 'all 0.15s ease-in-out',
                }),
              }}
            />
          </Tooltip>
        ))}
      </Stack>
    </Stack>
  );
};
