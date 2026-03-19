/**
 * @fileoverview tag-analytics feature — public API (F1 + F1.5 + F2)
 */

// Domain - Core
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

// Domain - Trend Alerts (F2)
export {
  detectTagTrends,
  DEFAULT_THRESHOLDS,
  type TrendAlert,
  type TrendAlertType,
  type TrendAlertSeverity,
  type TagTrendAlerts,
  type DetectTagTrendsInput,
  type TrendThresholds,
} from './domain/tagTrendAlerts';

// Hooks
export {
  useTagAnalytics,
  type TagAnalytics,
  type TagAnalyticsStatus,
  type DateRangeInput,
} from './hooks/useTagAnalytics';

// Components
export { TagAnalyticsSection } from './components/TagAnalyticsSection';
export { TrendAlertsBanner } from './components/TrendAlertsBanner';
