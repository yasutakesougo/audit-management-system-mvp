/**
 * DashboardZoneLayout — Zone-based layout for tablet landscape view.
 * Extracted from DashboardPage.tsx to reduce file size.
 */

import { motionTokens } from '@/app/theme';
import type { DashboardSection, DashboardSectionKey } from '@/features/dashboard/useDashboardViewModel';
import { TESTIDS, tid } from '@/testids';
import { useTheme } from '@mui/material';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import React from 'react';

import { TodayChangesCard, type TodayChanges } from './TodayChangesCard';

// ⸻
// Zone 1: 朝30秒判断ゾーン（固定）
// 左：申し送りタイムライン（主役・最大）
// 右：本日の変更HUD（小・補助）
// ⸻
type Zone1_MorningDecisionProps = {
  handoverNode: React.ReactNode;
  dateLabel: string;
  todayChanges: TodayChanges;
};

const Zone1_MorningDecision: React.FC<Zone1_MorningDecisionProps> = ({
  handoverNode,
  dateLabel,
  todayChanges,
}) => {
  return (
    <Box
      data-testid="dashboard-zone-briefing"
      sx={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: 2,
        alignItems: 'start',
      }}
    >
      {/* 左（50%）：申し送りタイムライン（主役・最大） */}
      <Box>
        {handoverNode}
      </Box>

      {/* 中（25%）：本日の変更HUD */}
      <Box>
        <TodayChangesCard dateLabel={dateLabel} changes={todayChanges} />
      </Box>
    </Box>
  );
};

// ⸻
// Zone 2-3: スクロール領域（1カラム）
// Zone 2: 今日の予定（主役）
// Zone 3: 集計・作業（補助）
// ⸻
type DashboardZoneLayoutProps = {
  sections: DashboardSection[];
  renderSection: (section: DashboardSection) => React.ReactNode;
  sectionIdByKey: Record<DashboardSectionKey, string>;
  highlightSection?: DashboardSectionKey | null;
  dateLabel: string;
  todayChanges: TodayChanges;
};

export const DashboardZoneLayout: React.FC<DashboardZoneLayoutProps> = ({
  sections,
  renderSection,
  sectionIdByKey,
  highlightSection,
  dateLabel,
  todayChanges,
}) => {
  const theme = useTheme();
  const getSection = (key: DashboardSectionKey) => sections.find((s) => s.key === key);
  const renderSectionIfEnabled = (key: DashboardSectionKey) => {
    const section = getSection(key);
    if (!section || section.enabled === false) return null;
    return (
      <Box
        key={section.key}
        id={sectionIdByKey[key]}
        sx={{
          scrollMarginTop: 96,
          transition: motionTokens.transition.sectionHighlightBasic,
          outline: highlightSection === key ? '2px solid' : '2px solid transparent',
          outlineColor: highlightSection === key ? theme.palette.primary.main : 'transparent',
          borderRadius: highlightSection === key ? 2 : 0,
        }}
      >
        {renderSection(section)}
      </Box>
    );
  };

  const FOOTER_H = 44;

  return (
    <Box
      data-testid={tid(TESTIDS['dashboard-page'])}
      sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      {/* ZONE 1: 朝30秒判断ゾーン（sticky wrapper 分離） */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          backgroundColor: 'background.default',
        }}
      >
        {/* 内部コンテンツ（通常レイアウト） */}
        <Box sx={{ pb: 2 }}>
          <Zone1_MorningDecision
            handoverNode={renderSectionIfEnabled('handover')}
            dateLabel={dateLabel}
            todayChanges={todayChanges}
          />
        </Box>
      </Box>

      {/* ZONE 2-3: スクロール領域（1カラム） */}
      <Box
        sx={{
          overflowY: 'auto',
          flex: 1,
          pr: 1,
          pb: `${FOOTER_H}px`,
        }}
      >
        <Stack spacing={3}>
          {/* ZONE 2: 今日の予定（主役） */}
          <Box data-testid="dashboard-zone-today">
            {renderSectionIfEnabled('schedule')}
          </Box>

          {/* ZONE 3: 集計・作業（補助） */}
          <Box data-testid="dashboard-zone-work">
            {renderSectionIfEnabled('safety')}
            {renderSectionIfEnabled('attendance')}
            {renderSectionIfEnabled('daily')}
            {renderSectionIfEnabled('stats')}
            {renderSectionIfEnabled('adminOnly')}
            {renderSectionIfEnabled('staffOnly')}
          </Box>
        </Stack>
      </Box>
    </Box>
  );
};
