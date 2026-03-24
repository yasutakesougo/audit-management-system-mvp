/**
 * DailyRecordPage — Thin Orchestrator
 *
 * Composes:
 *   - dailyRecordMockData: mock data, generators, factory
 *   - useDailyRecordViewModel: state, handlers, filtering
 *   - DailyRecordStatsPanel: statistics cards
 *   - DailyRecordFilterPanel: search/status/date filters
 *   - DailyRecordBulkActions: bulk operation buttons
 *
 * 639 → ~220 lines (composition only)
 */

import { PageHeader } from '@/components/PageHeader';
import { ContextPanel } from '@/features/context/components/ContextPanel';
import { useDailyRecordContextData } from '@/features/daily/hooks/useDailyRecordContextData';
import { PersonDaily } from '@/domain/daily/types';
import { getNextIncompleteRecord, saveDailyRecord, validateDailyRecord } from '@/features/daily';
import { NextRecordHero } from '@/features/daily/components/NextRecordHero';
import { RecordActionQueue } from '@/features/daily/components/RecordActionQueue';
import { HandoffSummaryBanner } from '@/features/daily/components/HandoffSummaryBanner';
import { useTodayAttendanceInfo } from '@/features/daily/hooks/useTodayAttendanceInfo';
import { CTA_EVENTS, recordCtaClick } from '@/features/today/telemetry/recordCtaClick';
import { toLocalDateISO } from '@/utils/getNow';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import AddIcon from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Fab from '@mui/material/Fab';
import { useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useCallback, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { buildHandoffTimelineUrl } from '@/app/links/navigationLinks';
import { LandscapeFab } from '../components/ui/LandscapeFab';
import { FullScreenDailyDialogPage } from '../features/daily/components/FullScreenDailyDialogPage';
import { DailyRecordForm } from '../features/daily/forms/DailyRecordForm';
import { DailyRecordList } from '../features/daily/lists/DailyRecordList';
import { useDailyRecordViewModel } from '../features/daily/lists/useDailyRecordViewModel';
import { useHandoffSummary } from '../features/handoff/useHandoffSummary';
import { useHandoffData } from '../features/handoff/hooks/useHandoffData';
import type { HandoffRecord } from '../features/handoff/handoffTypes';
import { useUsers } from '../features/users/useUsers';
import { useSchedules } from '../stores/useSchedules';
import { DailyRecordBulkActions } from './DailyRecordBulkActions';
import { DailyRecordFilterPanel } from './DailyRecordFilterPanel';
import {
    createMissingRecord,
    generateTodayRecords,
    mockRecords,
    mockUsers,
} from './dailyRecordMockData';
import { DailyRecordStatsPanel } from './DailyRecordStatsPanel';

export default function DailyRecordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const theme = useTheme();

  const { data: usersData } = useUsers();
  const { data: schedulesData } = useSchedules();

  const [records, setRecords] = useState<PersonDaily[]>(mockRecords);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PersonDaily | undefined>();
  const [contextOpen, setContextOpen] = useState(false);
  const vm = useDailyRecordViewModel<PersonDaily>({
    locationState: location.state,
    searchParams,
    records,
    setRecords,
    editingRecord,
    setEditingRecord,
    setFormOpen,
    navigate,
    validateDailyRecord,
    saveDailyRecord,
    generateTodayRecords,
    mockUsers,
    createMissingRecord,
  });

  const {
    highlightUserId,
    highlightDate,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    dateFilter,
    setDateFilter,
    filteredRecords,
    handleOpenForm,
    handleEditRecord,
    handleCloseForm,
    handleOpenAttendance,
    handleSaveRecord,
    handleDeleteRecord,
    handleGenerateTodayRecords,
    handleBulkCreateMissing,
    handleBulkComplete,
  } = vm;

  // ── Hero 用: 今日のレコード ──
  const todayStr = useMemo(() => toLocalDateISO(), []);
  const todayRecords = useMemo(
    () => records.filter((r) => r.date === todayStr),
    [records, todayStr],
  );

  // ── Hero CTA: レコードを開く ──
  const handleHeroStartRecord = useCallback(
    (record: PersonDaily) => {
      recordCtaClick({
        ctaId: CTA_EVENTS.DAILY_HERO_CLICKED,
        sourceComponent: 'NextRecordHero',
        stateType: 'widget-action',
        scene: record.status,
      });
      setEditingRecord(record);
      setFormOpen(true);
    },
    [setEditingRecord, setFormOpen],
  );

  // ── Queue CTA: レコードを開く ──
  const handleQueueStartRecord = useCallback(
    (record: PersonDaily) => {
      recordCtaClick({
        ctaId: CTA_EVENTS.DAILY_QUEUE_ITEM_CLICKED,
        sourceComponent: 'RecordActionQueue',
        stateType: 'widget-action',
        scene: record.status,
      });
      setEditingRecord(record);
      setFormOpen(true);
    },
    [setEditingRecord, setFormOpen],
  );

  // ── Queue 完了済みアコーディオンの展開/閉じ ──
  const handleCompletedToggle = useCallback((expanded: boolean) => {
    recordCtaClick({
      ctaId: CTA_EVENTS.DAILY_QUEUE_COMPLETED_TOGGLED,
      sourceComponent: 'RecordActionQueue',
      stateType: 'widget-action',
      scene: expanded ? 'expanded' : 'collapsed',
    });
  }, []);
  const handleAllCompletedAction = useCallback(() => {
    recordCtaClick({
      ctaId: CTA_EVENTS.DAILY_HERO_ALL_COMPLETED,
      sourceComponent: 'NextRecordHero',
      stateType: 'navigation',
      targetUrl: '/handoff/timeline',
    });
    navigate(buildHandoffTimelineUrl(), {
      state: { dayScope: 'today', timeFilter: 'all' },
    });
  }, [navigate]);

  // ── Handoff Timeline 遷移 ──
  const handleNavigateToTimeline = useCallback(() => {
    navigate(buildHandoffTimelineUrl(), {
      state: { dayScope: 'today', timeFilter: 'all' },
    });
  }, [navigate]);

  // MVP-004: 保存成功時に次の未入力レコードを自動表示
  const handleSaveRecordWithNext = useCallback(
    async (record: Omit<PersonDaily, 'id'>) => {
      await handleSaveRecord(record);

      // 保存後にrecordsが更新されるので、setTimeout で1フレーム待つ
      setTimeout(() => {
        setRecords((currentRecords) => {
          const savedRecord = currentRecords.find(
            (r) => r.userId === record.userId && r.date === record.date,
          );
          if (!savedRecord) return currentRecords;

          const next = getNextIncompleteRecord(currentRecords, savedRecord.id);
          if (next) {
            setEditingRecord(next);
            setFormOpen(true);
          }
          // Note: 全完了時のトーストは handleSaveRecord 内で既に表示されている
          return currentRecords;
        });
      }, 100);
    },
    [handleSaveRecord, setRecords, setEditingRecord, setFormOpen],
  );

  // Phase 1A: handoff summary
  const {
    total: handoffTotal,
    criticalCount: handoffCritical,
  } = useHandoffSummary({ dayScope: 'today' });

  // Sprint-1 Phase C: ContextPanel 用の Handoff 実データ取得
  const { repo: handoffRepo } = useHandoffData();
  const [handoffRecordsForContext, setHandoffRecordsForContext] = useState<HandoffRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadHandoffs() {
      try {
        const records = await handoffRepo.getRecords('today', 'all');
        if (!cancelled) setHandoffRecordsForContext(records);
      } catch {
        if (!cancelled) setHandoffRecordsForContext([]);
      }
    }
    loadHandoffs();
    return () => { cancelled = true; };
  }, [handoffRepo]);

  // MVP-005: ContextPanel data
  const { contextData, contextUserName } = useDailyRecordContextData({
    editingRecord: editingRecord ? { userId: editingRecord.userId, userName: editingRecord.userName } : null,
    records,
    usersData,
    handoffRecordsForContext,
  });

  // Phase 2-1: highlight state (auto-dismiss after 1.5s)
  const [activeHighlightUserId, setActiveHighlightUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightUserId) return;
    const timer = setTimeout(() => {
      const element = document.querySelector(`[data-person-id="${highlightUserId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setActiveHighlightUserId(highlightUserId);
        setTimeout(() => setActiveHighlightUserId(null), 1500);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [highlightUserId, records]);

  // Attendance calculation
  const todayAttendanceInfo = useTodayAttendanceInfo(usersData, schedulesData, records);

  return (
    <FullScreenDailyDialogPage
      title="支援記録（ケース記録）"
      backTo="/daily/menu"
      testId="daily-activity-page"
    >
      <Container maxWidth="lg" data-testid="records-daily-root">
        <Box sx={{ py: 3 }}>
          <PageHeader
            title="支援記録（ケース記録）"
            subtitle="利用者全員の日々の活動状況、問題行動、発作記録を管理します"
          />

          {/* ── NextRecordHero: 次に書く1件 ── */}
          <NextRecordHero
            todayRecords={todayRecords}
            onStartRecord={handleHeroStartRecord}
            onAllCompletedAction={handleAllCompletedAction}
          />

          {/* ── RecordActionQueue: 残りの未完了キュー ── */}
          <RecordActionQueue
            todayRecords={todayRecords}
            onStartRecord={handleQueueStartRecord}
            onCompletedToggle={handleCompletedToggle}
          />

          {/* Handoff summary banner */}
          <HandoffSummaryBanner
            handoffTotal={handoffTotal}
            handoffCritical={handoffCritical}
            onNavigateToTimeline={handleNavigateToTimeline}
          />

          <DailyRecordStatsPanel
            records={records}
            expectedCount={todayAttendanceInfo.expectedCount}
            attendanceRate={todayAttendanceInfo.attendanceRate}
            absentUserIds={todayAttendanceInfo.absentUserIds}
          />

          <DailyRecordFilterPanel
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
            onClear={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setDateFilter('');
            }}
          />

          <DailyRecordBulkActions
            onGenerateTodayRecords={handleGenerateTodayRecords}
            onBulkCreateMissing={handleBulkCreateMissing}
            onBulkComplete={handleBulkComplete}
          />

          <DailyRecordList
            records={filteredRecords}
            onEdit={handleEditRecord}
            onDelete={handleDeleteRecord}
            onOpenAttendance={handleOpenAttendance}
            highlightUserId={highlightUserId}
            highlightDate={highlightDate}
            activeHighlightUserId={activeHighlightUserId}
            data-testid="daily-record-list"
          />

          <DailyRecordForm
            open={formOpen}
            onClose={handleCloseForm}
            record={editingRecord}
            onSave={handleSaveRecordWithNext}
            data-testid="daily-record-form"
          />

          <LandscapeFab
            icon={<AddIcon />}
            ariaLabel="新規記録作成"
            onClick={handleOpenForm}
            testId="add-record-fab"
          />


          {/* MVP-005: Context Panel Toggle */}
          <Fab
            color="primary"
            aria-label="コンテキスト参照"
            size="medium"
            onClick={() => setContextOpen((prev) => !prev)}
            data-testid="context-panel-toggle"
            sx={{
              position: 'fixed',
              bottom: 88,
              right: 16,
            }}
          >
            <AutoStoriesIcon />
          </Fab>

          {/* MVP-005: Context Panel */}
          <ContextPanel
            open={contextOpen}
            onClose={() => setContextOpen(false)}
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
}
