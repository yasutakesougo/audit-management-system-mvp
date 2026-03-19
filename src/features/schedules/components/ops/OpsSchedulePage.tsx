/**
 * OpsSchedulePage — スケジュール機能: 運営ビュー統合ページ
 *
 * 責務:
 * - useScheduleOps hook を使って state orchestration を行う
 * - UI部品に Props を分配し、画面を組み立てる
 * - Phase 1 では ViewMode が 'daily' のみ実装
 */

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import type { FC } from 'react';

import { useScheduleOps } from '../../hooks/useScheduleOps';
import { OpsDailyTable } from './OpsDailyTable';
import { OpsDetailDrawer } from './OpsDetailDrawer';
import { OpsFilterBar } from './OpsFilterBar';
import { OpsScheduleHeader } from './OpsScheduleHeader';
import { OpsSummaryCards } from './OpsSummaryCards';

export const OpsSchedulePage: FC = () => {
  // 1. Compose all state using the single facade hook
  const opsState = useScheduleOps();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      {/* Scrollable Main Area */}
      <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <OpsScheduleHeader
          selectedDate={opsState.selectedDate}
          viewMode={opsState.viewMode}
          searchQuery={opsState.filter.searchQuery}
          onDateChange={opsState.setSelectedDate}
          onGoToday={opsState.goToday}
          onGoPrev={opsState.goPrev}
          onGoNext={opsState.goNext}
          onViewModeChange={opsState.setViewMode}
          onSearchChange={(q) => opsState.setFilter({ searchQuery: q })}
          onCreateClick={() => {
            // TODO: Phase 3
            // eslint-disable-next-line no-console
            console.log('Open create dialog under ops layer');
          }}
        />

        <Divider />

        {/* Summary Cards */}
        <OpsSummaryCards
          summary={opsState.dailySummary}
          isLoading={opsState.isLoading}
          onCardClick={(key) => {
            // Example: click missing staff -> focus filter
            // eslint-disable-next-line no-console
            console.log('Summary card clicked:', key);
          }}
        />

        <Divider />

        {/* Filter Bar */}
        <OpsFilterBar
          filter={opsState.filter}
          onFilterChange={opsState.setFilter}
          onClear={opsState.clearFilter}
          staffOptions={opsState.staffOptions}
          activeFilterCount={opsState.activeFilterCount}
        />

        {/* Main Content Area */}
        {opsState.viewMode === 'daily' ? (
          <OpsDailyTable
            items={opsState.filteredItems}
            isLoading={opsState.isLoading}
            error={opsState.error}
            onRetry={opsState.refetch}
            onItemClick={opsState.selectItem}
          />
        ) : (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              {opsState.viewMode === 'weekly' ? '週次ビュー' : '一覧ビュー'}は実装中（Phase 2/3）です。
            </Typography>
          </Box>
        )}
      </Box>

      {/* Detail Drawer (Layered over the main view) */}
      <OpsDetailDrawer
        item={opsState.selectedItem}
        open={opsState.detailOpen}
        onClose={() => opsState.selectItem(null)}
        canEdit={true} // TODO: hook into authz for actual write permissions
        onEdit={(item) => {
          // TODO: Phase 3
          // eslint-disable-next-line no-console
          console.log('Open edit dialog for', item.id);
        }}
      />
    </Box>
  );
};
