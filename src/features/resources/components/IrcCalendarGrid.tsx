/**
 * IRC — FullCalendar wrapper (Presentational).
 *
 * Receives all data and handlers via props. Zero business logic.
 */
import type {
    DateSelectArg,
    DateSpanApi,
    EventApi,
    EventClickArg,
    EventContentArg,
    EventMountArg,
} from '@fullcalendar/core';
import interactionPlugin from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import { Box, Paper } from '@mui/material';
import React from 'react';

import { IRC_CALENDAR_CSS } from '../ircCalendarStyles';
import { fetchWarningEvents, getDynamicEventClasses } from '../ircEventLogic';
import type { ResourceInfo, UnifiedResourceEvent } from '../types';
import PvsAEventContent from './PvsAEventContent';

type SelectAllowInfo = DateSpanApi & { resource?: { id?: string } };

export interface IrcCalendarGridProps {
  calendarRef: React.RefObject<FullCalendar>;
  resources: ResourceInfo[];
  visibleEvents: UnifiedResourceEvent[];
  resourceAreaColumns: object[];
  cssVars: React.CSSProperties;

  // Callbacks
  onEventAllow: (
    dropInfo: { start: Date | null; end: Date | null; resource?: { id?: string } },
    draggedEvent: EventApi | null,
  ) => boolean;
  onSelectAllow: (
    selectInfo: SelectAllowInfo,
  ) => boolean;
  onDateSelect: (info: DateSelectArg) => void;
  onEventClick: (info: EventClickArg) => void;
  onEventDidMount: (info: EventMountArg) => void;
}

const renderEventContent = (arg: EventContentArg) => (
  <PvsAEventContent {...arg} />
);

export const IrcCalendarGrid: React.FC<IrcCalendarGridProps> = ({
  calendarRef,
  resources,
  visibleEvents,
  resourceAreaColumns,
  cssVars,
  onEventAllow,
  onSelectAllow,
  onDateSelect,
  onEventClick,
  onEventDidMount,
}) => (
  <Paper elevation={1} style={cssVars}>
    <Box sx={{ height: '70vh' }}>
      <style>{IRC_CALENDAR_CSS}</style>

      <FullCalendar
        ref={calendarRef}
        key={`calendar-${visibleEvents.length}`}
        plugins={[resourceTimelinePlugin, interactionPlugin]}
        initialView="resourceTimelineDay"
        initialDate="2025-11-16"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'resourceTimelineDay,resourceTimelineWeek',
        }}
        resources={resources}
        resourceAreaColumns={resourceAreaColumns}
        events={visibleEvents}
        eventSources={[
          {
            id: 'warning-events',
            events: fetchWarningEvents,
            display: 'background',
            color: 'rgba(255, 0, 0, 0.15)',
            className: 'fc-event-warning-bg',
          },
        ]}
        eventContent={renderEventContent}
        eventClassNames={getDynamicEventClasses}
        eventDidMount={onEventDidMount}
        editable={true}
        selectable={true}
        selectMirror={true}
        eventAllow={onEventAllow}
        selectAllow={onSelectAllow}
        eventOverlap={true}
        select={onDateSelect}
        eventClick={onEventClick}
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
);

export default IrcCalendarGrid;
