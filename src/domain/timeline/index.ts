/**
 * Timeline Domain — 公開 API
 */

// 型
export type {
  TimelineEvent,
  TimelineEventSource,
  TimelineSeverity,
  TimelineFilter,
  ResolveUserIdFromCode,
} from './types';

// 定数
export { TIMELINE_SOURCES, TIMELINE_SOURCE_LABELS } from './types';

// コア関数
export { buildTimeline } from './buildTimeline';
export type { TimelineSources, TimelineOptions } from './buildTimeline';

// adapters (個別利用が必要な場合)
export {
  dailyToTimelineEvent,
  incidentToTimelineEvent,
  ispToTimelineEvent,
  handoffToTimelineEvent,
} from './adapters';
