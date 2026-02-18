export const MASTER_SCHEDULE_TITLE_JA = '予定表' as const;

/**
 * DayView timeline spacing tokens.
 * Provides consistent responsive spacing for timeline-style schedule cards.
 * Used for padding, gaps, and grid layout in DayView component.
 */
export const SCHEDULE_TIMELINE_SPACING = {
  // Item content box padding (the card itself)
  itemPaddingCompact: '4px 8px',
  itemPaddingNormal: '6px 10px',

  // Gap between timeline items in the list
  itemGapCompact: 4,
  itemGapNormal: 8,

  // Column/row gaps within a single item (meta spacing)
  itemGridGapCompact: 8,
  itemGridGapNormal: 12,

  // Header area gaps (title + date label area)
  headerGapCompact: 6,
  headerGapNormal: 8,

  // Timeline rail/indicators
  railWidth: 2,
  dotSize: 10,
} as const;

/**
 * MonthPage grid spacing tokens.
 * Provides consistent responsive spacing for calendar grid cells and layout.
 * Separate from card/timeline tokens to allow independent grid density adjustment.
 */
export const SCHEDULE_MONTH_SPACING = {
  // Header section padding
  headerPaddingCompact: '12px 8px 24px',
  headerPaddingNormal: '16px 12px 32px',

  // Calendar grid gap between cells
  gridGapCompact: 6,
  gridGapNormal: 8,

  // Weekday header row padding
  weekdayHeaderPaddingCompact: '1px 0',
  weekdayHeaderPaddingNormal: '4px 0',

  // Individual day cell padding (flex container)
  cellPaddingCompact: '6px 8px',
  cellPaddingNormal: '10px 12px',

  // Gap between elements inside day cell (badge/event title/etc)
  cellGapCompact: 0,
  cellGapNormal: 1,

  // Minimum height for day cell (flexible based on content)
  cellMinHeightCompact: 64,
  cellMinHeightNormal: 90,
} as const;
