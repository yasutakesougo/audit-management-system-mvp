/**
 * 申し送り分析モジュール — Public API
 */

// ── Pure Functions ──
export { extractKeywords } from './extractKeywords';
export { computeUserTrends } from './computeUserTrends';
export { computeTimePatterns } from './computeTimePatterns';

// ── Types ──
export type {
  KeywordCategory,
  KeywordHit,
  KeywordExtractionResult,
  UserTrend,
  TrendDirection,
  TimePattern,
} from './analysisTypes';

export type {
  TimePatternEntry,
  TimePatternResult,
} from './computeTimePatterns';

export type {
  ComputeUserTrendsOptions,
} from './computeUserTrends';

// ── Components ──
export { default as HandoffAnalysisDashboard } from './components/HandoffAnalysisDashboard';
export type { HandoffAnalysisDashboardProps } from './components/HandoffAnalysisDashboard';
