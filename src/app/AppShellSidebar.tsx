/**
 * AppShell Sidebar — desktop navigation drawer with search, collapse, and grouped nav items.
 * Extracted from AppShell.tsx.
 */
import { groupLabel, type NavGroupKey, type NavItem } from '@/app/config/navigationConfig';
import NavLinkPrefetch from '@/components/NavLinkPrefetch';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SearchIcon from '@mui/icons-material/Search';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import React, { useCallback } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { asMuiComponent } from '@/lib/muiLink';

// ── Types ────────────────────────────────────────────────────────────────────

type GroupedNavItems = {
  ORDER: NavGroupKey[];
  map: Map<NavGroupKey, NavItem[]>;
};

type Props = {
  navQuery: string;
  onNavQueryChange: (query: string) => void;
  onNavSearchKeyDown: (event: React.KeyboardEvent<HTMLInputElement>, onNavigate?: () => void) => void;
  navCollapsed: boolean;
  onToggleNavCollapse: () => void;
  filteredNavItems: NavItem[];
  groupedNavItems: GroupedNavItems;
  showMoreNavItems: boolean;
  hasMoreNavItems: boolean;
  todayLiteNavV2: boolean;
  onToggleMoreNavItems: () => void;
  isAdmin: boolean;
  isFieldStaffShell?: boolean;
  onNavigate?: () => void;
};

// ── NavItem renderer ─────────────────────────────────────────────────────────

const NavItemRow: React.FC<{
  item: NavItem;
  navCollapsed: boolean;
  currentPathname: string;
  currentSearch: string;
  isFieldStaffShell?: boolean;
  onNavigate?: () => void;
}> = React.memo(({ item, navCollapsed, currentPathname, currentSearch, isFieldStaffShell, onNavigate }) => {
  const { label, to, isActive, testId, icon: IconComponent, prefetchKey, prefetchKeys, tier = 'core' } = item;
  const active = isActive(currentPathname, currentSearch);
  const isRecordSection = label.includes('運営状況') || label.includes('記録一覧');
  const showLabel = !navCollapsed;

  const handleClick = (e: React.MouseEvent) => {
    if (onNavigate) onNavigate();
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.blur();
    }
  };

  const commonProps = {
    selected: active,
    'data-testid': testId ?? `${tier}-nav-item-${label}`,
    'aria-current': active ? ('page' as const) : undefined,
    onClick: handleClick,
    sx: {
      ...(isRecordSection && active ? {
        borderLeft: 4,
        borderColor: 'primary.main',
        fontWeight: 700,
        '& .MuiListItemText-primary': { fontWeight: 700 },
      } : {}),
      ...(navCollapsed ? {
        '&:hover': { backgroundColor: 'action.hover' },
      } : {}),
    },
  };

  const content = (
    <>
      {IconComponent && (
        <ListItemIcon sx={{ minWidth: 40 }}>
          <Badge
            badgeContent={(!isFieldStaffShell && navCollapsed) ? item.badge || 0 : 0}
            color="error"
            overlap="circular"
            sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', height: 16, minWidth: 16 } }}
          >
            <IconComponent sx={{ fontSize: 20 }} />
          </Badge>
        </ListItemIcon>
      )}
      {showLabel && (
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between', pr: 1 }}>
          <ListItemText
            primary={label}
            primaryTypographyProps={{
              noWrap: true,
              fontSize: '0.85rem',
              fontWeight: active ? 700 : 500,
            }}
          />
          {!isFieldStaffShell && item.badge !== undefined && (typeof item.badge !== 'number' || item.badge > 0) && (
            <Badge
              badgeContent={item.badge}
              color="error"
              sx={{
                ml: 1,
                '& .MuiBadge-badge': {
                  position: 'static',
                  transform: 'none',
                  fontSize: '0.7rem',
                  height: 18,
                  minWidth: 18,
                  fontWeight: 800,
                },
              }}
            />
          )}
        </Box>
      )}
    </>
  );

  const LinkComponent = prefetchKey ? NavLinkPrefetch : RouterLink;
  const extraProps = prefetchKey
    ? { preloadKey: prefetchKey, preloadKeys: prefetchKeys, meta: { label } } as Record<string, unknown>
    : {};

  const button = (
    <ListItemButton
      key={label}
      component={asMuiComponent(LinkComponent)}
      to={to}
      {...commonProps}
      {...extraProps}
    >
      {content}
    </ListItemButton>
  );

  if (navCollapsed && !showLabel) {
    return (
      <Tooltip key={`${label}-${currentPathname}`} title={label} placement="right" enterDelay={100} disableInteractive>
        <Box sx={{ width: '100%' }}>
          {button}
        </Box>
      </Tooltip>
    );
  }

  return button;
});
NavItemRow.displayName = 'NavItemRow';

// ── Grouped nav list ─────────────────────────────────────────────────────────

const GroupedNavList: React.FC<{
  filteredNavItems: NavItem[];
  groupedNavItems: GroupedNavItems;
  navCollapsed: boolean;
  isFieldStaffShell?: boolean;
  onNavigate?: () => void;
}> = ({ filteredNavItems, groupedNavItems, navCollapsed, isFieldStaffShell, onNavigate }) => {
  const location = useLocation();
  const currentPathname = location.pathname;
  const currentSearch = location.search;

  if (filteredNavItems.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <ListItemText
          secondary="メニューが見つかりません"
          secondaryTypographyProps={{ fontSize: '0.8rem' }}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 4 }}>
      {groupedNavItems.ORDER.map((group, index) => {
        const items = groupedNavItems.map.get(group);
        if (!items || items.length === 0) return null;
        const isLastGroup = index === groupedNavItems.ORDER.length - 1;

        return (
          <List
            key={group}
            subheader={
              !navCollapsed ? (
                <ListSubheader
                  sx={{
                    lineHeight: '32px',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'text.secondary',
                    bgcolor: 'transparent',
                  }}
                >
                  {groupLabel[group]}
                </ListSubheader>
              ) : (
                <Divider sx={{ my: 1, opacity: 0.6 }} />
              )
            }
          >
            {items.map((item) => (
              <NavItemRow
                key={item.label}
                item={item}
                navCollapsed={navCollapsed}
                currentPathname={currentPathname}
                currentSearch={currentSearch}
                onNavigate={onNavigate}
                isFieldStaffShell={isFieldStaffShell}
              />
            ))}
            {!navCollapsed && !isLastGroup && <Divider sx={{ mt: 1, mb: 0.5 }} />}
          </List>
        );
      })}
    </Box>
  );
};

// ── Main Sidebar Component ───────────────────────────────────────────────────

export const AppShellSidebar: React.FC<Props> = ({
  navQuery,
  onNavQueryChange,
  onNavSearchKeyDown,
  navCollapsed,
  onToggleNavCollapse,
  filteredNavItems,
  groupedNavItems,
  showMoreNavItems,
  hasMoreNavItems,
  todayLiteNavV2,
  onToggleMoreNavItems,
  onNavigate,
}) => {
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => onNavSearchKeyDown(e, onNavigate),
    [onNavSearchKeyDown, onNavigate],
  );

  return (
    <Box
      role="navigation"
      aria-label="主要ナビゲーション"
      data-testid="nav-drawer"
      sx={{ pt: 2, pb: 2 }}
    >
      {!navCollapsed && (
        <Box sx={{ px: 1.5, py: 1, pb: 1.5 }} key="nav-search">
          <TextField
            key="nav-search-field"
            value={navQuery}
            onChange={(e) => onNavQueryChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            size="small"
            placeholder="メニュー検索"
            fullWidth
            inputProps={{ 'aria-label': 'メニュー検索' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </Box>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: navCollapsed ? 'center' : 'flex-end', px: 1, py: 0.5 }}>
        {todayLiteNavV2 && !navCollapsed && hasMoreNavItems && (
          <Box sx={{ mr: 1 }}>
            <IconButton
              onClick={onToggleMoreNavItems}
              aria-label={showMoreNavItems ? 'Moreを閉じる' : 'Moreを開く'}
              size="small"
            >
              {showMoreNavItems ? '−' : '+'}
            </IconButton>
          </Box>
        )}
        <Tooltip title={navCollapsed ? 'ナビを展開' : 'ナビを折りたたみ'} placement="right" enterDelay={100}>
          <IconButton
            onClick={onToggleNavCollapse}
            aria-label={navCollapsed ? 'ナビを展開' : 'ナビを折りたたみ'}
            size="small"
          >
            {navCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        </Tooltip>
      </Box>
      <GroupedNavList
        filteredNavItems={filteredNavItems}
        groupedNavItems={groupedNavItems}
        navCollapsed={navCollapsed}
        onNavigate={onNavigate}
      />
    </Box>
  );
};

// ── Mobile Drawer Content ────────────────────────────────────────────────────
export const MobileNavContent: React.FC<{
  navQuery: string;
  onNavQueryChange: (query: string) => void;
  onNavSearchKeyDown: (event: React.KeyboardEvent<HTMLInputElement>, onNavigate?: () => void) => void;
  filteredNavItems: NavItem[];
  groupedNavItems: GroupedNavItems;
  navCollapsed: boolean;
  showMoreNavItems: boolean;
  hasMoreNavItems: boolean;
  todayLiteNavV2: boolean;
  onToggleMoreNavItems: () => void;
  isFieldStaffShell?: boolean;
  onNavigate: () => void;
}> = ({
  navQuery,
  onNavQueryChange,
  onNavSearchKeyDown,
  filteredNavItems,
  groupedNavItems,
  navCollapsed,
  showMoreNavItems,
  hasMoreNavItems,
  todayLiteNavV2,
  onToggleMoreNavItems,
  isFieldStaffShell,
  onNavigate,
}) => {
  return (
    <Box
      role="navigation"
      aria-label="主要ナビゲーション"
      data-testid="nav-items"
      sx={{ pt: 2, pb: 2 }}
    >
      <Box sx={{ px: 1.5, pb: 1.5 }}>
        <TextField
          value={navQuery}
          onChange={(e) => onNavQueryChange(e.target.value)}
          onKeyDown={(e) => onNavSearchKeyDown(e as React.KeyboardEvent<HTMLInputElement>, onNavigate)}
          size="small"
          placeholder="メニュー検索"
          fullWidth
          inputProps={{ 'aria-label': 'メニュー検索' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Box>
      {todayLiteNavV2 && hasMoreNavItems && (
        <Box sx={{ px: 1.5, pb: 1 }}>
          <IconButton
            onClick={onToggleMoreNavItems}
            aria-label={showMoreNavItems ? 'Moreを閉じる' : 'Moreを開く'}
            size="small"
          >
            {showMoreNavItems ? '−' : '+'}
          </IconButton>
        </Box>
      )}
      <GroupedNavList
        filteredNavItems={filteredNavItems}
        groupedNavItems={groupedNavItems}
        navCollapsed={navCollapsed}
        onNavigate={onNavigate}
      />
    </Box>
  );
};
