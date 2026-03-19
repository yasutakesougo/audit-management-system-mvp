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
  type TagCount,
  type TagTrend,
  type TagTrendItem,
  type TagTimeSlotDistribution,
  type UserTopTags,
  type TagAnalyticsInput,
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
