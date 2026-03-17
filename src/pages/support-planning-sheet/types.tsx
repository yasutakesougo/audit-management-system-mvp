/**
 * SupportPlanningSheetPage — 共有型・定数・小コンポーネント
 */
import React from 'react';
import Box from '@mui/material/Box';
import type { PlanningSheetStatus } from '@/domain/isp/schema';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type SheetTabKey = 'overview' | 'intake' | 'assessment' | 'planning' | 'regulatory';

export const TAB_SECTIONS: { key: SheetTabKey; label: string }[] = [
  { key: 'overview', label: '概要' },
  { key: 'intake', label: '情報収集' },
  { key: 'assessment', label: 'アセスメント' },
  { key: 'planning', label: '支援設計' },
  { key: 'regulatory', label: '制度項目' },
];

// ─────────────────────────────────────────────
// Status helpers
// ─────────────────────────────────────────────

export function statusColor(status: PlanningSheetStatus): 'default' | 'info' | 'success' | 'warning' {
  switch (status) {
    case 'draft': return 'default';
    case 'review': return 'info';
    case 'active': return 'success';
    case 'revision_pending': return 'warning';
    case 'archived': return 'default';
    default: return 'default';
  }
}

// ─────────────────────────────────────────────
// TabPanel
// ─────────────────────────────────────────────

export const TabPanel: React.FC<{
  current: SheetTabKey;
  value: SheetTabKey;
  children: React.ReactNode;
}> = ({ current, value, children }) => (
  <Box
    role="tabpanel"
    hidden={current !== value}
    id={`planning-sheet-tabpanel-${value}`}
    aria-labelledby={`planning-sheet-tab-${value}`}
    sx={{ mt: 2 }}
  >
    {current === value ? children : null}
  </Box>
);
