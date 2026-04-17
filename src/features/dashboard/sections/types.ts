/**
 * Dashboard Sections Layer (UI Layer 1: Contracts)
 * 
 * セクションの型定義を一元管理。
 * - DashboardSectionKey: セクションの ID（固定文字列）
 * - DashboardSection: セクション定義（タイトル・anchorId・audience）
 * - DashboardRole: ユーザーロール
 */

export type DashboardSectionKey =
  | 'safety'
  | 'attendance'
  | 'daily'
  | 'schedule'
  | 'handover'
  | 'stats'
  | 'adminOnly'
  | 'staffOnly';

import { DashboardAudience } from '@/features/auth/store';
export type DashboardRole = DashboardAudience;

/**
 * セクション定義の構造（A層=表示契約・audience 判定）
 */
export interface DashboardSection {
  key: DashboardSectionKey;
  title: string;
  anchorId: string;
  audience: 'both' | 'admin' | 'staff';
  enabled?: boolean;
}

/** Backward compatibility alias */
export type DashboardSectionDef = DashboardSection;

/**
 * 朝会・ブリーフィング用アラート定義
 */
export type BriefingTag = '重要' | '新規' | '継続' | '今週の変更';

export type BriefingAlert = {
  id: string;
  type: 'absent' | 'late' | 'urgent_handover' | 'critical_safety' | 'health_concern' | 'fever_alert' | 'evening_followup';
  severity: 'error' | 'warning' | 'info';
  label: string;
  count: number;
  targetAnchorId: string;
  description?: string;
  section?: 'today' | 'ongoing';
  tags?: BriefingTag[];
  items?: Array<{
    userId: string;
    userName: string;
    morningContacted?: boolean;
    eveningChecked?: boolean;
    [key: string]: unknown;
  }>;
};
