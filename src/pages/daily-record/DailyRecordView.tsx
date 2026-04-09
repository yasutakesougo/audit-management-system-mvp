import React from 'react';
import { PageHeader } from '@/components/PageHeader';
import { ContextPanel } from '@/features/context/components/ContextPanel';
import { NextRecordHero } from '@/features/daily/components/sections/NextRecordHero';
import { RecordActionQueue } from '@/features/daily/components/sections/RecordActionQueue';
import { HandoffSummaryBanner } from '@/features/daily/components/sections/HandoffSummaryBanner';
import { LandscapeFab } from '@/components/ui/LandscapeFab';
import { FullScreenDailyDialogPage } from '@/features/daily/components/pages/FullScreenDailyDialogPage';
import { DailyRecordForm } from '@/features/daily/components/forms/DailyRecordForm';
import { DailyRecordList } from '@/features/daily/components/lists/DailyRecordList';
import { DailyRecordBulkActions } from '../DailyRecordBulkActions';
import { DailyRecordFilterPanel } from '../DailyRecordFilterPanel';
import { DailyRecordStatsPanel } from '../DailyRecordStatsPanel';
import { DailyGuidancePanel } from './DailyGuidancePanel';
import { ExceptionAlertPanel } from './ExceptionAlertPanel';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import AddIcon from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Fab from '@mui/material/Fab';
import { useTheme } from '@mui/material/styles';
import { Toaster } from 'react-hot-toast';

import { type DailyRecordViewProps } from './types';

/**
 * 支援記録画面の受動的ビュー (Passive View)。
 */
export const DailyRecordView: React.FC<DailyRecordViewProps> = ({
  viewModel,
  handlers,
}) => {
  const theme = useTheme();

  if (!viewModel) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        日々の記録を読み込み中...
      </Box>
    );
  }

  const {
    filteredRecords,
    todayRecords,
    stats,
    searchQuery,
    statusFilter,
    dateFilter,
    formOpen,
    editingRecord,
    contextOpen,
    contextUserName,
    contextData,
    activeHighlightUserId,
    handoffSummary,
  } = viewModel;

  return (
    <FullScreenDailyDialogPage
      title="日々の記録"
      backTo="/daily/menu"
      testId="daily-activity-page"
    >
      <Container maxWidth="lg" data-testid="records-daily-root">
        <Box sx={{ py: 3 }}>
          <PageHeader
            title="日々の記録"
            subtitle="利用者全員の日々の活動状況、問題行動、発作記録を管理します"
          />

          {/* ── NextRecordHero ── */}
          <NextRecordHero
            todayRecords={todayRecords}
            onStartRecord={handlers.onHeroStartRecord}
            onAllCompletedAction={handlers.onAllCompletedAction}
          />

          <ExceptionAlertPanel exceptions={viewModel.triggeredExceptions} />

          <DailyGuidancePanel bundle={viewModel.guidanceBundle || null} />

          {/* ── RecordActionQueue ── */}
          <RecordActionQueue
            todayRecords={todayRecords}
            onStartRecord={handlers.onQueueStartRecord}
            onCompletedToggle={handlers.onCompletedToggle}
          />

          {/* Handoff summary banner */}
          <HandoffSummaryBanner
            handoffTotal={handoffSummary.total}
            handoffCritical={handoffSummary.critical}
            onNavigateToTimeline={handlers.onNavigateToTimeline}
          />

          <DailyRecordStatsPanel
            expectedCount={stats.expectedCount}
            attendanceRate={stats.attendanceRate}
            absentUserIds={stats.absentUserIds}
            totalCount={stats.totalCount}
            completedCount={stats.completedCount}
            inProgressCount={stats.inProgressCount}
            notStartedCount={stats.notStartedCount}
          />

          <DailyRecordFilterPanel
            searchQuery={searchQuery}
            onSearchQueryChange={handlers.onSearchChange}
            statusFilter={statusFilter}
            onStatusFilterChange={handlers.onStatusFilterChange}
            dateFilter={dateFilter}
            onDateFilterChange={handlers.onDateFilterChange}
            onClear={handlers.onClearFilters}
          />

          <DailyRecordBulkActions
            onGenerateTodayRecords={handlers.onGenerateTodayRecords}
            onBulkCreateMissing={handlers.onBulkCreateMissing}
            onBulkComplete={handlers.onBulkComplete}
          />

          <DailyRecordList
            records={filteredRecords}
            onEdit={handlers.onEditRecord}
            onDelete={(id) => handlers.onDeleteRecord(String(id))}
            onOpenAttendance={(data) => handlers.onOpenAttendance(data.userId)}
            highlightUserId={activeHighlightUserId}
            highlightDate={dateFilter}
            activeHighlightUserId={activeHighlightUserId}
            data-testid="daily-record-list"
          />

          <DailyRecordForm
            open={formOpen}
            onClose={handlers.onCloseForm}
            record={editingRecord}
            onSave={handlers.onSaveRecord}
            data-testid="daily-record-form"
          />

          <LandscapeFab
            icon={<AddIcon />}
            ariaLabel="新規記録作成"
            onClick={handlers.onOpenForm}
            testId="add-record-fab"
          />

          {/* Context Panel Toggle */}
          <Fab
            color="primary"
            aria-label="コンテキスト参照"
            size="medium"
            onClick={handlers.onToggleContext}
            data-testid="context-panel-toggle"
            sx={{
              position: 'fixed',
              bottom: 88,
              right: 16,
            }}
          >
            <AutoStoriesIcon />
          </Fab>

          {/* Context Panel */}
          <ContextPanel
            open={contextOpen}
            onClose={handlers.onCloseContext}
            userName={contextUserName}
            data={contextData}
          />

          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: theme.palette.grey[800],
                color: theme.palette.common.white,
              },
              success: {
                iconTheme: {
                  primary: theme.palette.success.main,
                  secondary: theme.palette.common.white,
                },
              },
              error: {
                iconTheme: {
                  primary: theme.palette.error.main,
                  secondary: theme.palette.common.white,
                },
              },
            }}
          />
        </Box>
      </Container>
    </FullScreenDailyDialogPage>
  );
};
