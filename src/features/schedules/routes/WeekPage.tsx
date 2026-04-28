/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useId, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useBreakpointFlags, useOrientation } from '@/app/LayoutContext';
import { canAccess } from '@/auth/roles';
import { useAuth } from '@/auth/useAuth';
import { useUserAuthz } from '@/auth/useUserAuthz';
import { ScheduleDialogManager } from '@/features/schedules/components/dialogs/ScheduleDialogManager';
import { ScheduleFAB } from '@/features/schedules/components/ScheduleFAB';
import { ScheduleFilterBar } from '@/features/schedules/components/sections/ScheduleFilterBar';
import { ScheduleReadOnlyAlert } from '@/features/schedules/components/ScheduleReadOnlyAlert';
import { ScheduleViewContainer } from '@/features/schedules/components/pages/ScheduleViewContainer';
import SchedulesHeader from '@/features/schedules/components/sections/SchedulesHeader';
import { OpsFilterBar } from '@/features/schedules/components/ops/OpsFilterBar';
import { OpsHighLoadWarningBanner } from '@/features/schedules/components/ops/OpsHighLoadWarningBanner';
import { OpsLeaveSuggestionPanel } from '@/features/schedules/components/ops/OpsLeaveSuggestionPanel';
import { OpsListView } from '@/features/schedules/components/ops/OpsListView';
import { OpsStaffingShortageList } from '@/features/schedules/components/ops/OpsStaffingShortageList';
import { OpsSummaryCards } from '@/features/schedules/components/ops/OpsSummaryCards';
import { OpsWeekBoard } from '@/features/schedules/components/ops/OpsWeekBoard';
import { MASTER_SCHEDULE_TITLE_JA } from '@/features/schedules/constants';
import { getIsE2eForceSchedulesWrite } from '@/env';
import { resolveSchedulesTz } from '@/utils/scheduleTz';
import { alpha, useTheme } from '@mui/material/styles';
import { useScheduleOps } from '../hooks/useScheduleOps';
import { useScheduleUserOptions } from '../hooks/useScheduleUserOptions';
import { buildCreateDialogIntent, buildNextSlot, useSchedulesPageState } from '../hooks/view-models/useSchedulesPageState';
import { useWeekPageOrchestrator } from '../hooks/orchestrators/useWeekPageOrchestrator';
import { useWeekPageUiState } from '../hooks/view-models/useWeekPageUiState';


export default function WeekPage() {
  const theme = useTheme();

  // Layout & Auth
  const { isDesktopSize, isTabletSize } = useBreakpointFlags();
  const { isLandscape } = useOrientation();
  const { account } = useAuth();
  const { role, ready } = useUserAuthz();
  const myUpn = useMemo(() => (account?.username ?? '').trim().toLowerCase(), [account?.username]);
  const canEditByRole = ready && canAccess(role, 'reception');
  const schedulesTz = useMemo(() => resolveSchedulesTz(), []);
  const location = useLocation();
  const navigate = useNavigate();

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

  // Ops integration: detect ops/list mode
  const isOpsMode = mode === 'ops' || mode === 'list';

  // Ops state — only instantiated when in ops/list mode
  const opsState = useScheduleOps();

  // Today deep-link: ?source=today&date=YYYY-MM-DD
  const [searchParams] = useSearchParams();
  const todayFocusDate = searchParams.get('date');
  const isFromToday = searchParams.get('source') === 'today';

  // Ops: weekly drilldown handler — navigate to day tab with auto-create
  const handleOpsWeekDayClick = useCallback(
    (dateIso: string) => {
      opsState.setSelectedDate(new Date(dateIso + 'T00:00:00'));
      // Navigate to day tab with action=create for auto-open dialog
      const urlObj = new URL(window.location.href);
      urlObj.searchParams.set('tab', 'day');
      urlObj.searchParams.set('date', dateIso);
      urlObj.searchParams.set('action', 'create');
      // Clear ops filter params (cross-group isolation)
      for (const key of ['serviceType', 'staffId', 'searchQuery', 'includeCancelled', 'hasAttention', 'hasPickup', 'hasBath', 'hasMedication']) {
        urlObj.searchParams.delete(key);
      }
      navigate(urlObj.pathname + urlObj.search);
    },
    [opsState, navigate],
  );

  // Phase 6: Auto-open create dialog when action=create is in URL
  const actionParam = searchParams.get('action');
  useEffect(() => {
    if (actionParam !== 'create' || mode !== 'day') return;
    // Build the dialog intent for the focused date
    const { start, end } = buildNextSlot(resolvedActiveDateIso);
    const intent = buildCreateDialogIntent('User', start, end);
    // setDialogParams also clears 'action' param atomically
    route.setDialogParams(intent);
  }, [actionParam, mode, resolvedActiveDateIso, route]);

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
  const stickyHeaderBackground =
    theme.palette.mode === 'dark'
      ? alpha(theme.palette.background.paper, 0.96)
      : 'rgba(255,255,255,0.96)';
  const stickyHeaderBorderColor =
    theme.palette.mode === 'dark'
      ? alpha(theme.palette.common.white, 0.12)
      : 'rgba(0,0,0,0.08)';

  return (
    <section
      aria-label="週間スケジュール"
      aria-describedby={rangeDescriptionId}
      aria-labelledby={headingId}
      data-testid={
        mode === 'month'
          ? 'schedules-month-page'
          : mode === 'day'
            ? 'schedules-day-shell'
            : 'schedules-week-page'
      }
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
            background: stickyHeaderBackground,
            backdropFilter: 'blur(6px)',
            paddingTop: 0,
            paddingBottom: 4,
            borderBottom: `1px solid ${stickyHeaderBorderColor}`,
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
            onPrimaryCreate={(canEdit && canWrite) || getIsE2eForceSchedulesWrite() ? handleFabClick : undefined}
            showPrimaryAction={true}
            primaryActionLabel="予定を追加"
            primaryActionAriaLabel="この週に予定を追加"
            headingId={headingId}
            titleTestId={
              mode === 'month'
                ? 'schedules-month-heading'
                : mode === 'day'
                  ? 'schedules-day-heading'
                  : 'schedules-week-heading'
            }
            rangeLabelId={rangeDescriptionId}
            dayHref={dayViewHref}
            weekHref={weekViewHref}
            monthHref={monthViewHref}
            modes={['day', 'week', 'month', 'ops', 'list']}
            prevTestId="schedules-prev-week"
            nextTestId="schedules-next-week"
          >
            <ScheduleFilterBar
              categoryFilter={categoryFilter}
              onCategoryChange={(category) => route.setFilter({ category })}
              query={pageState.query}
              onQueryChange={(q) => route.setFilter({ query: q })}
              mode={mode as 'day' | 'week' | 'month' | 'org'}
              orgParam={orchestrator.orgParam}
              onOrgChange={handleOrgChange}
              compact={compact && mode !== 'org'}
            />
          </SchedulesHeader>
        </div>

        <ScheduleReadOnlyAlert readOnlyReason={readOnlyReason} />

        {/* Today Deep-Link Banner */}
        {isFromToday && todayFocusDate && (
          <div
            style={{
              padding: '8px 16px',
              backgroundColor: 'rgba(25, 118, 210, 0.06)',
              borderBottom: '1px solid rgba(25, 118, 210, 0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.85rem',
              fontWeight: 500,
              color: '#1565c0',
            }}
          >
            <span aria-hidden>📍</span>
            <span>
              Todayからの注目日:
              {' '}
              <strong>
                {new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(
                  new Date(todayFocusDate + 'T00:00:00'),
                )}
              </strong>
            </span>
          </div>
        )}

        {/* Content: existing views or ops views */}
        {isOpsMode ? (
          <div style={{ padding: '0 16px 16px' }}>
            {/* Ops Summary Cards */}
            <OpsSummaryCards
              summary={opsState.dailySummary}
              isLoading={opsState.isLoading}
            />

            {/* Ops Filter Bar */}
            <OpsFilterBar
              filter={opsState.filter}
              onFilterChange={opsState.setFilter}
              onClear={opsState.clearFilter}
              staffOptions={opsState.staffOptions}
              activeFilterCount={opsState.activeFilterCount}
            />

            {mode === 'ops' && (
              <>
                <OpsLeaveSuggestionPanel
                  suggestions={opsState.leaveSuggestions}
                  onDayClick={handleOpsWeekDayClick}
                />
                <OpsHighLoadWarningBanner
                  warnings={opsState.highLoadWarnings}
                  onDayClick={handleOpsWeekDayClick}
                />
                <OpsWeekBoard
                  weekSummary={opsState.weeklySummary}
                  loadScores={opsState.weeklyLoadScores}
                  isLoading={opsState.isLoading}
                  onDayClick={handleOpsWeekDayClick}
                />
              </>
            )}

            {mode === 'list' && (
              <>
                <OpsStaffingShortageList
                  warnings={opsState.highLoadWarnings}
                  onDayClick={handleOpsWeekDayClick}
                />
                <OpsListView
                  items={opsState.filteredItems}
                  isLoading={opsState.isLoading}
                  error={opsState.error}
                  onRetry={opsState.refetch}
                  onItemClick={opsState.selectItem}
                />
              </>
            )}
          </div>
        ) : (
          <div>
            <ScheduleViewContainer
              mode={mode as 'day' | 'week' | 'month' | 'org'}
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
        )}

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
          onOpenConflictDetail={() => setConflictDetailOpen(true)}
          onConflictDetailClose={() => setConflictDetailOpen(false)}
          onConflictDiscard={handleConflictDiscard}
          onConflictReload={handleConflictReload}
          conflictBusy={conflictBusy}
          lastError={lastError}
          lastErrorAt={lastErrorAt}
          onConflictRefetch={refetch}
          onClearLastError={clearLastError}
          onSetFocusScheduleId={uiState.setFocusScheduleId}
          networkOpen={false}
          allItems={filteredItems}
          activeDateIso={resolvedActiveDateIso}
          navigationSource={searchParams.get('source') ?? (actionParam === 'create' ? 'ops' : undefined)}
        />
      </div>
    </section>
  );
}
