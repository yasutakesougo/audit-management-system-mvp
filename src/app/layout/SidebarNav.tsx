import * as React from 'react';
import { List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';

export type SidebarItem = {
  label: string;
  to: string;
  icon: React.ElementType;
  isActive?: (pathname: string) => boolean;
};

export type SidebarNavProps = {
  items: SidebarItem[];
};

export function SidebarNav({ items }: SidebarNavProps) {
  const location = useLocation();

  return (
    <List dense sx={{ px: 1, py: 1 }}>
      {items.map((item) => {
        const active = item.isActive?.(location.pathname) ?? location.pathname.startsWith(item.to);
        const Icon = item.icon;

        return (
          <ListItemButton
            key={item.to}
            component={RouterLink}
            to={item.to}
            selected={active}
            sx={{ borderRadius: 1, mb: 0.5 }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <Icon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ variant: 'body2' }} />
          </ListItemButton>
        );
      })}
    </List>
  );
}
