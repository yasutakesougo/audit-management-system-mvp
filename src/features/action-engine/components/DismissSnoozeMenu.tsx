import { useId, useState, type MouseEvent } from 'react';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import type { SnoozePreset } from '../domain/computeSnoozeUntil';

export type DismissSnoozeMenuProps = {
  onDismiss: () => void;
  onSnooze: (preset: SnoozePreset) => void;
  buttonAriaLabel?: string;
  buttonTestId?: string;
};

const SNOOZE_ITEMS: Array<{ preset: SnoozePreset; label: string }> = [
  { preset: 'tomorrow', label: '明日まで' },
  { preset: 'three-days', label: '3日後まで' },
  { preset: 'end-of-week', label: '今週末まで' },
];

export function DismissSnoozeMenu({
  onDismiss,
  onSnooze,
  buttonAriaLabel = '提案メニュー',
  buttonTestId,
}: DismissSnoozeMenuProps) {
  const [anchorPosition, setAnchorPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const isOpen = Boolean(anchorPosition);
  const menuId = useId();

  const openMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setAnchorPosition({
      top: event.clientY,
      left: event.clientX,
    });
  };

  const closeMenu = () => {
    setAnchorPosition(null);
  };

  return (
    <>
      <IconButton
        size="small"
        aria-label={buttonAriaLabel}
        aria-controls={isOpen ? menuId : undefined}
        aria-haspopup="true"
        aria-expanded={isOpen ? 'true' : undefined}
        onClick={openMenu}
        data-testid={buttonTestId}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>

      <Menu
        id={menuId}
        anchorReference="anchorPosition"
        anchorPosition={anchorPosition ?? undefined}
        open={isOpen}
        onClose={closeMenu}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem
          onClick={() => {
            onDismiss();
            closeMenu();
          }}
        >
          対応済みにする
        </MenuItem>
        {SNOOZE_ITEMS.map((item) => (
          <MenuItem
            key={item.preset}
            onClick={() => {
              onSnooze(item.preset);
              closeMenu();
            }}
          >
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
