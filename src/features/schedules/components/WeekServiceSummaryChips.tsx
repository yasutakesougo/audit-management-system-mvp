import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import type { FC } from 'react';

export type WeekServiceSummaryItem = {
  key: string;
  label: string;
  count: number;
  color?: 'default' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error';
  tokens?: { bg?: string; border?: string; accent?: string };
  testId?: string;
};

export type WeekServiceSummaryChipsProps = {
  items: WeekServiceSummaryItem[];
};

export const WeekServiceSummaryChips: FC<WeekServiceSummaryChipsProps> = ({ items }) => {
  const visibleItems = (items || []).filter((item) => item.count > 0);

  if (visibleItems.length === 0) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        rowGap: 0.75,
        columnGap: 0.75,
        alignItems: 'center',
      }}
    >
      {visibleItems.map((item) => {
        const text = `${item.label}: ${item.count}件`;

        return (
          <Tooltip key={item.key} title={text} arrow disableInteractive>
            <Chip
              size="small"
              label={`${item.label} ${item.count}件`}
              color={item.color}
              variant="outlined"
              data-testid={item.testId}
              sx={{
                borderColor: item.tokens?.border,
                backgroundColor: item.tokens?.bg,
                color: item.tokens?.accent,
                fontWeight: 700,
                flexShrink: 0,
              }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
};
