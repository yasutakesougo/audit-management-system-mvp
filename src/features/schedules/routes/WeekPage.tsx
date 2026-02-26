import { useId, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import { useAuth } from '@/auth/useAuth';
import { useUserAuthz } from '@/auth/useUserAuthz';
import { canAccess } from '@/auth/roles';
import { MASTER_SCHEDULE_TITLE_JA } from '@/features/schedules/constants';
import SchedulesHeader from '@/features/schedules/components/SchedulesHeader';
import { ScheduleFilterBar } from '@/features/schedules/components/ScheduleFilterBar';
import { ScheduleDialogManager } from '@/features/schedules/components/ScheduleDialogManager';
import { ScheduleViewContainer } from '@/features/schedules/components/ScheduleViewContainer';
import { ScheduleFAB } from '@/features/schedules/components/ScheduleFAB';
import { ScheduleReadOnlyAlert } from '@/features/schedules/components/ScheduleReadOnlyAlert';
import { useScheduleUserOptions } from '../hooks/useScheduleUserOptions';
import { useSchedulesPageState } from '../hooks/useSchedulesPageState';
import { useWeekPageUiState } from '../hooks/useWeekPageUiState';
import { useWeekPageOrchestrator } from '../hooks/useWeekPageOrchestrator';
import { TESTIDS } from '@/testids';
import { resolveSchedulesTz } from '@/utils/scheduleTz';
import { useBreakpointFlags, useOrientation } from '@/app/LayoutContext';


export default function WeekPage() {
  // Layout & Auth
  const { isDesktopSize, isTabletSize } = useBreakpointFlags();
  const { isLandscape } = useOrientation();
  const { account } = useAuth();
  const { role, ready } = useUserAuthz();
  const myUpn = useMemo(() => (account?.username ?? '').trim().toLowerCase(), [account?.username]);
  const canEditByRole = ready && canAccess(role, 'reception');
  const schedulesTz = useMemo(() => resolveSchedulesTz(), []);
  const location = useLocation();

  // Page state (business logic)
  const pageState = useSchedulesPageState({ myUpn, canEditByRole, ready });
  const {
    route,
    mode,
    categoryFilter,
    isLoading,
    filteredItems,
    lastError,
    clearLastError,
    refetch,
    createDialogOpen,
    scheduleDialogModeProps,
    createDialogInitialDate,
    createDialogInitialStartTime,
    createDialogInitialEndTime,
    weekLabel,
    readOnlyReason,
    canEdit,
    canWrite,
    weekRange,
  } = pageState;

  // UI state (snackbar, conflict, highlights, etc.)
  const uiState = useWeekPageUiState();
  const {
    snack,
    setSnack,
    isInlineSaving,
    isInlineDeleting,
    conflictDetailOpen,
    setConflictDetailOpen,
    lastErrorAt,
    conflictBusy,
    highlightId,
  } = uiState;

  // Orchestrator (all event handlers, navigation, local state)
  const orchestrator = useWeekPageOrchestrator({
    pageState,
    uiState,
    myUpn,
    canEditByRole,
    ready,
    canEdit,
    canWrite,
    schedulesTz,
  });

  const {
    viewItem,
    setViewItem,
    dialogOpen,
    dialogInitialValues,
    resolvedActiveDateIso,
    dayViewHref,
    weekViewHref,
    monthViewHref,
    activeDayRange,
    fabRef,
    handleDayClick,
    handleFabClick,
    handleTimeSlotClick,
    handleOrgChange,
    handleViewClick,
    handleViewEdit,
    handleViewDelete,
    handleInlineDialogClose,
    handleInlineDialogSubmit,
    handleInlineDialogDelete,
    handleScheduleDialogSubmit,
    handleCreateDialogClose,
    handleConflictDiscard,
    handleConflictReload,
    handlePrevWeek,
    handleNextWeek,
    handleTodayWeek,
    handlePrevMonth,
    handleNextMonth,
    handleTodayMonth,
    suppressRouteDialog,
    conflictOpen,
  } = orchestrator;

  // Schedule user options
  const scheduleUserOptions = useScheduleUserOptions();
  const defaultScheduleUser = scheduleUserOptions.length ? scheduleUserOptions[0] : null;

  // Layout flags
  const isSchedulesView = location.pathname === '/schedules' || location.pathname.startsWith('/schedules/');
  const showFab = !isDesktopSize && !isSchedulesView;
  const compact = isTabletSize && isLandscape;
  const fabInset = `max(24px, calc(env(safe-area-inset-bottom, 0px) + 8px))`;
  const fabInsetRight = `max(24px, calc(env(safe-area-inset-right, 0px) + 8px))`;

  // IDs for accessibility
  const headingId = useId();
  const rangeDescriptionId = 'schedules-week-range';

  // Compute header labels (mode-aware)
  const monthDate = new Date(`${resolvedActiveDateIso}T00:00:00`);
  const monthLabel = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long' }).format(monthDate);

  const headerSubLabel =
    mode === 'day'
      ? '日表示（本日の予定）'
      : mode === 'month'
        ? '月表示（全体カレンダー）'
        : '週表示（週間の予定一覧）';

  const headerPeriodLabel =
    mode === 'month'
      ? `表示月: ${monthLabel}`
      : mode === 'day'
        ? `表示期間: ${new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' }).format(monthDate)}`
        : `表示期間: ${weekLabel}`;

  // Mode-aware navigation handlers
  const navPrev = mode === 'month' ? handlePrevMonth : handlePrevWeek;
  const navNext = mode === 'month' ? handleNextMonth : handleNextWeek;
  const navToday = mode === 'month' ? handleTodayMonth : handleTodayWeek;

  return (
    <section
      aria-label="週間スケジュール"
      aria-describedby={rangeDescriptionId}
      aria-labelledby={headingId}
      data-testid="schedules-week-page"
      tabIndex={-1}
      style={{ paddingBottom: 24 }}
    >
      <div data-testid="schedules-week-root" style={{ display: 'contents' }}>
        <div
          className="schedule-sticky"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 2,
            background: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(6px)',
            paddingTop: 0,
            paddingBottom: 4,
            borderBottom: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          <span hidden>週間スケジュール</span>
          <SchedulesHeader
            mode={mode}
            title={MASTER_SCHEDULE_TITLE_JA}
            subLabel={headerSubLabel}
            periodLabel={headerPeriodLabel}
            compact={compact}
            onPrev={navPrev}
            onNext={navNext}
            onToday={navToday}
            onPrimaryCreate={canEdit && canWrite ? handleFabClick : undefined}
            showPrimaryAction={isDesktopSize}
            primaryActionLabel="予定を追加"
            primaryActionAriaLabel="この週に予定を追加"
            headingId={headingId}
            titleTestId={
              mode === 'month'
                ? TESTIDS.SCHEDULES_MONTH_HEADING_ID
                : mode === 'day'
                  ? TESTIDS['schedules-day-heading']
                  : TESTIDS['schedules-week-heading']
            }
            rangeLabelId={rangeDescriptionId}
            dayHref={dayViewHref}
            weekHref={weekViewHref}
            monthHref={monthViewHref}
            modes={['day', 'week', 'month', 'org']}
            prevTestId={TESTIDS.SCHEDULES_PREV_WEEK}
            nextTestId={TESTIDS.SCHEDULES_NEXT_WEEK}
          >
            <ScheduleFilterBar
              categoryFilter={categoryFilter}
              onCategoryChange={(category) => route.setFilter({ category })}
              query={pageState.query}
              onQueryChange={(q) => route.setFilter({ query: q })}
              mode={mode}
              orgParam={orchestrator.orgParam}
              onOrgChange={handleOrgChange}
              compact={compact && mode !== 'org'}
            />
          </SchedulesHeader>
        </div>

        <ScheduleReadOnlyAlert readOnlyReason={readOnlyReason} />

        <div>
          <ScheduleViewContainer
            mode={mode}
            isLoading={isLoading}
            items={filteredItems}
            weekRange={weekRange}
            onDayClick={handleDayClick}
            onTimeSlotClick={handleTimeSlotClick}
            activeDateIso={resolvedActiveDateIso}
            onItemSelect={handleViewClick}
            highlightId={highlightId}
            activeDayRange={activeDayRange}
            categoryFilter={categoryFilter}
            compact={compact}
          />
        </div>

        {showFab && (
          <ScheduleFAB
            canWrite={canWrite}
            onClick={handleFabClick}
            fabRef={fabRef}
            resolvedActiveDateIso={resolvedActiveDateIso}
            readOnlyMessage={readOnlyReason?.message}
            fabInset={fabInset}
            fabInsetRight={fabInsetRight}
          />
        )}

        <ScheduleDialogManager
          viewItem={viewItem}
          onViewClose={() => setViewItem(null)}
          onViewEdit={handleViewEdit}
          onViewDelete={handleViewDelete}
          dialogOpen={dialogOpen}
          dialogInitialValues={dialogInitialValues}
          onInlineDialogClose={handleInlineDialogClose}
          onInlineDialogSubmit={handleInlineDialogSubmit}
          onInlineDialogDelete={handleInlineDialogDelete}
          isInlineSaving={isInlineSaving}
          isInlineDeleting={isInlineDeleting}
          createDialogOpen={createDialogOpen}
          suppressRouteDialog={suppressRouteDialog}
          canEdit={canEdit}
          canWrite={canWrite}
          scheduleDialogModeProps={scheduleDialogModeProps}
          createDialogInitialDate={createDialogInitialDate}
          createDialogInitialStartTime={createDialogInitialStartTime}
          createDialogInitialEndTime={createDialogInitialEndTime}
          onCreateDialogClose={handleCreateDialogClose}
          onScheduleDialogSubmit={handleScheduleDialogSubmit}
          scheduleUserOptions={scheduleUserOptions}
          defaultScheduleUser={defaultScheduleUser ?? undefined}
          snack={snack}
          onSnackClose={() => setSnack((s) => ({ ...s, open: false }))}
          conflictOpen={conflictOpen}
          conflictDetailOpen={conflictDetailOpen}
          onConflictDetailClose={() => setConflictDetailOpen(true)}
          onConflictDiscard={handleConflictDiscard}
          onConflictReload={handleConflictReload}
          conflictBusy={conflictBusy}
          lastError={lastError}
          lastErrorAt={lastErrorAt}
          onConflictRefetch={refetch}
          onConflictClearError={clearLastError}
          onSetFocusScheduleId={uiState.setFocusScheduleId}
        />
      </div>
    </section>
  );
}
