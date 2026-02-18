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
