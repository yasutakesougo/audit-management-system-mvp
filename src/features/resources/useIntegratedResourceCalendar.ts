/**
 * useIntegratedResourceCalendar — Container hook.
 *
 * All state management, data-fetching, and event handlers live here.
 * The page component is a thin shell that renders presentational components.
 */
import type {
    DateSelectArg,
    DateSpanApi,
    EventApi,
    EventClickArg,
    EventMountArg,
} from '@fullcalendar/core';
import FullCalendar from '@fullcalendar/react';
import type { ResourceLabelContentArg } from '@fullcalendar/resource';
import { useTheme } from '@mui/material/styles';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { useFeatureFlags } from '@/config/featureFlags';
import { isE2E } from '@/env';
import { estimatePayloadSize, HYDRATION_FEATURES, startFeatureSpan } from '@/hydration/features';
import { getAppConfig } from '@/lib/env';

import type { SchedulesErrorInfo } from '@/features/schedules/errors';
import { classifySchedulesError } from '@/features/schedules/errors';
import { createIrcSpClient, useSP } from '@/lib/spClient';

import { buildIrcCssVars } from './ircCalendarStyles';
import type { ResourceWarningEntry, SimpleResourceEvent } from './ircEventLogic';
import { evaluateMoveEvent, evaluateSelectEvent, WORK_HOUR_LIMIT } from './ircEventLogic';
import type { ResourceInfo, UnifiedResourceEvent } from './types';

// ── Internal types ─────────────────────────────────────────────────────────

type CalendarExtendedProps = UnifiedResourceEvent['extendedProps'] & {
  resourceId?: string;
};

type EventAllowInfo = {
  start: Date | null;
  end: Date | null;
  resource?: { id?: string };
};

type SelectAllowInfo = DateSpanApi & { resource?: { id?: string } };

// ── Hook ───────────────────────────────────────────────────────────────────

export function useIntegratedResourceCalendar() {
  const location = useLocation();
  const { schedules } = useFeatureFlags();
  const appConfig = useMemo(() => getAppConfig(), []);
  const theme = useTheme();

  // Debug logging (dev only)
  if (import.meta.env.DEV) {
    console.log('[IRC] mounted', {
      pathname: location.pathname,
      isE2E,
      timestamp: new Date().toISOString(),
    });
    console.log('[IRC] Current environment:', {
      VITE_E2E: isE2E,
      VITE_SP_RESOURCE: appConfig.VITE_SP_RESOURCE,
      VITE_FEATURE_SCHEDULES: schedules,
    });
  }

  // SP client
  const _sp = useSP();
  const ircSpClient = useMemo(() => {
    const client = createIrcSpClient();
    if (import.meta.env.DEV) {
      console.log('[IRC] SpClient created:', { isE2E, client });
    }
    return client;
  }, []);

  // CSS vars from theme
  const ircCssVars = useMemo(() => buildIrcCssVars(theme), [theme.palette]);

  // ── State ──────────────────────────────────────────────────────────────
  // Cast needed: FullCalendar is a class component with legacy ref typing
  const calendarRef = useRef<FullCalendar>(null) as React.RefObject<FullCalendar>;
  const [resources, setResources] = useState<ResourceInfo[]>([]);
  const [events, setEvents] = useState<UnifiedResourceEvent[]>([]);
  const [lastError, setLastError] = useState<SchedulesErrorInfo | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<UnifiedResourceEvent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [showOnlyUnrecorded, setShowOnlyUnrecorded] = useState(false);
  const [resourceWarnings, setResourceWarnings] = useState<
    Record<string, ResourceWarningEntry>
  >({});

  // ── Data loading ───────────────────────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      const dataSpan = startFeatureSpan(
        HYDRATION_FEATURES.integratedResourceCalendar.events,
        { status: 'pending', source: 'ircSpClient' },
      );
      try {
        const fetchedResources: ResourceInfo[] = [];
        setResources(fetchedResources);

        const unifiedEvents = await ircSpClient.getUnifiedEvents();
        setEvents(unifiedEvents);
        setLastError(null);

        if (import.meta.env.DEV) {
          console.log('[IRC] Loaded resources:', fetchedResources.length);
          console.log('[IRC] Loaded events count:', unifiedEvents.length);
        }

        dataSpan({
          meta: {
            status: 'ok',
            resourceCount: fetchedResources.length,
            eventCount: unifiedEvents.length,
          },
        });
      } catch (error) {
        console.error('[IRC] Failed to load IRC data:', error);
        const errorInfo = classifySchedulesError(error);
        setLastError(errorInfo);
        setSnackbarOpen(true);

        dataSpan({
          meta: { status: 'error' },
          error: error instanceof Error ? error.message : String(error),
        });

        setFeedbackMessage(errorInfo.message || 'データの読み込みに失敗しました');
      }
    };

    loadData();
  }, [ircSpClient]);

  // ── Derived state ──────────────────────────────────────────────────────
  const recordedEventsCount = useMemo(
    () => events.filter((e) => !!e.extendedProps?.actualStart).length,
    [events],
  );

  const visibleEvents = useMemo(
    () =>
      showOnlyUnrecorded
        ? events.filter((e) => !e.extendedProps?.actualStart)
        : events,
    [showOnlyUnrecorded, events],
  );

  // ── Resource warnings (8h capacity) ────────────────────────────────────
  useEffect(() => {
    if (events.length === 0) return;

    const warningSpan = startFeatureSpan(
      HYDRATION_FEATURES.integratedResourceCalendar.warnings,
      { status: 'pending', events: events.length },
    );

    try {
      const totals: Record<string, ResourceWarningEntry> = {};

      for (const event of events) {
        if (!event.resourceId) continue;
        const durationHours =
          (new Date(event.end).getTime() - new Date(event.start).getTime()) /
          (1000 * 60 * 60);

        if (!totals[event.resourceId]) {
          totals[event.resourceId] = { totalHours: 0, isOver: false };
        }
        totals[event.resourceId].totalHours += durationHours;
      }

      for (const resourceId of Object.keys(totals)) {
        const rounded = Math.round(totals[resourceId].totalHours * 10) / 10;
        totals[resourceId].totalHours = rounded;
        totals[resourceId].isOver = rounded > WORK_HOUR_LIMIT;
      }

      setResourceWarnings(totals);
      warningSpan({
        meta: {
          status: 'ok',
          resources: Object.keys(totals).length,
          bytes: estimatePayloadSize(totals),
        },
      });
    } catch (error) {
      warningSpan({
        meta: { status: 'error' },
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }, [events]);

  // ── E2E event mount handler ────────────────────────────────────────────
  const handleEventDidMount = useCallback(
    (info: EventMountArg) => {
      const event = info.event;
      const element = info.el;
      const eventProps = event.extendedProps as UnifiedResourceEvent['extendedProps'];
      const hasActual = eventProps?.actualStart;

      if (import.meta.env.DEV) {
        console.log('[IRC] eventDidMount called', {
          id: event.id,
          title: event.title,
          allEventsLength: visibleEvents.length,
        });
      }

      const eventData = events.find((e) => e.id === event.id);
      const isLocked = hasActual || (eventData && eventData.editable === false);

      if (isE2E) {
        const testId = isLocked
          ? 'irc-event-locked'
          : `irc-event-editable-${event.id}`;

        element.setAttribute('data-testid', testId);
        if (import.meta.env.DEV) {
          console.log('[IRC] eventDidMount E2E testid set', {
            id: event.id,
            testId,
          });
        }
      }
    },
    [events, visibleEvents],
  );

  // ── Snackbar helper ────────────────────────────────────────────────────
  const showSnackbar = useCallback((message: string) => {
    setSnackbarMessage(message);
    setSnackbarOpen(true);
  }, []);

  // ── Event allow (drag / resize) ────────────────────────────────────────
  const handleEventAllow = useCallback(
    (dropInfo: EventAllowInfo, draggedEvent: EventApi | null): boolean => {
      if (!draggedEvent) return false;

      const { start, end, resource } = dropInfo;
      if (!start || !end) return false;

      const calendarApi = calendarRef.current?.getApi();
      if (!calendarApi) return false;

      const allEvents = calendarApi.getEvents();
      const draggedProps = draggedEvent.extendedProps as CalendarExtendedProps;
      const targetResourceId =
        resource?.id ??
        draggedEvent.getResources?.()[0]?.id ??
        draggedProps?.resourceId;

      if (!targetResourceId) {
        setFeedbackMessage('リソースが特定できない場所には予定を移動できません。');
        return false;
      }

      const simpleDragged: SimpleResourceEvent = {
        id: draggedEvent.id,
        resourceId: targetResourceId,
        start,
        end,
        display: draggedEvent.display,
        hasActual: !!draggedProps?.actualStart,
      };

      const simpleEvents: SimpleResourceEvent[] = allEvents
        .map((eventApi) => {
          const ep = eventApi.extendedProps as CalendarExtendedProps;
          const resId =
            eventApi.getResources?.()[0]?.id ?? ep?.resourceId ?? '';

          if (!resId || !eventApi.start || !eventApi.end) return null;

          return {
            id: eventApi.id,
            resourceId: resId,
            start: eventApi.start,
            end: eventApi.end,
            display: eventApi.display,
            hasActual: !!ep?.actualStart,
          } as SimpleResourceEvent;
        })
        .filter((e): e is SimpleResourceEvent => e !== null);

      const decision = evaluateMoveEvent(
        { resourceId: targetResourceId, start, end },
        simpleDragged,
        simpleEvents,
      );

      if (!decision.allowed) {
        setFeedbackMessage(
          decision.reason === 'locked'
            ? '実績登録済みのため編集できません'
            : '同じスタッフの同じ時間帯に重複する予定は登録できません。',
        );
        return false;
      }

      return true;
    },
    [setFeedbackMessage],
  );

  // ── Select allow (new event creation) ──────────────────────────────────
  const handleSelectAllow = useCallback(
    (selectInfo: SelectAllowInfo): boolean => {
      const { start, end, resource } = selectInfo;
      if (!start || !end) return false;

      const calendarApi = calendarRef.current?.getApi();
      if (!calendarApi) return false;

      const allEvents = calendarApi.getEvents();
      const targetResourceId = resource?.id ?? '';

      if (!targetResourceId) {
        setFeedbackMessage('リソース行上でのみ予定を作成できます。');
        return false;
      }

      const simpleEvents: SimpleResourceEvent[] = allEvents
        .map((eventApi) => {
          const ep = eventApi.extendedProps as CalendarExtendedProps;
          const resId =
            eventApi.getResources?.()[0]?.id ?? ep?.resourceId ?? '';
          if (!resId || !eventApi.start || !eventApi.end) return null;
          return {
            id: eventApi.id,
            resourceId: resId,
            start: eventApi.start,
            end: eventApi.end,
            display: eventApi.display,
            hasActual: !!ep?.actualStart,
          } as SimpleResourceEvent;
        })
        .filter((e): e is SimpleResourceEvent => e !== null);

      const decision = evaluateSelectEvent(
        { resourceId: targetResourceId, start, end },
        simpleEvents,
      );

      if (!decision.allowed) {
        setFeedbackMessage(
          decision.reason === 'no-resource'
            ? 'リソース行上でのみ予定を作成できます。'
            : 'すでに予定が入っている時間帯には新しい予定を作成できません。',
        );
        return false;
      }

      return true;
    },
    [setFeedbackMessage],
  );

  // ── Resource area columns ──────────────────────────────────────────────
  const resourceAreaColumns = useMemo(
    () => [
      { field: 'title', headerContent: 'スタッフ' },
      {
        headerContent: '総計画時間',
        field: 'id',
        cellContent: (arg: ResourceLabelContentArg) => {
          const resourceId = String(arg.resource.id ?? '');
          const warning = resourceWarnings[resourceId];

          if (!warning || warning.totalHours === 0) {
            return React.createElement(
              'span',
              { 'data-testid': `irc-resource-warning-${resourceId}` },
              '0h',
            );
          }

          if (warning.isOver) {
            return React.createElement(
              'span',
              {
                style: { color: 'red', fontWeight: 'bold' },
                'data-testid': `irc-resource-warning-${resourceId}`,
              },
              `⚠️ ${warning.totalHours.toFixed(1)}h`,
            );
          }

          return React.createElement(
            'span',
            { 'data-testid': `irc-resource-warning-${resourceId}` },
            `${warning.totalHours.toFixed(1)}h`,
          );
        },
      },
    ],
    [resourceWarnings],
  );

  // ── Event click ────────────────────────────────────────────────────────
  const handleEventClick = useCallback((info: EventClickArg) => {
    const props = info.event.extendedProps as UnifiedResourceEvent['extendedProps'];
    const unifiedEvent: UnifiedResourceEvent = {
      id: info.event.id,
      resourceId: info.event.getResources()[0]?.id || '',
      title: info.event.title,
      start: info.event.startStr,
      end: info.event.endStr || '',
      extendedProps: props,
    };
    setSelectedEvent(unifiedEvent);
    setDialogOpen(true);
  }, []);

  // ── Date select (new event) ────────────────────────────────────────────
  const handleDateSelect = useCallback(
    (info: DateSelectArg) => {
      const title = prompt('予定のタイトルを入力してください:');
      if (!title) return;

      const newEvent: UnifiedResourceEvent = {
        id: `plan-${Date.now()}`,
        resourceId: info.resource?.id || '',
        title,
        start: info.startStr,
        end: info.endStr,
        editable: true,
        extendedProps: {
          planId: `plan-${Date.now()}`,
          planType: 'visit',
          status: 'waiting',
        },
      };

      setEvents((prev) => [...prev, newEvent]);
      showSnackbar('予定を作成しました');

      if (showOnlyUnrecorded && import.meta.env.DEV) {
        console.log('[IRC] New event created in unrecorded filter mode');
      }
    },
    [showOnlyUnrecorded, showSnackbar],
  );

  // ── Delete event ───────────────────────────────────────────────────────
  const handleDeleteEvent = useCallback(
    (eventId: string) => {
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      setDialogOpen(false);
      showSnackbar('予定を削除しました');
    },
    [showSnackbar],
  );

  // ── Mock real-time update ──────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!calendarRef.current || typeof calendarRef.current.getApi !== 'function')
        return;
      const calendarApi = calendarRef.current.getApi();

      const event = calendarApi.getEventById('plan-1');
      if (!event) return;

      event.setExtendedProp('actualStart', new Date().toISOString());
      event.setExtendedProp('status', 'in-progress');
      event.setExtendedProp('percentComplete', 30);

      showSnackbar('実績が更新されました（モック）');
    }, 5000);

    return () => clearTimeout(timer);
  }, [showSnackbar]);

  // ── Close handlers ─────────────────────────────────────────────────────
  const handleCloseSnackbar = useCallback(() => {
    setSnackbarOpen(false);
    setLastError(null);
  }, []);

  const handleCloseFeedback = useCallback(() => {
    setFeedbackMessage(null);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);

  // ── Return ─────────────────────────────────────────────────────────────
  return {
    // Refs
    calendarRef,

    // State
    resources,
    events,
    visibleEvents,
    recordedEventsCount,
    showOnlyUnrecorded,
    ircCssVars,
    resourceAreaColumns,

    // Dialog
    selectedEvent,
    dialogOpen,

    // Snackbar / feedback
    snackbarOpen,
    snackbarMessage,
    lastError,
    feedbackMessage,

    // Actions
    setShowOnlyUnrecorded,
    handleEventAllow,
    handleSelectAllow,
    handleDateSelect,
    handleEventClick,
    handleEventDidMount,
    handleDeleteEvent,
    handleCloseSnackbar,
    handleCloseFeedback,
    handleCloseDialog,
  } as const;
}
