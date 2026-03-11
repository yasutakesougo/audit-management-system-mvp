/**
 * MenuCardGrid.tsx
 *
 * Renders the grid of menu cards in the UserDetailSections panel.
 * Extracted from index.tsx to isolate the card-grid render block.
 */
import type { IUserMaster } from '@/features/users/types';
import { TESTIDS, tidWithSuffix } from '@/testids';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';
import { resolveChipProps } from '../sectionHelpers';
import type { MenuSection } from '../types';

type MenuCardGridProps = {
  sections: MenuSection[];
  user: IUserMaster;
  tabSectionKeys: string[];
  onNavigate: (section: MenuSection) => void;
};

export const MenuCardGrid: React.FC<MenuCardGridProps> = ({
  sections,
  user,
  tabSectionKeys,
  onNavigate,
}) => (
  <Grid container spacing={2.5}>
    {sections.map((section) => {
      const IconComponent = section.icon;
      const cardIsTab = tabSectionKeys.includes(section.key);
      const cardActionLabel = section.actionLabel ?? (cardIsTab ? 'タブを開く' : '詳細へ');
      const chipProps = resolveChipProps(section, user);

      return (
        <Grid key={section.key} size={{ xs: 12, sm: 6, md: 4 }}>
          <Paper
            {...tidWithSuffix(TESTIDS['user-menu-card-prefix'], section.key)}
            variant="outlined"
            sx={{
              p: 2.5,
              height: '100%',
              borderRadius: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar sx={{ bgcolor: section.avatarColor, color: '#fff', width: 44, height: 44 }}>
                <IconComponent fontSize="small" />
              </Avatar>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {section.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {section.description}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" mt="auto">
              <Chip size="small" {...chipProps} />
              <Button
                variant="contained"
                color="primary"
                size="small"
                onClick={() => onNavigate(section)}
              >
                {cardActionLabel}
              </Button>
            </Stack>
          </Paper>
        </Grid>
      );
    })}
  </Grid>
);
