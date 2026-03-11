import { motionTokens } from '@/app/theme';
import {
    Box,
    Stack,
    useTheme,
} from '@mui/material';
import React from 'react';
import { type DashboardSection, type DashboardSectionKey } from '../sections/types';

import { TodayChangesCard, type TodayChanges } from '../components/TodayChangesCard';

// Re-export types for backward compatibility
export type { ChangeItem, TodayChanges } from '../components/TodayChangesCard';

// ⸻
// Zone 1: 朝30秒判断ゾーン
// 左：申し送りタイムライン
// 右：本日の変更HUD
// ⸻

interface Zone1_MorningDecisionProps {
  handoverNode: React.ReactNode;
  dateLabel: string;
  todayChanges: TodayChanges;
}

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
      <Box>{handoverNode}</Box>
      <Box>
        <TodayChangesCard dateLabel={dateLabel} changes={todayChanges} />
      </Box>
    </Box>
  );
};

// ⸻
// Main Layout: DashboardLayout
// ⸻
export interface DashboardLayoutProps {
  sections: DashboardSection[];
  renderSection: (section: DashboardSection) => React.ReactNode;
  sectionIdByKey: Record<DashboardSectionKey, string>;
  highlightSection?: DashboardSectionKey | null;
  dateLabel: string;
  todayChanges: TodayChanges;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
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
    <Stack spacing={{ xs: 2, sm: 3, md: 4 }} sx={{ mb: { xs: 2, sm: 3 } }}>
      {/* ZONE 1: 朝30秒判断ゾーン */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          backgroundColor: 'background.default',
        }}
      >
        <Box sx={{ pb: 2 }}>
          <Zone1_MorningDecision
            handoverNode={renderSectionIfEnabled('handover')}
            dateLabel={dateLabel}
            todayChanges={todayChanges}
          />
        </Box>
      </Box>

      {/* ZONE 2-3: スクロール領域 */}
      <Box
        sx={{
          overflowY: 'auto',
          flex: 1,
          pr: 1,
          pb: `${FOOTER_H}px`,
        }}
      >
        <Stack spacing={3}>
          {/* ZONE 2: 今日の予定 */}
          <Box data-testid="dashboard-zone-today">
            {renderSectionIfEnabled('schedule')}
          </Box>

          {/* ZONE 3: 集計・作業 */}
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
    </Stack>
  );
};
