export interface TodayQueueTelemetrySample {
  timestamp: number;
  queueSize: number;
  p0Count: number;
  p1Count: number;
  p2Count: number;
  p3Count: number;
  overdueCount: number;
  requiresAttentionCount: number;
}
