/**
 * Dashboard Section Implementations Index
 * 
 * セクション impl 層の export を統一
 * → 以降のセクション追加時も import が一箇所で済む
 */

export { SafetySection } from './SafetySection';
export type { SafetySectionProps } from './SafetySection';

export { AttendanceSection } from './AttendanceSection';
export type { AttendanceSectionProps, AttendanceSummaryData } from './AttendanceSection';

export { DailySection } from './DailySection';
export type { DailySectionProps, DailyStatusCard } from './DailySection';

export { ScheduleSection } from './ScheduleSection';
export type { ScheduleSectionProps, ScheduleLanes, ScheduleItem } from './ScheduleSection';

export { AdminOnlySection } from './AdminOnlySection';
export type { AdminOnlySectionProps } from './AdminOnlySection';

export { StaffOnlySection } from './StaffOnlySection';
export type { StaffOnlySectionProps } from './StaffOnlySection';