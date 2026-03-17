/**
 * TimelineFilterBar — タイムライン絞り込みバー
 *
 * 責務:
 *   - source filter（トグルチップ）
 *   - severity filter
 *   - ソースごとの件数表示
 *   - unresolvedHandoff 件数があれば警告表示
 *
 * 設計:
 *   - 外から filter と onFilterChange を受け取る（制御コンポーネント）
 *   - チップクリックで source ON/OFF
 *   - severity はドロップダウン
 */

import React from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  type TimelineEventSource,
  type TimelineFilter,
  type TimelineSeverity,
  TIMELINE_SOURCES,
  TIMELINE_SOURCE_LABELS,
} from '@/domain/timeline';
import { motionTokens } from '@/app/theme';

// ─────────────────────────────────────────────
// Source チップカラー（カードと統一）
// ─────────────────────────────────────────────

const SOURCE_CHIP_COLORS: Record<
  TimelineEventSource,
  { bg: string; text: string; selectedBg: string }
> = {
  daily: { bg: '#E8F0E4', text: '#3D6B3C', selectedBg: '#3D6B3C' },
  incident: { bg: '#FDE8E8', text: '#C94A4A', selectedBg: '#C94A4A' },
  isp: { bg: '#E8EEF9', text: '#3B5998', selectedBg: '#3B5998' },
  handoff: { bg: '#FFF3E0', text: '#B45309', selectedBg: '#B45309' },
};

const SEVERITY_OPTIONS: { value: '' | TimelineSeverity; label: string }[] = [
  { value: '', label: 'すべて' },
  { value: 'info', label: '情報以上' },
  { value: 'warning', label: '警告以上' },
  { value: 'critical', label: '重大のみ' },
];

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface TimelineFilterBarProps {
  /** 現在のフィルタ */
  filter: TimelineFilter;
  /** フィルタ更新 */
  onFilterChange: (filter: TimelineFilter) => void;
  /** ソースごとの件数 */
  sourceCounts: Record<TimelineEventSource, number>;
  /** 未解決 handoff 件数 */
  unresolvedHandoff?: number;
  /** 総表示件数 */
  totalCount: number;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export const TimelineFilterBar: React.FC<TimelineFilterBarProps> = ({
  filter,
  onFilterChange,
  sourceCounts,
  unresolvedHandoff = 0,
  totalCount,
}) => {
  const activeSources = filter.sources ?? [];
  const isAllSources = activeSources.length === 0;

  const handleSourceToggle = (source: TimelineEventSource) => {
    let next: TimelineEventSource[];

    if (isAllSources) {
      // 「全選択」状態からクリック → そのソースだけを選択
      next = [source];
    } else if (activeSources.includes(source)) {
      // 選択解除
      next = activeSources.filter((s) => s !== source);
      // 全部外れたら「全選択」に戻す
      if (next.length === 0) next = [];
    } else {
      // 追加
      next = [...activeSources, source];
      // 全種類選択されたら「全選択」に戻す
      if (next.length === TIMELINE_SOURCES.length) next = [];
    }

    onFilterChange({ ...filter, sources: next.length > 0 ? next : undefined });
  };

  const handleSeverityChange = (e: SelectChangeEvent<string>) => {
    const value = e.target.value as '' | TimelineSeverity;
    onFilterChange({
      ...filter,
      severity: value || undefined,
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Source filter chips */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        {TIMELINE_SOURCES.map((source) => {
          const colors = SOURCE_CHIP_COLORS[source];
          const isActive = isAllSources || activeSources.includes(source);
          const count = sourceCounts[source] ?? 0;

          return (
            <Chip
              key={source}
              label={`${TIMELINE_SOURCE_LABELS[source]} (${count})`}
              size="small"
              onClick={() => handleSourceToggle(source)}
              sx={{
                fontWeight: 600,
                fontSize: '0.75rem',
                bgcolor: isActive ? colors.selectedBg : colors.bg,
                color: isActive ? '#fff' : colors.text,
                border: '1px solid',
                borderColor: isActive ? colors.selectedBg : 'transparent',
                opacity: isActive ? 1 : 0.6,
                transition: motionTokens.transition.microAll,
                '&:hover': {
                  opacity: 1,
                  bgcolor: isActive ? colors.selectedBg : colors.bg,
                },
              }}
            />
          );
        })}

        {/* Severity filter */}
        <FormControl size="small" sx={{ minWidth: 120, ml: 'auto' }}>
          <InputLabel id="timeline-severity-label" sx={{ fontSize: '0.8rem' }}>
            重要度
          </InputLabel>
          <Select
            labelId="timeline-severity-label"
            value={filter.severity ?? ''}
            label="重要度"
            onChange={handleSeverityChange}
            sx={{ fontSize: '0.8rem', height: 32 }}
          >
            {SEVERITY_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Summary line + unresolved warning */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          表示: {totalCount}件
        </Typography>

        {unresolvedHandoff > 0 && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.25,
              bgcolor: 'warning.lighter',
              borderRadius: 1,
            }}
          >
            <WarningAmberIcon
              sx={{ fontSize: 14, color: 'warning.main' }}
            />
            <Typography
              variant="caption"
              color="warning.dark"
              sx={{ fontWeight: 600, fontSize: '0.7rem' }}
            >
              未解決 handoff: {unresolvedHandoff}件
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};
