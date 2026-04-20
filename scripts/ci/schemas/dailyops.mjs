/**
 * Schema definition for DailyOpsSignals.
 * Used by CI for drift detection.
 */

export const LIST_TITLE = 'DailyOpsSignals';

export const ESSENTIAL_FIELDS = [
  'date',
  'targetType',
  'targetId',
  'kind',
  'summary',
  'status',
];

export const OPTIONAL_FIELDS = [
  'time',
  'source',
];
