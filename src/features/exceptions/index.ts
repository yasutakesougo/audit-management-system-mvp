/**
 * @fileoverview exceptions feature — public API
 */

// Domain
export {
  aggregateExceptions,
  computeExceptionStats,
  detectAttentionUsers,
  detectCriticalHandoffs,
  detectMissingRecords,
  detectMissingSupportLogs,
  EXCEPTION_CATEGORIES,
  SEVERITY_ORDER,
} from './domain/exceptionLogic';
export {
  buildChildCountByParentId,
  computeExceptionPriorityBreakdown,
  computeExceptionPriorityScore,
} from './domain/computeExceptionPriorityScore';

export type {
  ExceptionCategory,
  ExceptionItem,
  ExceptionSeverity,
  ExceptionStats,
} from './domain/exceptionLogic';
export type {
  ComputeExceptionPriorityScoreOptions,
  ExceptionPriorityBreakdown,
  ExceptionPrioritySignal,
} from './domain/computeExceptionPriorityScore';

// Components
export { ExceptionTable } from './components/ExceptionTable';
export type { ExceptionTableProps } from './components/ExceptionTable';
