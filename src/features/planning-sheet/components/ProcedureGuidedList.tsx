import React from 'react';
import {
  Box,
  Chip,
  Stack,
  Typography,
  Paper,
} from '@mui/material';
import type { ProcedureRow } from '../constants/procedureRows';
import {
  NORMAL_PROCEDURE_ROWS,
  getChildProcedureRows,
} from '../constants/procedureRows';

type ProcedureGuidedListProps = {
  rows?: ProcedureRow[];
  title?: string;
  showRowNo?: boolean;
};

export function ProcedureGuidedList({
  rows = NORMAL_PROCEDURE_ROWS,
  title = '支援手順一覧',
  showRowNo = true,
}: ProcedureGuidedListProps) {
  return (
    <Stack spacing={1.5}>
      <Typography variant="h6" component="h2" fontWeight="bold">
        {title}
      </Typography>

      {rows.map((row) => {
        const children = getChildProcedureRows(row.rowNo);

        return (
          <Paper
            key={row.rowNo}
            variant="outlined"
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: 'background.paper',
            }}
          >
            <Stack spacing={1}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
              >
                {showRowNo && (
                  <Chip
                    size="small"
                    label={`#${row.rowNo}`}
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                )}

                <Chip
                  size="small"
                  label={row.timeLabel}
                  color="primary"
                  variant="outlined"
                  sx={{ height: 24, fontWeight: 'bold' }}
                />

                <Typography variant="body1" fontWeight={600}>
                  {row.activity}
                </Typography>
              </Stack>

              {children.length > 0 && (
                <Box
                  sx={{
                    ml: { xs: 0, sm: 4 },
                    pl: 2,
                    borderLeft: (theme) => `3px solid ${theme.palette.divider}`,
                    mt: 1,
                  }}
                >
                  <Stack spacing={1}>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                      外活動オプション
                    </Typography>

                    {children.map((child) => (
                      <Stack
                        key={child.rowNo}
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        alignItems={{ xs: 'flex-start', sm: 'center' }}
                      >
                        {showRowNo && (
                          <Chip
                            size="small"
                            label={`#${child.rowNo}`}
                            color="warning"
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        )}

                        <Chip
                          size="small"
                          label={child.timeLabel}
                          color="warning"
                          variant="outlined"
                          sx={{ height: 24, fontWeight: 'bold' }}
                        />

                        <Typography variant="body2">
                          {child.activity}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              )}
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}

export default ProcedureGuidedList;
