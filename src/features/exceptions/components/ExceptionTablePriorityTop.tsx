import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { SEVERITY_CONFIG } from './ExceptionTable.logic';
import type { PriorityTopItem } from './ExceptionTable.types';

type ExceptionTablePriorityTopProps = {
  items: PriorityTopItem[];
  onAction: (item: PriorityTopItem) => void;
};

export const ExceptionTablePriorityTop: React.FC<ExceptionTablePriorityTopProps> = ({
  items,
  onAction,
}) => {
  if (items.length === 0) return null;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        mb: 2,
        borderRadius: 2,
        borderColor: 'warning.light',
        bgcolor: 'warning.50',
      }}
      data-testid="exception-priority-top3"
    >
      <Stack spacing={1}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          ⚡ 今すぐ対応 Top3
        </Typography>
        {items.map((item, index) => {
          const sevConfig = SEVERITY_CONFIG[item.severity];
          return (
            <Stack
              key={item.id}
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ p: 0.5, borderRadius: 1, bgcolor: 'background.paper' }}
              data-testid={`exception-priority-top3-item-${index + 1}`}
            >
              <Chip
                label={`#${index + 1}`}
                size="small"
                color={index === 0 ? 'error' : 'warning'}
                sx={{ minWidth: 42 }}
              />
              <Chip
                label={sevConfig.label}
                size="small"
                color={sevConfig.color}
                sx={{ minWidth: 48 }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.title}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.targetUser ? `${item.targetUser} / ` : ''}
                  {item.description}
                </Typography>
              </Box>
              {item.actionPath && (
                <Button
                  size="small"
                  variant="text"
                  onClick={() => onAction(item)}
                  data-testid={`exception-priority-top3-action-${item.id}`}
                  sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                >
                  {item.actionLabel ?? '確認'}
                </Button>
              )}
            </Stack>
          );
        })}
        <Typography variant="caption" color="text.secondary">
          詳細は下の一覧へ
        </Typography>
      </Stack>
    </Paper>
  );
};
