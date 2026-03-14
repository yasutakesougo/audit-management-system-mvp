/**
 * NavGroupVisibilityControl
 *
 * Allows users to toggle visibility of navigation groups AND individual items.
 * - Group toggle: hides/shows entire group
 * - Item toggle: hides/shows specific items within a group
 * - 'daily' group is always visible (group-level)
 * - Individual items within always-visible groups can still be hidden
 */
import {
    groupLabel,
    NAV_GROUP_ORDER,
    type NavGroupKey,
    type NavItem,
} from '@/app/config/navigationConfig.types';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import React, { useCallback, useMemo } from 'react';

interface NavGroupVisibilityControlProps {
  hiddenGroups: NavGroupKey[];
  hiddenItems: string[];
  /** All available nav items (before filtering) for showing individual controls */
  allNavItems: NavItem[];
  onGroupChange: (hiddenGroups: NavGroupKey[]) => void;
  onItemChange: (hiddenItems: string[]) => void;
}

/** Groups that cannot be hidden at group level (always visible) */
const ALWAYS_VISIBLE_GROUPS: NavGroupKey[] = ['daily'];

export const NavGroupVisibilityControl: React.FC<NavGroupVisibilityControlProps> = ({
  hiddenGroups,
  hiddenItems,
  allNavItems,
  onGroupChange,
  onItemChange,
}) => {
  // Group items by their group key
  const groupedItems = useMemo(() => {
    const map = new Map<NavGroupKey, NavItem[]>();
    for (const key of NAV_GROUP_ORDER) {
      map.set(key, []);
    }
    for (const item of allNavItems) {
      const group = item.group ?? 'record';
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(item);
    }
    return map;
  }, [allNavItems]);

  const handleGroupToggle = useCallback(
    (groupKey: NavGroupKey) => {
      if (ALWAYS_VISIBLE_GROUPS.includes(groupKey)) return;

      const isCurrentlyHidden = hiddenGroups.includes(groupKey);
      if (isCurrentlyHidden) {
        onGroupChange(hiddenGroups.filter((g) => g !== groupKey));
      } else {
        onGroupChange([...hiddenGroups, groupKey]);
        // Also clear item-level hidden for this group (they're already hidden by group)
        const groupItemPaths = (groupedItems.get(groupKey) ?? []).map((i) => i.to);
        onItemChange(hiddenItems.filter((p) => !groupItemPaths.includes(p)));
      }
    },
    [hiddenGroups, hiddenItems, groupedItems, onGroupChange, onItemChange],
  );

  const handleItemToggle = useCallback(
    (itemTo: string) => {
      const isCurrentlyHidden = hiddenItems.includes(itemTo);
      if (isCurrentlyHidden) {
        onItemChange(hiddenItems.filter((p) => p !== itemTo));
      } else {
        onItemChange([...hiddenItems, itemTo]);
      }
    },
    [hiddenItems, onItemChange],
  );

  return (
    <>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        サイドメニュー表示
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        グループ単位または個別メニューを表示/非表示にできます。
      </Typography>
      <Stack spacing={0}>
        {NAV_GROUP_ORDER.map((groupKey) => {
          const items = groupedItems.get(groupKey) ?? [];
          if (items.length === 0) return null;

          const isAlwaysVisible = ALWAYS_VISIBLE_GROUPS.includes(groupKey);
          const isGroupVisible = !hiddenGroups.includes(groupKey);

          return (
            <Accordion
              key={groupKey}
              disableGutters
              elevation={0}
              sx={{
                '&:before': { display: 'none' },
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                mb: 0.5,
                '&.Mui-expanded': { mb: 0.5 },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{
                  minHeight: 40,
                  '& .MuiAccordionSummary-content': { my: 0.5, alignItems: 'center' },
                  opacity: isGroupVisible ? 1 : 0.5,
                }}
              >
                <FormControlLabel
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                  control={
                    <Switch
                      checked={isGroupVisible}
                      onChange={() => handleGroupToggle(groupKey)}
                      disabled={isAlwaysVisible}
                      size="small"
                      inputProps={{
                        'aria-label': `${groupLabel[groupKey]} の表示切替`,
                      }}
                    />
                  }
                  label={
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, opacity: isAlwaysVisible && isGroupVisible ? 0.7 : 1 }}
                    >
                      {groupLabel[groupKey]}
                      {isAlwaysVisible && (
                        <Typography
                          component="span"
                          variant="caption"
                          color="text.secondary"
                          sx={{ ml: 0.5 }}
                        >
                          (常時)
                        </Typography>
                      )}
                    </Typography>
                  }
                  sx={{ ml: 0, mr: 0 }}
                />
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0, pb: 1, pl: 4 }}>
                <Stack spacing={0}>
                  {items.map((item) => {
                    const isItemHidden = hiddenItems.includes(item.to);
                    const isEffectivelyHidden = !isGroupVisible;

                    return (
                      <FormControlLabel
                        key={item.to}
                        control={
                          <Checkbox
                            checked={!isItemHidden}
                            onChange={() => handleItemToggle(item.to)}
                            disabled={isEffectivelyHidden}
                            size="small"
                            inputProps={{
                              'aria-label': `${item.label} の表示切替`,
                            }}
                          />
                        }
                        label={
                          <Typography
                            variant="body2"
                            sx={{
                              opacity: isEffectivelyHidden || isItemHidden ? 0.5 : 1,
                              fontSize: '0.8125rem',
                            }}
                          >
                            {item.label}
                          </Typography>
                        }
                        sx={{ ml: 0, mr: 0 }}
                      />
                    );
                  })}
                </Stack>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Stack>
    </>
  );
};

export default NavGroupVisibilityControl;
