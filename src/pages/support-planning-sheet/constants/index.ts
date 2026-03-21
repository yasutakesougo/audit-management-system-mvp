import type { SheetTabKey } from '../types';

export const VALID_TABS: readonly SheetTabKey[] = [
  'overview',
  'intake',
  'assessment',
  'planning',
  'regulatory',
];

export const TOAST_AUTO_HIDE_DURATION_MS = 4000;

export const CONTEXT_PANEL_FAB_SX = {
  position: 'fixed',
  bottom: 88,
  right: 16,
  zIndex: 1100,
} as const;
