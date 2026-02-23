/**
 * Dashboard Section Registry (Type-Safe)
 * 
 * セクションの key と component を型安全に紐付ける。
 * switch 文の代わりに、この registry を参照することで：
 * 
 * ✓ key と component の同期漏れを型で防ぐ
 * ✓ 新しいセクション追加時に自動で exhaustive check
 * ✓ renderSection の依存配列を最小化
 * 
 * 重要：
 * - `satisfies Record<DashboardSectionKey, ...>` で全キーカバーを保証
 * - props 型は各コンポーネントの Props 型と一致させる
 */

import React from 'react';
import type { DashboardSectionKey } from './types';
import {
  SafetySection,
  AttendanceSection,
  DailySection,
  ScheduleSection,
  HandoverSection,
  StatsSection,
  AdminOnlySection,
  StaffOnlySection,
} from './impl';
import type {
  SafetySectionProps,
  AttendanceSectionProps,
  DailySectionProps,
  ScheduleSectionProps,
  HandoverSectionProps,
  StatsSectionProps,
  AdminOnlySectionProps,
  StaffOnlySectionProps,
} from './impl';

/**
 * Section Props の Union 型
 * 各セクションの props を統合して型安全にする
 */
export type SectionProps = {
  safety: SafetySectionProps;
  attendance: AttendanceSectionProps;
  daily: DailySectionProps;
  schedule: ScheduleSectionProps;
  handover: HandoverSectionProps;
  stats: StatsSectionProps;
  adminOnly: AdminOnlySectionProps;
  staffOnly: StaffOnlySectionProps;
};

/**
 * Section Component の型定義
 * React.ComponentType<Props> で各セクションのコンポーネントを表現
 */
type SectionComponent<K extends DashboardSectionKey> = React.ComponentType<SectionProps[K]>;

/**
 * Section Registry の型（mapped type で各キーに正しいコンポーネント型を強制）
 */
type SectionRegistry = {
  [K in DashboardSectionKey]: SectionComponent<K>;
};

/**
 * ✨ Section Registry（型で守る版）
 * 
 * `satisfies SectionRegistry` により：
 * - 全ての DashboardSectionKey をカバーしているか型チェック
 * - 各 key に対応する正しい props 型のコンポーネントが割り当てられているか検証
 * - 新しい key を追加したら、ここに追加しない限りコンパイルエラー
 */
export const SECTION_REGISTRY = {
  safety: SafetySection,
  attendance: AttendanceSection,
  daily: DailySection,
  schedule: ScheduleSection,
  handover: HandoverSection,
  stats: StatsSection,
  adminOnly: AdminOnlySection,
  staffOnly: StaffOnlySection,
} as const satisfies SectionRegistry;

/**
 * Helper: Section Component を取得
 * 型安全に key から対応するコンポーネントを取得する
 */
export function getSectionComponent<K extends DashboardSectionKey>(
  key: K,
): SectionComponent<K> {
  return SECTION_REGISTRY[key] as SectionComponent<K>;
}
