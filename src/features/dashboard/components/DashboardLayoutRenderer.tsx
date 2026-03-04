/**
 * DashboardLayoutRenderer — レイアウトモード別の描画コンポーネント
 *
 * 責務:
 * - layoutMode ('bentoGrid' | 'zeroScroll' | 'tabletLandscape' | 'standard') に基づく条件分岐
 * - BentoGridLayout / ZeroScrollLayout / DashboardZoneLayout / 標準リストの描画
 * - BriefingHUD の配置
 *
 * Presentational コンポーネント。ロジックを持たず、渡されたデータを配置するだけ。
 */

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';

import DashboardBriefingHUD from '@/features/dashboard/DashboardBriefingHUD';
import { DashboardZoneLayout } from '@/features/dashboard/components/DashboardZoneLayout';
import type { TodayChanges } from '@/features/dashboard/components/TodayChangesCard';
import type { DashboardLayoutMode } from '@/features/dashboard/hooks/useDashboardLayoutMode';
import { BentoGridLayout } from '@/features/dashboard/layouts/BentoGridLayout';
import type { DashboardTab } from '@/features/dashboard/layouts/ZeroScrollLayout';
import { ZeroScrollLayout } from '@/features/dashboard/layouts/ZeroScrollLayout';
import type { BriefingAlert } from '@/features/dashboard/sections/types';
import type { DashboardSection, DashboardSectionKey } from '@/features/dashboard/useDashboardViewModel';

// ── Props ──
export interface DashboardLayoutRendererProps {
  layoutMode: DashboardLayoutMode;

  // Sections
  orderedSections: DashboardSection[];
  renderSection: (section: DashboardSection) => React.ReactNode;
  sectionIdByKey: Record<DashboardSectionKey, string>;
  highlightSection: DashboardSectionKey | null;

  // Briefing HUD
  briefingAlerts: BriefingAlert[];
  isBriefingTime: boolean;
  briefingType?: 'morning' | 'evening';
  scrollToSection: (sectionKeyOrAnchorId: DashboardSectionKey | string) => void;

  // Today changes
  dateLabel: string;
  todayChanges: TodayChanges;

  // ZeroScroll tabs
  zeroScrollTabs: DashboardTab[];

  // 🍱 Bento Grid KPI data
  handoffPending?: number;
  handoffCritical?: number;
  attendanceRatio?: { present: number; total: number };
  dailyRecordRatio?: { done: number; total: number };
}

export const DashboardLayoutRenderer: React.FC<DashboardLayoutRendererProps> = ({
  layoutMode,
  orderedSections,
  renderSection,
  sectionIdByKey,
  highlightSection,
  briefingAlerts,
  isBriefingTime,
  briefingType,
  scrollToSection,
  dateLabel,
  todayChanges,
  zeroScrollTabs,
  handoffPending = 0,
  handoffCritical = 0,
  attendanceRatio,
  dailyRecordRatio,
}) => {
  // ── 🍱 Bento Grid ──
  if (layoutMode === 'bentoGrid') {
    return (
      <BentoGridLayout
        sections={orderedSections}
        renderSection={renderSection}
        sectionIdByKey={sectionIdByKey}
        highlightSection={highlightSection}
        handoffPending={handoffPending}
        handoffCritical={handoffCritical}
        attendanceRatio={attendanceRatio}
        dailyRecordRatio={dailyRecordRatio}
        briefingAlerts={briefingAlerts}
        isBriefingTime={isBriefingTime}
        briefingType={briefingType}
        scrollToSection={scrollToSection}
        dateLabel={dateLabel}
        todayChanges={todayChanges}
      />
    );
  }

  // ── Zero-Scroll ──
  if (layoutMode === 'zeroScroll') {
    const handoverSection = orderedSections.find((s) => s.key === 'handover');
    const leftContent = handoverSection ? (
      renderSection(handoverSection)
    ) : (
      <Typography color="text.secondary">申し送り情報がありません</Typography>
    );

    return (
      <ZeroScrollLayout
        leftSection={leftContent}
        rightHeader={
          <DashboardBriefingHUD
            alerts={briefingAlerts}
            isBriefingTime={isBriefingTime}
            briefingType={briefingType}
            onNavigateTo={scrollToSection}
          />
        }
        tabs={zeroScrollTabs}
      />
    );
  }

  // ── Tablet Landscape ──
  if (layoutMode === 'tabletLandscape') {
    return (
      <>
        <DashboardBriefingHUD
          alerts={briefingAlerts}
          isBriefingTime={isBriefingTime}
          briefingType={briefingType}
          onNavigateTo={scrollToSection}
        />
        <DashboardZoneLayout
          sections={orderedSections}
          renderSection={renderSection}
          sectionIdByKey={sectionIdByKey}
          highlightSection={highlightSection}
          dateLabel={dateLabel}
          todayChanges={todayChanges}
        />
      </>
    );
  }

  // ── Standard ──
  return (
    <>
      <DashboardBriefingHUD
        alerts={briefingAlerts}
        isBriefingTime={isBriefingTime}
        briefingType={briefingType}
        onNavigateTo={scrollToSection}
      />
      {orderedSections.map((section) => (
        <Box
          key={section.key}
          id={sectionIdByKey[section.key]}
          sx={(theme) => ({
            scrollMarginTop: { xs: 80, sm: 96 },
            transition: 'box-shadow 0.2s ease, outline-color 0.2s ease',
            outline: highlightSection === section.key ? '2px solid' : '2px solid transparent',
            outlineColor:
              highlightSection === section.key ? theme.palette.primary.main : 'transparent',
            borderRadius: highlightSection === section.key ? 2 : 0,
          })}
        >
          {section.enabled === false ? null : renderSection(section)}
        </Box>
      ))}
    </>
  );
};
