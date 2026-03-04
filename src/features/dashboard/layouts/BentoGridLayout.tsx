/**
 * BentoGridLayout — 🍱 ベントグリッド・ダッシュボード・レイアウト
 *
 * 3段階レスポンシブ対応:
 *
 * ━━━ Wide（≥ 1024px）: PC / タブレット横置き ━━━
 * ┌─────────────────────────────────────────────────┐
 * │ COMMAND BAR                                      │
 * ├──────────────────────────┬──────────────────────┤
 * │ MAIN ANCHOR              │ ACTION RAIL          │
 * │ 申し送り + スケジュール    │ Quick Input          │
 * │ ─ scrollable ─           │ Briefing HUD         │
 * │                          │ Today Changes        │
 * └──────────────────────────┴──────────────────────┘
 *
 * ━━━ Portrait（600–1023px）: タブレット縦持ち ━━━
 * ┌──────────────────────────┐
 * │ COMMAND BAR (横スクロール)  │
 * ├──────────────────────────┤
 * │ ✍️ CompactNewHandoffInput │  ← 即入力を最優先
 * ├──────────────────────────┤
 * │ Briefing HUD             │
 * ├──────────────────────────┤
 * │ MAIN SECTIONS (全幅)      │
 * │ ─ vertical scroll ─      │
 * ├──────────────────────────┤
 * │ Today Changes             │
 * └──────────────────────────┘
 *
 * ━━━ Narrow（< 600px）: スマートフォン ━━━
 * シンプルなスタック（CommandBar → 各セクション）
 */

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import { alpha, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import React from 'react';

import { motionTokens } from '@/app/theme';
import { CommandBar } from '@/features/dashboard/components/CommandBar';
import type { TodayChanges } from '@/features/dashboard/components/TodayChangesCard';
import { TodayChangesCard } from '@/features/dashboard/components/TodayChangesCard';
import DashboardBriefingHUD from '@/features/dashboard/DashboardBriefingHUD';
import type { BriefingAlert } from '@/features/dashboard/sections/types';
import type { DashboardSection, DashboardSectionKey } from '@/features/dashboard/useDashboardViewModel';
import { CompactNewHandoffInput } from '@/features/handoff/components/CompactNewHandoffInput';

// ── Props ──
export interface BentoGridLayoutProps {
  // Sections
  sections: DashboardSection[];
  renderSection: (section: DashboardSection) => React.ReactNode;
  sectionIdByKey: Record<DashboardSectionKey, string>;
  highlightSection?: DashboardSectionKey | null;

  // KPI data for Command Bar
  handoffPending: number;
  handoffCritical: number;
  attendanceRatio?: { present: number; total: number };
  dailyRecordRatio?: { done: number; total: number };

  // Briefing HUD
  briefingAlerts: BriefingAlert[];
  isBriefingTime: boolean;
  briefingType?: 'morning' | 'evening';
  scrollToSection: (sectionKeyOrAnchorId: DashboardSectionKey | string) => void;

  // Today changes
  dateLabel: string;
  todayChanges: TodayChanges;
}

export const BentoGridLayout: React.FC<BentoGridLayoutProps> = ({
  sections,
  renderSection,
  sectionIdByKey,
  highlightSection,
  handoffPending,
  handoffCritical,
  attendanceRatio,
  dailyRecordRatio,
  briefingAlerts,
  isBriefingTime,
  briefingType,
  scrollToSection,
  dateLabel,
  todayChanges,
}) => {
  const theme = useTheme();
  const isWide = useMediaQuery('(min-width: 1024px)');
  const isPortrait = useMediaQuery('(min-width: 600px) and (max-width: 1023px)');
  // < 600px = narrow (phone)

  // ── Helpers ──
  const getSection = (key: DashboardSectionKey) =>
    sections.find((s) => s.key === key);

  const renderSectionIfEnabled = (key: DashboardSectionKey) => {
    const section = getSection(key);
    if (!section || section.enabled === false) return null;
    const isHighlighted = highlightSection === key;
    return (
      <Box
        key={section.key}
        id={sectionIdByKey[key]}
        sx={{
          scrollMarginTop: 96,
          transition: motionTokens.transition.sectionHighlight,
          outline: isHighlighted ? '2px solid' : '2px solid transparent',
          outlineColor: isHighlighted ? theme.palette.primary.main : 'transparent',
          outlineOffset: isHighlighted ? 2 : 0,
          borderRadius: isHighlighted ? 2 : 0,
          // Phase 9: チップクリック時のハイライト + フェードインアニメーション
          ...(isHighlighted ? {
            animation:
              `sectionPop ${motionTokens.duration.slow} ${motionTokens.easing.pop}, sectionFadeIn ${motionTokens.duration.slower} ${motionTokens.easing.decel}`,
            boxShadow: `0 0 0 4px ${theme.palette.primary.main}20`,
          } : {}),
          '@keyframes sectionPop': {
            '0%': { transform: 'scale(1)', boxShadow: 'none' },
            '40%': { transform: 'scale(1.008)', boxShadow: `0 0 0 6px ${theme.palette.primary.main}30` },
            '100%': { transform: 'scale(1)', boxShadow: `0 0 0 4px ${theme.palette.primary.main}20` },
          },
          '@keyframes sectionFadeIn': {
            '0%': { opacity: 0.4, outlineColor: 'transparent' },
            '100%': { opacity: 1, outlineColor: theme.palette.primary.main },
          },
        }}
      >
        {renderSection(section)}
      </Box>
    );
  };

  // ── Shared subcomponents ──
  const commandBar = (
    <CommandBar
      pendingHandoffs={handoffPending}
      criticalAlerts={handoffCritical}
      attendanceRatio={attendanceRatio}
      dailyRecordRatio={dailyRecordRatio}
      onChipClick={scrollToSection}
    />
  );

  const briefingHUD = (
    <DashboardBriefingHUD
      alerts={briefingAlerts}
      isBriefingTime={isBriefingTime}
      briefingType={briefingType}
      onNavigateTo={scrollToSection}
    />
  );

  const todayChangesCard = (
    <TodayChangesCard dateLabel={dateLabel} changes={todayChanges} />
  );

  const mainSections = (
    <>
      {renderSectionIfEnabled('handover')}
      {renderSectionIfEnabled('schedule')}
      {renderSectionIfEnabled('safety')}
      {renderSectionIfEnabled('attendance')}
      {renderSectionIfEnabled('daily')}
      {renderSectionIfEnabled('stats')}
      {renderSectionIfEnabled('adminOnly')}
      {renderSectionIfEnabled('staffOnly')}
    </>
  );

  const thinScrollbar = {
    '&::-webkit-scrollbar': { width: 4 },
    '&::-webkit-scrollbar-thumb': {
      bgcolor: alpha(theme.palette.text.secondary, 0.2),
      borderRadius: 2,
    },
  };

  const FOOTER_H = 56;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Narrow (< 600px): スマートフォン — 最小限スタック
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (!isWide && !isPortrait) {
    return (
      <Stack spacing={2} data-testid="bento-grid-narrow">
        {commandBar}
        <CompactNewHandoffInput />
        {briefingHUD}
        {mainSections}
        {todayChangesCard}
      </Stack>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Portrait (600–1023px): タブレット縦持ち
  // 片手操作を想定した縦積みレイアウト
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (isPortrait) {
    return (
      <Box
        data-testid="bento-grid-portrait"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: `calc(100vh - ${FOOTER_H + 80}px)`,
          minHeight: 400,
          overflow: 'hidden',
        }}
      >
        {/* ── Sticky Top: Command Bar（横スクロール対応済み） ── */}
        <Box
          sx={{
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            zIndex: 10,
            pb: 1,
          }}
        >
          {commandBar}
        </Box>

        {/* ── Quick Input + Briefing (flex-shrink: 0) ── */}
        <Box sx={{ flexShrink: 0, px: 0.5, pb: 1 }}>
          <Stack spacing={1.5}>
            <CompactNewHandoffInput />
            {briefingHUD}
          </Stack>
        </Box>

        <Divider sx={{ mx: 1, opacity: 0.5 }} />

        {/* ── Scrollable Main Content ── */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            pt: 1.5,
            px: 0.5,
            ...thinScrollbar,
          }}
          data-testid="bento-portrait-scroll"
        >
          <Stack spacing={2.5}>
            {mainSections}
            {todayChangesCard}
          </Stack>
        </Box>
      </Box>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Wide (≥ 1024px): PC / タブレット横置き — 2カラム・グリッド
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <Box
      data-testid="bento-grid-layout"
      sx={{
        display: 'grid',
        gridTemplateAreas: `
          "command command"
          "main    rail"
        `,
        gridTemplateColumns: '1fr 340px',
        gridTemplateRows: 'auto 1fr',
        gap: 2,
        height: `calc(100vh - ${FOOTER_H + 100}px)`,
        minHeight: 500,
        overflow: 'hidden',
      }}
    >
      {/* ━━━ COMMAND BAR ━━━ */}
      <Box sx={{ gridArea: 'command' }}>
        {commandBar}
      </Box>

      {/* ━━━ MAIN ANCHOR ━━━ */}
      <Box
        sx={{
          gridArea: 'main',
          overflowY: 'auto',
          pr: 0.5,
          ...thinScrollbar,
        }}
        data-testid="bento-main-anchor"
      >
        <Stack spacing={2.5}>
          {mainSections}
        </Stack>
      </Box>

      {/* ━━━ ACTION RAIL ━━━ */}
      <Box
        sx={{
          gridArea: 'rail',
          overflowY: 'auto',
          ...thinScrollbar,
        }}
        data-testid="bento-action-rail"
      >
        <Stack spacing={2}>
          {briefingHUD}
          <CompactNewHandoffInput />
          {todayChangesCard}
        </Stack>
      </Box>
    </Box>
  );
};
