// src/features/auth/diagnostics/index.ts
export { authDiagnostics, exposeAuthDiagnosticsToWindow, getSafeRoute } from './collector';
export type {
  AuthDiagnosticEvent,
  AuthDiagnosticOutcome,
  AuthDiagnosticReason,
  AuthDiagnosticCollectInput,
} from './collector';
export { default as AuthDiagnosticsPanel } from './AuthDiagnosticsPanel';
