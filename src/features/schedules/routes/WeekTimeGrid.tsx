/**
 * WeekTimeGrid.tsx — Time grid sub-component extracted from WeekView.tsx
 *
 * Renders the 7-day × time-slot grid with sticky headers, slot rows, and schedule item cards.
 * Hover state (hoveredCell) is owned internally to keep the parent props surface small.
 */
import React, { useState } from 'react';
import type { SchedItem } from '../data';
import { _generateTimeSlots, getTimeInTz } from './weekViewHelpers';

type WeekSchedItem = SchedItem & {
  staffNames?: string[];
  location?: string;
  baseShiftWarnings?: { staffId?: string; staffName?: string }[];
};

export type WeekTimeGridProps = {
  weekDays: { iso: string; label: string }[];
  todayIso: string;
  groupedItems: Map<string, WeekSchedItem[]>;
  onTimeSlotClick?: (dayIso: string, time: string) => void;
  onItemSelect?: (item: WeekSchedItem) => void;
};

export function WeekTimeGrid({
  weekDays,
  todayIso,
  groupedItems,
  onTimeSlotClick,
  onItemSelect,
}: WeekTimeGridProps) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  return (
    <div
      aria-label="週ごとの時間割"
      data-testid="schedules-week-grid"
      className="w-full"
      style={{
        display: 'grid',
        gridTemplateColumns: '80px repeat(7, 1fr)',
        gap: 0,
        border: '1px solid rgba(15,23,42,0.08)',
        borderRadius: 8,
        backgroundColor: '#fff',
        maxHeight: 'calc(100vh - 280px)',
        overflow: 'auto',
      }}
    >
      {/* Time Labels Header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          gridColumn: 1,
          gridRow: '1 / span 1',
          padding: '8px 4px',
          textAlign: 'center',
          fontSize: 11,
          fontWeight: 600,
          borderRight: '1px solid rgba(15,23,42,0.08)',
          borderBottom: '1px solid rgba(15,23,42,0.08)',
          color: 'rgba(15,23,42,0.7)',
          backgroundColor: '#fff',
        }}
      >
        時刻
      </div>
      {weekDays.map((day, dayIndex) => (
        <div
          key={`header-${day.iso}`}
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            gridColumn: dayIndex + 2,
            gridRow: 1,
            padding: '8px 4px',
            textAlign: 'center',
            fontSize: 12,
            fontWeight: 700,
            color: 'rgba(15,23,42,0.88)',
            borderRight: dayIndex < 6 ? '1px solid rgba(15,23,42,0.08)' : 'none',
            borderBottom: '1px solid rgba(15,23,42,0.08)',
            backgroundColor: day.iso === todayIso ? '#E8F0E4' : '#fff',
          }}
        >
          <div>{day.label}</div>
          {day.iso === todayIso && (
            <span style={{ fontSize: 10, color: '#3D6B3C', fontWeight: 600 }}>今日</span>
          )}
        </div>
      ))}

      {/* Time Slots Grid */}
      {_generateTimeSlots().map((timeStr, slotIndex) => {
        const isEvenSlot = slotIndex % 2 === 0;
        return (
          <React.Fragment key={`slot-${timeStr}`}>
            {/* Time Label */}
            <div
              style={{
                position: 'sticky',
                left: 0,
                zIndex: 5,
                gridColumn: 1,
                gridRow: slotIndex + 2,
                padding: '4px',
                textAlign: 'right',
                fontSize: 10,
                fontWeight: 500,
                borderRight: '1px solid rgba(15,23,42,0.08)',
                borderBottom: '1px solid rgba(15,23,42,0.08)',
                color: 'rgba(15,23,42,0.6)',
                backgroundColor: isEvenSlot ? 'rgba(15,23,42,0.01)' : '#fff',
                paddingRight: '6px',
              }}
            >
              {timeStr}
            </div>

            {/* Day Cells */}
            {weekDays.map((day, dayIndex) => {
              const cellKey = `${day.iso}-${timeStr}`;
              const cellItems = (groupedItems.get(day.iso) ?? []).filter((item) => {
                // Filter by time slot (JST timezone-aware)
                const { hour: itemStartHour, minute: itemStartMin } = getTimeInTz(item.start);
                const [slotHour, slotMin] = timeStr.split(':').map(Number);
                return itemStartHour === slotHour && itemStartMin === slotMin;
              });

              const handleCellClick = () => {
                onTimeSlotClick?.(day.iso, timeStr);
              };

              const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
                event.preventDefault();
                event.stopPropagation();
                handleCellClick();
              };

              return (
                <div
                  key={cellKey}
                  aria-label={`${day.label} ${timeStr}時間帯`}
                  data-testid="schedules-week-slot"
                  data-day={day.iso}
                  data-time={timeStr}
                  onPointerUp={handlePointerUp}
                  onClick={(event) => {
                    if (typeof window !== 'undefined' && 'PointerEvent' in window) return;
                    event.preventDefault();
                    event.stopPropagation();
                    handleCellClick();
                  }}
                  onFocus={(event) => {
                    event.currentTarget.style.boxShadow = '0 0 0 2px rgba(25,118,210,0.35)';
                  }}
                  onBlur={(event) => {
                    event.currentTarget.style.boxShadow = 'none';
                  }}
                  onMouseEnter={() => setHoveredCell(cellKey)}
                  onMouseLeave={() => setHoveredCell(null)}
                  tabIndex={0}
                  role="button"
                  style={{
                    all: 'unset',
                    display: 'block',
                    gridColumn: dayIndex + 2,
                    gridRow: slotIndex + 2,
                    width: '100%',
                    minHeight: '40px',
                    outline: 'none',
                    borderRadius: 6,
                    borderRight: dayIndex < 6 ? '1px solid rgba(15,23,42,0.08)' : 'none',
                    borderBottom: '1px solid rgba(15,23,42,0.08)',
                    backgroundColor: hoveredCell === cellKey ? 'rgba(59,130,246,0.1)' : isEvenSlot ? 'rgba(15,23,42,0.01)' : 'transparent',
                    padding: '2px 4px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {cellItems.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '2px' }}>
                      {cellItems.map((item, idx) => (
                        <button
                          key={item.id || idx}
                          type="button"
                          data-testid="schedule-item"
                          data-schedule-id={item.id}
                          data-id={item.id}
                          data-category={item.category ?? 'Org'}
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onPointerUp={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation(); // Prevent bubbling to parent cell
                            onItemSelect?.(item); // Open the specific item clicked
                          }}
                          style={{
                            all: 'unset',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            width: '100%',
                            fontSize: 10,
                            padding: '2px 4px',
                            backgroundColor: 'rgba(59,130,246,0.2)',
                            borderLeft: '3px solid rgb(59,130,246)',
                            borderRadius: '2px',
                            overflow: 'hidden',
                            color: 'rgba(0,0,0,0.8)',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.2)';
                          }}
                          title={item.title}
                        >
                          <span style={{ flex: 1, textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                            {item.userName || item.title}
                          </span>
                          {item.baseShiftWarnings && item.baseShiftWarnings.length > 0 && (
                            <div
                              data-testid="schedule-warning-indicator"
                              title={`Shift warning: ${item.baseShiftWarnings.map(w => w.staffName).join(', ')}`}
                              style={{
                                flexShrink: 0,
                                fontSize: 9,
                                padding: '0 2px',
                                borderRadius: 2,
                                background: '#f57c00',
                                color: '#fff',
                                fontWeight: 700,
                                minWidth: '16px',
                                textAlign: 'center',
                                lineHeight: 1,
                              }}
                            >
                              ⚠
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
}
