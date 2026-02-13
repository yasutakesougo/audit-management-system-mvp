import * as React from 'react';
import { Box, IconButton, InputBase, Paper, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { layoutTokens } from './layoutTokens';

export type HeaderBandProps = {
  title?: string;
  onSearchChange?: (value: string) => void;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
};

export function HeaderBand(props: HeaderBandProps) {
  const { title = 'Operation Hub', onSearchChange, leftSlot, rightSlot } = props;

  return (
    <Box
      component="header"
      sx={(theme) => ({
        height: `${layoutTokens.header.height}px`,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1,
        borderBottom: `1px solid ${theme.palette.divider}`,
        background: theme.palette.background.default,
        overflow: 'hidden',
      })}
    >
      {leftSlot}
      <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
        {title}
      </Typography>

      <Paper
        variant="outlined"
        sx={{
          ml: 1,
          flex: 1,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          px: 1,
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        <SearchIcon fontSize="small" />
        <InputBase
          placeholder="Search..."
          sx={{ ml: 1, flex: 1, typography: 'caption' }}
          inputProps={{ 'aria-label': 'search' }}
          onChange={(e) => onSearchChange?.(e.target.value)}
        />
      </Paper>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {rightSlot}
        <IconButton
          size="small"
          aria-label="more"
          sx={{
            minWidth: layoutTokens.touchTarget.min,
            minHeight: layoutTokens.touchTarget.min,
          }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}
