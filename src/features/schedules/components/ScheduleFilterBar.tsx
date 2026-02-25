import { Stack } from '@mui/material';

import type { ScheduleCategory } from '../domain/types';
import { scheduleCategoryLabels } from '../domain/categoryLabels';
import SchedulesFilterResponsive from './SchedulesFilterResponsive';
import { TESTIDS } from '@/testids';

export type ScheduleFilterBarProps = {
  categoryFilter: 'All' | ScheduleCategory;
  onCategoryChange: (category: 'All' | ScheduleCategory) => void;
  query: string;
  onQueryChange: (query: string) => void;
  mode: 'day' | 'week' | 'month' | 'org';
  orgParam?: string;
  onOrgChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  compact?: boolean;
};

export function ScheduleFilterBar(props: ScheduleFilterBarProps) {
  const {
    categoryFilter,
    onCategoryChange,
    query,
    onQueryChange,
    mode,
    orgParam = 'all',
    onOrgChange,
    compact = false,
  } = props;

  return (
    <SchedulesFilterResponsive
      compact={compact && mode !== 'org'}
      inlineStackProps={{
        sx: { mt: { xs: 0.5, sm: 0 }, minWidth: 260 },
        spacing: 0.5,
        alignItems: 'flex-end',
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.6)' }}>絞り込み</span>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1}
        alignItems={{ xs: 'stretch', md: 'center' }}
        sx={{ width: '100%' }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, width: '100%' }}>
          カテゴリ:
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryChange(e.target.value as 'All' | ScheduleCategory)}
            style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.2)' }}
            data-testid={TESTIDS['schedules-filter-category']}
          >
            <option value="All">すべて</option>
            <option value="User">{scheduleCategoryLabels.User}</option>
            <option value="Staff">{scheduleCategoryLabels.Staff}</option>
            <option value="Org">{scheduleCategoryLabels.Org}</option>
          </select>
        </label>

        {mode === 'org' && onOrgChange && (
          <Stack direction="column" spacing={1} style={{ width: '100%' }} data-testid="schedule-org-tabpanel">
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>組織別スケジュール</h3>
            <Stack direction="row" spacing={1} style={{ alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                事業所:
                <select
                  value={orgParam}
                  onChange={onOrgChange}
                  style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.2)' }}
                  data-testid="schedule-org-select"
                >
                  <option value="all">全事業所（統合ビュー）</option>
                  <option value="main">生活介護（本体）</option>
                  <option value="shortstay">短期入所</option>
                  <option value="respite">レスパイト</option>
                  <option value="other">その他</option>
                </select>
              </label>
              <span data-testid="schedule-org-summary" style={{ fontSize: 13, color: '#666' }}>
                {orgParam === 'all' && '全事業所（統合ビュー）'}
                {orgParam === 'main' && '生活介護（本体）'}
                {orgParam === 'shortstay' && '短期入所'}
                {orgParam === 'respite' && 'レスパイト'}
                {orgParam === 'other' && 'その他'}
              </span>
            </Stack>
          </Stack>
        )}

        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="タイトル/場所/担当/利用者で検索"
          style={{
            flex: '1 1 280px',
            minWidth: 240,
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid rgba(0,0,0,0.2)',
          }}
          aria-label="スケジュール検索"
          data-testid={TESTIDS['schedules-filter-query']}
        />
      </Stack>
    </SchedulesFilterResponsive>
  );
}
