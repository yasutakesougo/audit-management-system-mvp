import type { SxProps, Theme } from '@mui/material/styles';

type DayChipOptions = {
  isToday: boolean;
  isSelected: boolean;
};

export const getDayChipSx = ({ isToday, isSelected }: DayChipOptions): SxProps<Theme> => {
  if (isToday && isSelected) {
    return {
      color: '#fff',
      bgcolor: 'primary.dark',
      boxShadow: 2,
      outline: (t: Theme) => `2px solid ${t.palette.primary.light}`,
      outlineOffset: 1,
      borderColor: 'primary.dark',
    };
  }

  if (isSelected) {
    return {
      color: '#fff',
      bgcolor: 'primary.dark',
      boxShadow: 1,
      borderColor: 'primary.dark',
    };
  }

  if (isToday) {
    return {
      bgcolor: (t: Theme) => `rgba(${hexToRgb(t.palette.primary.main)}, 0.08)`,
      outline: (t: Theme) => `2px solid ${t.palette.primary.light}`,
      outlineOffset: 1,
      borderColor: 'primary.light',
    };
  }

  return {
    bgcolor: 'rgba(255,255,255,0.95)',
    borderColor: 'rgba(0,0,0,0.12)',
  };
};

/** Convert hex to r,g,b string for use in rgba() */
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '91,140,90';
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}
