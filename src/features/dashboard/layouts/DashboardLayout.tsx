import {
    Box,
    Paper,
    Stack,
    Typography,
    useTheme,
} from '@mui/material';
import React from 'react';
import { type DashboardSection, type DashboardSectionKey } from '../useDashboardViewModel';

import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';

// ⸻
// Zone 1: 朝30秒判断ゾーン
// 左：申し送りタイムライン
// 右：本日の変更HUD
// ⸻

export type ChangeItem = {
  id: string;
  text: string;
  tone?: 'info' | 'warn';
};

export type TodayChanges = {
  userChanges: ChangeItem[];
  staffChanges: ChangeItem[];
};

interface ChangeSectionProps {
  title: string;
  items: ChangeItem[];
}

function ChangeSection({ title, items }: ChangeSectionProps) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" sx={{ opacity: 0.85 }} fontWeight={700}>
        {title}
      </Typography>
      <Stack spacing={0.5}>
        {items.map((it) => (
          <Alert
            key={it.id}
            severity={it.tone === 'warn' ? 'warning' : 'info'}
            variant="outlined"
            sx={{
              py: 0.25,
              '& .MuiAlert-message': { py: 0 },
              borderRadius: 1,
            }}
          >
            <Typography variant="body2">{it.text}</Typography>
          </Alert>
        ))}
      </Stack>
    </Stack>
  );
}

interface TodayChangesCardProps {
  dateLabel: string;
  changes: TodayChanges;
}

const TodayChangesCard: React.FC<TodayChangesCardProps> = ({ dateLabel, changes }) => {
  const hasAny = changes.userChanges.length > 0 || changes.staffChanges.length > 0;

  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%', bgcolor: 'rgba(0,0,0,0.02)' }}>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={1} sx={{ mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          📢 本日の変更
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.6 }}>
          {dateLabel}
        </Typography>
      </Stack>

      <Stack spacing={1.5} divider={<Divider sx={{ opacity: 0.3 }} />}>
        {hasAny ? (
          <>
            <ChangeSection title="利用者" items={changes.userChanges} />
            <ChangeSection title="職員" items={changes.staffChanges} />
          </>
        ) : (
          <Typography variant="body2" sx={{ opacity: 0.6, py: 1, textAlign: 'center' }}>
            変更なし
          </Typography>
        )}
      </Stack>
    </Paper>
  );
};

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
          transition: 'box-shadow 0.2s ease, outline-color 0.2s ease',
          outline: highlightSection === key ? '2px solid' : '2px solid transparent',
          outlineColor: highlightSection === key ? theme.palette.primary.main : 'transparent',
          borderRadius: highlightSection === key ? 2 : 0,
        }}
      >
        {renderSection(section)}
      </Box>
    );
  };

  const FOOTER_H = 56;

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
