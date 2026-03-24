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

export type {
  ExceptionCategory,
  ExceptionItem,
  ExceptionSeverity,
  ExceptionStats,
} from './domain/exceptionLogic';

// Components
export { ExceptionTable } from './components/ExceptionTable';
export type { ExceptionTableProps } from './components/ExceptionTable';
