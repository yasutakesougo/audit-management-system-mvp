import type { SxProps, Theme } from '@mui/material/styles';

type DayChipOptions = {
  isToday: boolean;
  isSelected: boolean;
};

export const getDayChipSx = ({ isToday, isSelected }: DayChipOptions): SxProps<Theme> => {
  if (isToday && isSelected) {
    return {
      color: '#fff',
      bgcolor: '#0D47A1',
      boxShadow: 2,
      outline: '2px solid #64B5F6',
      outlineOffset: 1,
      borderColor: '#0D47A1',
    };
  }

  if (isSelected) {
    return {
      color: '#fff',
      bgcolor: '#0D47A1',
      boxShadow: 1,
      borderColor: '#0D47A1',
    };
  }

  if (isToday) {
    return {
      bgcolor: 'rgba(25,118,210,0.08)',
      outline: '2px solid #64B5F6',
      outlineOffset: 1,
      borderColor: '#64B5F6',
    };
  }

  return {
    bgcolor: 'rgba(255,255,255,0.95)',
    borderColor: 'rgba(0,0,0,0.12)',
  };
};
