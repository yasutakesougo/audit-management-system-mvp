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
