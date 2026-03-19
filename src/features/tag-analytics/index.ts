/**
 * @fileoverview Phase F1: tag-analytics feature — public API
 */

// Domain
export {
  computeTagCounts,
  computeTagTrend,
  computeTagTimeSlots,
  computeUserTopTags,
  getTopTagsFromCounts,
  presetToDateRange,
  PERIOD_PRESETS,
  PERIOD_PRESET_ORDER,
  type TagCount,
  type TagTrend,
  type TagTrendItem,
  type TagTimeSlotDistribution,
  type UserTopTags,
  type TagAnalyticsInput,
  type PeriodPreset,
} from './domain/tagAnalytics';

// Hooks
export {
  useTagAnalytics,
  type TagAnalytics,
  type TagAnalyticsStatus,
  type DateRangeInput,
} from './hooks/useTagAnalytics';

// Components
export { TagAnalyticsSection } from './components/TagAnalyticsSection';
