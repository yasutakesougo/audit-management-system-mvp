/**
 * RegulatoryDashboardPage — 型定義・定数・ヘルパー
 */
import React from 'react';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import type {
  AuditFinding,
  AuditFindingDomain,
  AuditFindingSeverity,
  AuditFindingType,
} from '@/domain/regulatory';
import { AUDIT_FINDING_TYPE_LABELS } from '@/domain/regulatory';
import type { SevereAddonFinding } from '@/domain/regulatory/severeAddonFindings';
import { SEVERE_ADDON_FINDING_TYPE_LABELS } from '@/domain/regulatory/severeAddonFindings';
import { buildFindingActions } from '@/domain/regulatory/buildFindingActions';
import { buildSevereAddonFindingActions } from '@/domain/regulatory/buildSevereAddonFindingActions';

// ─────────────────────────────────────────────
// SEVERITY_CONFIG
// ─────────────────────────────────────────────

export const SEVERITY_CONFIG: Record<AuditFindingSeverity, { color: 'error' | 'warning' | 'info'; label: string; icon: React.ReactNode }> = {
  high: { color: 'error', label: '高', icon: <ErrorOutlineIcon fontSize="small" /> },
  medium: { color: 'warning', label: '中', icon: <WarningAmberIcon fontSize="small" /> },
  low: { color: 'info', label: '低', icon: <InfoOutlinedIcon fontSize="small" /> },
};

// ─────────────────────────────────────────────
// UnifiedFindingRow
// ─────────────────────────────────────────────

/** テーブル表示用の統一行データ */
export interface UnifiedFindingRow {
  id: string;
  severity: AuditFindingSeverity;
  domain: AuditFindingDomain;
  typeLabel: string;
  userId: string;
  userName?: string;
  message: string;
  overdueDays?: number;
  dueDate?: string;
  /** regular finding or addon finding */
  source: 'regular' | 'addon';
  /** 元の finding（アクション解決用） */
  originalRegular?: AuditFinding;
  originalAddon?: SevereAddonFinding;
}

// ─────────────────────────────────────────────
// Helper functions (pure)
// ─────────────────────────────────────────────

export function unifyFindings(
  regularFindings: AuditFinding[],
  addonFindings: SevereAddonFinding[],
): UnifiedFindingRow[] {
  const rows: UnifiedFindingRow[] = [];

  for (const f of regularFindings) {
    rows.push({
      id: f.id,
      severity: f.severity,
      domain: f.domain,
      typeLabel: AUDIT_FINDING_TYPE_LABELS[f.type],
      userId: f.userId,
      userName: f.userName,
      message: f.message,
      overdueDays: f.overdueDays,
      dueDate: f.dueDate,
      source: 'regular',
      originalRegular: f,
    });
  }

  for (const f of addonFindings) {
    rows.push({
      id: f.id,
      severity: f.severity,
      domain: f.domain,
      typeLabel: SEVERE_ADDON_FINDING_TYPE_LABELS[f.type],
      userId: f.userId === '__facility__' ? '事業所全体' : f.userId,
      userName: f.userId === '__facility__' ? '事業所全体' : f.userName,
      message: f.message,
      overdueDays: f.overdueDays,
      dueDate: f.dueDate,
      source: 'addon',
      originalAddon: f,
    });
  }

  return rows;
}

/** 行からアクションボタン一覧を生成する */
export function buildRowActions(row: UnifiedFindingRow): { label: string; url: string; kind: string }[] {
  if (row.source === 'regular' && row.originalRegular) {
    return buildFindingActions(row.originalRegular);
  }
  if (row.source === 'addon' && row.originalAddon) {
    return buildSevereAddonFindingActions(row.originalAddon);
  }
  return [];
}

// ─────────────────────────────────────────────
// TypeBreakdown constants
// ─────────────────────────────────────────────

export { type AuditFindingSeverity, type AuditFindingType };

export type { SevereAddonFinding };
