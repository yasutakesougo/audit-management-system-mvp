/**
 * sectionHelpers.ts
 *
 * Pure helper functions shared across UserDetailSections sub-components.
 * Extracted from index.tsx to keep the orchestrator lean.
 */

import type { IUserMaster } from '../types';
import type { MenuSection } from './types';

// ─── resolveChipProps ────────────────────────────────────────────────────────

type ChipProps = {
  label: string;
  color: 'primary' | 'secondary' | 'success' | 'default';
  variant: 'filled' | 'outlined';
};

/**
 * Derive MUI Chip props from a menu section + user state.
 * Used on both the card grid and the tab panel header.
 */
export function resolveChipProps(section: MenuSection, user: IUserMaster): ChipProps {
  if (section.key === 'support-procedure') {
    return {
      label: user.IsSupportProcedureTarget ? '対象' : '対象外',
      color: user.IsSupportProcedureTarget ? 'secondary' : 'default',
      variant: user.IsSupportProcedureTarget ? 'filled' : 'outlined',
    };
  }
  if (section.status === 'coming-soon') {
    return { label: '準備中', color: 'default', variant: 'outlined' };
  }
  return { label: '利用可', color: 'success', variant: 'outlined' };
}
