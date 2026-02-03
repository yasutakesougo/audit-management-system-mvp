// src/features/auth/diagnostics/index.ts
export { authDiagnostics, exposeAuthDiagnosticsToWindow, getSafeRoute } from './collector';
export type {
  AuthDiagnosticEvent,
  AuthDiagnosticOutcome,
  AuthDiagnosticReason,
  AuthDiagnosticCollectInput,
  AuthDiagnosticsListener,
} from './collector';
export { default as AuthDiagnosticsPanel } from './AuthDiagnosticsPanel';
export { default as AuthDiagnosticsPage } from './pages/AuthDiagnosticsPage';
export { default as AuthDiagnosticsSummaryCards } from './components/AuthDiagnosticsSummaryCards';
export { default as AuthDiagnosticsReasonsTable } from './components/AuthDiagnosticsReasonsTable';
export { getRunbookLink, getReasonTitle } from './runbook';
export { useAuthDiagnosticsSnapshot } from './hooks/useAuthDiagnosticsSnapshot';
