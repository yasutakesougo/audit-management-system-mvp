import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import type { ReactNode } from 'react';

export type SplitStreamLayoutProps = {
  plan: ReactNode;
  record: ReactNode;
};

/**
 * Core layout used for "Plan | Do" split screens.
 * - Mobile: stacked (Plan over Do)
 * - Desktop: two panes with independent scrolling
 */
export function SplitStreamLayout({ plan, record }: SplitStreamLayoutProps): JSX.Element {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2}
      sx={{ height: '100%', overflow: 'hidden' }}
    >
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          pr: { md: 1 },
          '&::-webkit-scrollbar': { width: 8 },
          '&::-webkit-scrollbar-thumb': { backgroundColor: 'divider', borderRadius: 4 },
        }}
      >
        {plan}
      </Box>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          pl: { md: 1 },
          '&::-webkit-scrollbar': { width: 8 },
          '&::-webkit-scrollbar-thumb': { backgroundColor: 'divider', borderRadius: 4 },
        }}
      >
        {record}
      </Box>
    </Stack>
  );
}

export default SplitStreamLayout;
