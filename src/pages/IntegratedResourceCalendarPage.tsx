/**
 * 統合リソースカレンダーページ — Thin Orchestrator
 *
 * Composes:
 *   - ircCalendarTypes: types, pure logic, utilities
 *   - ircCalendarStyles: CSS vars + style block
 *   - IrcEventContent: event cell rendering
 *   - IrcEventDetailDialog: event detail modal
 *   - IrcFilterToolbar: filter controls + stats chips
 *
 * 1091 → ~310 lines (composition only)
 */

import type {
    DateSelectArg,
    EventApi,
    EventClickArg,
    EventContentArg,
    EventMountArg,
} from '@fullcalendar/core';
import interactionPlugin from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import type { ResourceLabelContentArg } from '@fullcalendar/resource';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import {
    Alert,
    Box,
    Container,
    Paper,
    Snackbar,
    Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFeatureFlags } from '@/config/featureFlags';
import { isE2E } from '@/env';
import { estimatePayloadSize, HYDRATION_FEATURES, startFeatureSpan } from '@/hydration/features';
import { getAppConfig } from '@/lib/env';
import { useLocation } from 'react-router-dom';
import type { ResourceInfo, UnifiedResourceEvent } from '../features/resources/types';
import { classifySchedulesError, type SchedulesErrorInfo } from '../features/schedules/errors';
import { createIrcSpClient, useSP } from '../lib/spClient';

import { IrcEventContent } from './IrcEventContent';
import { IrcEventDetailDialog } from './IrcEventDetailDialog';
import { IrcFilterToolbar } from './IrcFilterToolbar';
import { buildIrcCssVars, IRC_CALENDAR_STYLES } from './ircCalendarStyles';
import {
    evaluateMoveEvent,
    evaluateSelectEvent,
    fetchWarningEvents,
    getDynamicEventClasses,
    type CalendarExtendedProps,
    type EventAllowInfo,
    type ResourceWarning,
    type SelectAllowInfo,
    type SimpleResourceEvent,
} from './ircCalendarTypes';

// ─── Re-exports for backward compatibility (tests import from here) ────────
export { evaluateMoveEvent, evaluateSelectEvent } from './ircCalendarTypes';
export type { MoveDecision, MoveDecisionReason, MoveWindow, SelectDecision, SelectDecisionReason, SimpleResourceEvent } from './ircCalendarTypes';

// ─── Component ──────────────────────────────────────────────────────────────

export default function IntegratedResourceCalendarPage() {
  const location = useLocation();
  const { schedules } = useFeatureFlags();
  const appConfig = useMemo(() => getAppConfig(), []);
  const theme = useTheme();
  const ircCssVars = useMemo(() => buildIrcCssVars(theme.palette), [theme.palette]);

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('[IRC] mounted', {
      pathname: location.pathname,
      isE2E,
      timestamp: new Date().toISOString(),
    });
    // eslint-disable-next-line no-console
    console.log('[IRC] Current environment:', {
      VITE_E2E: isE2E,
      VITE_SP_RESOURCE: appConfig.VITE_SP_RESOURCE,
      VITE_FEATURE_SCHEDULES: schedules,
    });
  }

  const _sp = useSP();
  const ircSpClient = useMemo(() => {
    const client = createIrcSpClient();
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[IRC] SpClient created:', { isE2E, client });
    }
    return client;
  }, []);

  const calendarRef = useRef<FullCalendar>(null);
  const [resources, setResources] = useState<ResourceInfo[]>([]);
  const [events, setEvents] = useState<UnifiedResourceEvent[]>([]);
  const [lastError, setLastError] = useState<SchedulesErrorInfo | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<UnifiedResourceEvent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [showOnlyUnrecorded, setShowOnlyUnrecorded] = useState(false);
  const [resourceWarnings, setResourceWarnings] = useState<Record<string, ResourceWarning>>({});

  // Data loading
  useEffect(() => {
    const loadData = async () => {
      const dataSpan = startFeatureSpan(HYDRATION_FEATURES.integratedResourceCalendar.events, {
        status: 'pending',
        source: 'ircSpClient',
      });
      try {
        const fetchedResources: ResourceInfo[] = [];
        setResources(fetchedResources);
        const unifiedEvents = await ircSpClient.getUnifiedEvents();
        setEvents(unifiedEvents);
        setLastError(null);
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log('[IRC] Loaded resources:', fetchedResources.length);
          // eslint-disable-next-line no-console
          console.log('[IRC] Loaded events count:', unifiedEvents.length);
        }
        dataSpan({ meta: { status: 'ok', resourceCount: fetchedResources.length, eventCount: unifiedEvents.length } });
      } catch (error) {
        console.error('[IRC] Failed to load IRC data:', error);
        const errorInfo = classifySchedulesError(error);
        setLastError(errorInfo);
        setSnackbarOpen(true);
        dataSpan({ meta: { status: 'error' }, error: error instanceof Error ? error.message : String(error) });
        setFeedbackMessage(errorInfo.message || 'データの読み込みに失敗しました');
      }
    };
    loadData();
  }, [ircSpClient]);

  const recordedEventsCount = useMemo(
    () => events.filter((event) => !!event.extendedProps?.actualStart).length,
    [events],
  );

  const visibleEvents = useMemo(
    () => (showOnlyUnrecorded ? events.filter((event) => !event.extendedProps?.actualStart) : events),
    [showOnlyUnrecorded, events],
  );

  // Resource warnings calculation
  useEffect(() => {
    if (events.length === 0) return;
    const warningSpan = startFeatureSpan(HYDRATION_FEATURES.integratedResourceCalendar.warnings, {
      status: 'pending', events: events.length,
    });
    try {
      const totals: Record<string, ResourceWarning> = {};
      for (const event of events) {
        if (!event.resourceId) continue;
        const durationHours = (new Date(event.end).getTime() - new Date(event.start).getTime()) / (1000 * 60 * 60);
        if (!totals[event.resourceId]) totals[event.resourceId] = { totalHours: 0, isOver: false };
        totals[event.resourceId].totalHours += durationHours;
      }
      const WORK_HOUR_LIMIT = 8;
      for (const resourceId of Object.keys(totals)) {
        const rounded = Math.round(totals[resourceId].totalHours * 10) / 10;
        totals[resourceId].totalHours = rounded;
        totals[resourceId].isOver = rounded > WORK_HOUR_LIMIT;
      }
      setResourceWarnings(totals);
      warningSpan({ meta: { status: 'ok', resources: Object.keys(totals).length, bytes: estimatePayloadSize(totals) } });
    } catch (error) {
      warningSpan({ meta: { status: 'error' }, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }, [events]);

  // E2E: eventDidMount
  const handleEventDidMount = useCallback((info: EventMountArg) => {
    const event = info.event;
    const element = info.el;
    const eventProps = event.extendedProps as UnifiedResourceEvent['extendedProps'];
    const hasActual = eventProps?.actualStart;
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[IRC] eventDidMount called', { id: event.id, title: event.title, allEventsLength: visibleEvents.length });
    }
    const eventData = events.find((e) => e.id === event.id);
    const isLocked = hasActual || (eventData && eventData.editable === false);
    if (isE2E) {
      const testId = isLocked ? 'irc-event-locked' : `irc-event-editable-${event.id}`;
      element.setAttribute('data-testid', testId);
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[IRC] eventDidMount E2E testid set', { id: event.id, title: event.title, hasActual: !!hasActual, isLocked, testId });
      }
    }
  }, [events, visibleEvents]);

  const showSnackbar = (message: string) => { setSnackbarMessage(message); setSnackbarOpen(true); };

  // Event allow (drag & resize)
  const handleEventAllow = useCallback(
    (dropInfo: EventAllowInfo, draggedEvent: EventApi | null): boolean => {
      if (!draggedEvent) return false;
      const { start, end, resource } = dropInfo;
      if (!start || !end) return false;
      const calendarApi = calendarRef.current?.getApi();
      if (!calendarApi) return false;
      const allEvents = calendarApi.getEvents();
      const draggedProps = draggedEvent.extendedProps as CalendarExtendedProps;
      const targetResourceId = resource?.id ?? draggedEvent.getResources?.()[0]?.id ?? draggedProps?.resourceId;
      if (!targetResourceId) { setFeedbackMessage('リソースが特定できない場所には予定を移動できません。'); return false; }
      const simpleDragged: SimpleResourceEvent = { id: draggedEvent.id, resourceId: targetResourceId, start, end, display: draggedEvent.display, hasActual: !!draggedProps?.actualStart };
      const simpleEvents: SimpleResourceEvent[] = allEvents
        .map((eventApi) => { const ep = eventApi.extendedProps as CalendarExtendedProps; const rid = eventApi.getResources?.()[0]?.id ?? ep?.resourceId ?? ''; if (!rid || !eventApi.start || !eventApi.end) return null; return { id: eventApi.id, resourceId: rid, start: eventApi.start, end: eventApi.end, display: eventApi.display, hasActual: !!ep?.actualStart } as SimpleResourceEvent; })
        .filter((e): e is SimpleResourceEvent => e !== null);
      const decision = evaluateMoveEvent({ resourceId: targetResourceId, start, end }, simpleDragged, simpleEvents);
      if (!decision.allowed) {
        setFeedbackMessage(decision.reason === 'locked' ? '実績登録済みのため編集できません' : '同じスタッフの同じ時間帯に重複する予定は登録できません。');
        return false;
      }
      return true;
    },
    [setFeedbackMessage],
  );

  // Select allow (new event by drag)
  const handleSelectAllow = useCallback(
    (selectInfo: SelectAllowInfo): boolean => {
      const { start, end, resource } = selectInfo;
      if (!start || !end) return false;
      const calendarApi = calendarRef.current?.getApi();
      if (!calendarApi) return false;
      const targetResourceId = resource?.id ?? '';
      if (!targetResourceId) { setFeedbackMessage('リソース行上でのみ予定を作成できます。'); return false; }
      const simpleEvents: SimpleResourceEvent[] = calendarApi.getEvents()
        .map((eventApi) => { const ep = eventApi.extendedProps as CalendarExtendedProps; const rid = eventApi.getResources?.()[0]?.id ?? ep?.resourceId ?? ''; if (!rid || !eventApi.start || !eventApi.end) return null; return { id: eventApi.id, resourceId: rid, start: eventApi.start, end: eventApi.end, display: eventApi.display, hasActual: !!ep?.actualStart } as SimpleResourceEvent; })
        .filter((e): e is SimpleResourceEvent => e !== null);
      const decision = evaluateSelectEvent({ resourceId: targetResourceId, start, end }, simpleEvents);
      if (!decision.allowed) {
        setFeedbackMessage(decision.reason === 'no-resource' ? 'リソース行上でのみ予定を作成できます。' : 'すでに予定が入っている時間帯には新しい予定を作成できません。');
        return false;
      }
      return true;
    },
    [setFeedbackMessage],
  );

  // Resource area columns
  const resourceAreaColumns = useMemo(
    () => [
      { field: 'title', headerContent: 'スタッフ' },
      {
        headerContent: '総計画時間',
        field: 'id',
        cellContent: (arg: ResourceLabelContentArg) => {
          const resourceId = String(arg.resource.id ?? '');
          const warning = resourceWarnings[resourceId];
          if (!warning || warning.totalHours === 0) return React.createElement('span', { 'data-testid': `irc-resource-warning-${resourceId}` }, '0h');
          if (warning.isOver) return React.createElement('span', { style: { color: 'red', fontWeight: 'bold' }, 'data-testid': `irc-resource-warning-${resourceId}` }, `⚠️ ${warning.totalHours.toFixed(1)}h`);
          return React.createElement('span', { 'data-testid': `irc-resource-warning-${resourceId}` }, `${warning.totalHours.toFixed(1)}h`);
        },
      },
    ],
    [resourceWarnings],
  );

  const renderEventContent = (arg: EventContentArg) => <IrcEventContent {...arg} />;

  const handleEventClick = (info: EventClickArg) => {
    const props = info.event.extendedProps as UnifiedResourceEvent['extendedProps'];
    setSelectedEvent({ id: info.event.id, resourceId: info.event.getResources()[0]?.id || '', title: info.event.title, start: info.event.startStr, end: info.event.endStr || '', extendedProps: props });
    setDialogOpen(true);
  };

  const handleDateSelect = (info: DateSelectArg) => {
    const title = prompt('予定のタイトルを入力してください:');
    if (!title) return;
    const newEvent: UnifiedResourceEvent = { id: `plan-${Date.now()}`, resourceId: info.resource?.id || '', title, start: info.startStr, end: info.endStr, editable: true, extendedProps: { planId: `plan-${Date.now()}`, planType: 'visit', status: 'waiting' } };
    setEvents((prev) => [...prev, newEvent]);
    showSnackbar('予定を作成しました');
    if (import.meta.env.DEV && showOnlyUnrecorded) {
      // eslint-disable-next-line no-console
      console.log('[IRC] New event created in unrecorded filter mode');
    }
  };

  const handleDeleteEvent = useCallback((eventId: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    showSnackbar('予定を削除しました');
  }, []);

  // Mock real-time update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!calendarRef.current || typeof calendarRef.current.getApi !== 'function') return;
      const calendarApi = calendarRef.current.getApi();
      const event = calendarApi.getEventById('plan-1');
      if (!event) return;
      event.setExtendedProp('actualStart', new Date().toISOString());
      event.setExtendedProp('status', 'in-progress');
      event.setExtendedProp('percentComplete', 30);
      showSnackbar('実績が更新されました（モック）');
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Container maxWidth="xl" sx={{ py: 2 }} data-testid="irc-page">
      <Typography variant="overline" data-testid="irc-debug-banner" sx={{ display: 'block', mb: 1, color: 'primary.main', fontWeight: 'bold', backgroundColor: 'primary.50', padding: 1, borderRadius: 1 }}>
        IRC PAGE MOUNTED (debug) - E2E: {isE2E ? 'YES' : 'NO'}
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>統合リソースカレンダー</Typography>
        <Typography variant="subtitle1" component="span" color="text.secondary">Plan vs Actual 管理ビュー</Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>💡 Sprint 3 実装中: PvsA統合表示・リアルタイム更新機能</Alert>

      <IrcFilterToolbar
        showOnlyUnrecorded={showOnlyUnrecorded}
        onToggleUnrecorded={setShowOnlyUnrecorded}
        totalEvents={events.length}
        recordedEvents={recordedEventsCount}
        visibleEvents={visibleEvents.length}
      />

      <Paper elevation={1} style={ircCssVars as React.CSSProperties}>
        <Box sx={{ height: '70vh' }}>
          <style>{IRC_CALENDAR_STYLES}</style>
          <FullCalendar
            ref={calendarRef}
            key={`calendar-${visibleEvents.length}`}
            plugins={[resourceTimelinePlugin, interactionPlugin]}
            initialView="resourceTimelineDay"
            initialDate="2025-11-16"
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'resourceTimelineDay,resourceTimelineWeek' }}
            resources={resources}
            resourceAreaColumns={resourceAreaColumns}
            events={visibleEvents}
            eventSources={[{ id: 'warning-events', events: fetchWarningEvents, display: 'background', color: 'rgba(255, 0, 0, 0.15)', className: 'fc-event-warning-bg' }]}
            eventContent={renderEventContent}
            eventClassNames={getDynamicEventClasses}
            eventDidMount={handleEventDidMount}
            editable={true}
            selectable={true}
            selectMirror={true}
            eventAllow={handleEventAllow}
            selectAllow={handleSelectAllow}
            eventOverlap={true}
            select={handleDateSelect}
            eventClick={handleEventClick}
            height="auto"
            slotMinTime="07:00:00"
            slotMaxTime="20:00:00"
            slotDuration="00:30:00"
            resourceAreaWidth="300px"
            resourceAreaHeaderContent="リソース"
            locale="ja"
            timeZone="Asia/Tokyo"
            nowIndicator={true}
          />
        </Box>
      </Paper>

      <IrcEventDetailDialog
        open={dialogOpen}
        event={selectedEvent}
        onClose={() => setDialogOpen(false)}
        onDelete={handleDeleteEvent}
      />

      <Snackbar open={snackbarOpen || !!lastError} autoHideDuration={6000} onClose={() => { setSnackbarOpen(false); setLastError(null); }}>
        <Alert severity={lastError?.kind === 'NETWORK_ERROR' ? 'error' : 'warning'} onClose={() => { setSnackbarOpen(false); setLastError(null); }} data-testid="irc-error-alert">
          {lastError?.message || snackbarMessage}
        </Alert>
      </Snackbar>

      <Snackbar open={!!feedbackMessage} autoHideDuration={4000} onClose={(_, reason) => { if (reason === 'clickaway') return; setFeedbackMessage(null); }} message={feedbackMessage} />
    </Container>
  );
}
