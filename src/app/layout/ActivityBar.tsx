import * as React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { layoutTokens } from './layoutTokens';

export type ActivityBarItem = {
  label: string;
  to: string;
  icon: React.ElementType;
  isActive?: (pathname: string) => boolean;
};

export type ActivityBarProps = {
  items: ActivityBarItem[];
};

export function ActivityBar({ items }: ActivityBarProps) {
  const location = useLocation();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'center', py: 0.5 }}>
      {items.map((item) => {
        const active = item.isActive?.(location.pathname) ?? location.pathname.startsWith(item.to);
        const Icon = item.icon;

        return (
          <Tooltip key={item.to} title={item.label} placement="right" enterDelay={200}>
            <IconButton
              component={RouterLink}
              to={item.to}
              aria-label={item.label}
              size="small"
              sx={(theme) => ({
                minWidth: layoutTokens.touchTarget.min,
                minHeight: layoutTokens.touchTarget.min,
                color: active ? theme.palette.primary.main : theme.palette.text.secondary,
                backgroundColor: active ? theme.palette.action.selected : 'transparent',
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              })}
            >
              <Icon fontSize="small" />
            </IconButton>
          </Tooltip>
        );
      })}
    </Box>
  );
}
