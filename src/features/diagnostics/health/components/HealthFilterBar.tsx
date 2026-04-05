/**
 * HealthFilterBar — 診断結果フィルタコントロール
 *
 * level (FAIL/WARN/PASS) + resource（テキスト検索）を提供する。
 * HealthDiagnosisPage から状態を受け取り、変更コールバックを返す。
 */

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import SearchIcon from '@mui/icons-material/Search';
import React from 'react';
import type { HealthCheckResult } from '@/features/diagnostics/health/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LevelFilter = 'all' | 'fail' | 'warn' | 'pass';

export interface HealthFilterState {
  level: LevelFilter;
  resource: string;
}

interface HealthFilterBarProps {
  results: HealthCheckResult[];
  filter: HealthFilterState;
  onChange: (next: Partial<HealthFilterState>) => void;
}

// ─── Level counts ─────────────────────────────────────────────────────────────

function countByLevel(results: HealthCheckResult[]) {
  return results.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const HealthFilterBar: React.FC<HealthFilterBarProps> = ({
  results,
  filter,
  onChange,
}) => {
  const counts = countByLevel(results);

  const levels: { value: LevelFilter; label: string; color: 'error' | 'warning' | 'success' | 'default' }[] = [
    { value: 'all',  label: `ALL (${results.length})`, color: 'default' },
    { value: 'fail', label: `FAIL (${counts.fail ?? 0})`, color: 'error' },
    { value: 'warn', label: `WARN (${counts.warn ?? 0})`, color: 'warning' },
    { value: 'pass', label: `PASS (${counts.pass ?? 0})`, color: 'success' },
  ];

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      {/* level chips */}
      {levels.map(({ value, label, color }) => (
        <Chip
          key={value}
          size="small"
          label={label}
          color={filter.level === value ? color : 'default'}
          variant={filter.level === value ? 'filled' : 'outlined'}
          onClick={() => onChange({ level: value })}
          sx={{ cursor: 'pointer', fontWeight: filter.level === value ? 700 : 400 }}
        />
      ))}

      {/* resource search */}
      <TextField
        size="small"
        placeholder="リスト名で検索…"
        value={filter.resource}
        onChange={(e) => onChange({ resource: e.target.value })}
        sx={{ ml: 'auto', minWidth: 180 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />
    </Box>
  );
};
