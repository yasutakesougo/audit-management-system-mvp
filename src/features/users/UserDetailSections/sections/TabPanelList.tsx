/**
 * TabPanelList.tsx
 *
 * Renders all tab panel regions (one per TAB_SECTION).
 * Extracted from UserDetailSections/index.tsx to isolate tab-panel rendering.
 */
import type { IUserMaster } from '@/features/users/types';
import { TESTIDS, tidWithSuffix } from '@/testids';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';
import { SectionDetailContent } from '../SectionDetailContent';
import { resolveChipProps } from '../sectionHelpers';
import type { MenuSection } from '../types';

type TabPanelListProps = {
  sections: MenuSection[];
  user: IUserMaster;
  attendanceLabel: string;
  activeTab: string;
  tabPanelRef: React.RefObject<HTMLDivElement | null>;
  /** タイムラインの sourceCounts が確定したときのコールバック */
  onTimelineCountsReady?: (counts: { total: number }) => void;
};

export const TabPanelList: React.FC<TabPanelListProps> = ({
  sections,
  user,
  attendanceLabel,
  activeTab,
  tabPanelRef,
  onTimelineCountsReady,
}) => (
  <>
    {sections.map((section) => {
      const IconComponent = section.icon;
      const chipProps = resolveChipProps(section, user);
      const isTabActive = activeTab === section.key;

      return (
        <Box
          key={section.key}
          ref={isTabActive ? tabPanelRef : undefined}
          role="tabpanel"
          hidden={!isTabActive}
          id={`user-menu-tabpanel-${section.key}`}
          {...tidWithSuffix(TESTIDS['user-menu-tabpanel-prefix'], section.key)}
          aria-labelledby={`user-menu-tab-${section.key}`}
          sx={{ mt: 2 }}
        >
          {isTabActive && (
            <Stack spacing={2.5}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                alignItems={{ xs: 'flex-start', md: 'center' }}
              >
                <Stack direction="row" spacing={2} alignItems="center" sx={{ flexGrow: 1 }}>
                  <Avatar sx={{ bgcolor: section.avatarColor, color: '#fff', width: 48, height: 48 }}>
                    <IconComponent fontSize="medium" />
                  </Avatar>
                  <Box>
                    <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
                      {section.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {section.description}
                    </Typography>
                  </Box>
                </Stack>
                <Chip size="small" {...chipProps} />
              </Stack>
              <Divider />
              <SectionDetailContent
                section={section}
                user={user}
                attendanceLabel={attendanceLabel}
                onTimelineCountsReady={
                  section.key === 'timeline' ? onTimelineCountsReady : undefined
                }
              />
            </Stack>
          )}
        </Box>
      );
    })}
  </>
);
