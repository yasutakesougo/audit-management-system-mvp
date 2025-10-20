import React from 'react';
import {
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type { CalculatedDailyRecord, DailyRecord } from '../types';

const STATUS_OPTIONS: Array<{ label: string; value: DailyRecord['status'] }> = [
  { label: '通所', value: 'Present' },
  { label: '欠席', value: 'Absent' },
  { label: 'オンライン', value: 'Online' },
];

interface RecordGridProps {
  records: CalculatedDailyRecord[];
  onChange: (date: string, changes: Partial<DailyRecord>) => void;
  mealAddonEnabled: boolean;
}

export function RecordGrid({ records, onChange, mealAddonEnabled }: RecordGridProps) {
  return (
    <Card variant="outlined">
      <CardContent>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>日付</TableCell>
                <TableCell>提供状況</TableCell>
                <TableCell>開始</TableCell>
                <TableCell>終了</TableCell>
                <TableCell align="right">算定時間(h)</TableCell>
                <TableCell>送迎</TableCell>
                <TableCell>食事</TableCell>
                <TableCell>入浴</TableCell>
                <TableCell>欠席時対応</TableCell>
                <TableCell>メモ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.map(record => {
                const disableTimeInputs = record.status === 'Absent';
                const disableAddons = record.status === 'Absent';
                return (
                  <TableRow key={record.date} hover>
                    <TableCell width={110}>
                      <Typography variant="body2">{record.date}</Typography>
                    </TableCell>
                    <TableCell width={160}>
                      <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={record.status}
                        onChange={(_, value) => {
                          if (!value) return;
                          onChange(record.date, { status: value });
                        }}
                      >
                        {STATUS_OPTIONS.map(option => (
                          <ToggleButton key={option.value} value={option.value} aria-label={option.label}>
                            {option.label}
                          </ToggleButton>
                        ))}
                      </ToggleButtonGroup>
                    </TableCell>
                    <TableCell width={120}>
                      <TextField
                        type="time"
                        size="small"
                        value={record.startTime ?? ''}
                        disabled={disableTimeInputs}
                        onChange={event =>
                          onChange(record.date, {
                            startTime: event.target.value || undefined,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell width={120}>
                      <TextField
                        type="time"
                        size="small"
                        value={record.endTime ?? ''}
                        disabled={disableTimeInputs}
                        onChange={event =>
                          onChange(record.date, {
                            endTime: event.target.value || undefined,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell align="right" width={100}>
                      <Typography variant="body2">{record.calculatedHours.toFixed(2)}</Typography>
                    </TableCell>
                    <TableCell width={160}>
                      <Stack direction="row" spacing={1}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              checked={record.transportationAddon.往}
                              disabled={disableAddons}
                              onChange={event =>
                                onChange(record.date, {
                                  transportationAddon: {
                                    ...record.transportationAddon,
                                    往: event.target.checked,
                                  },
                                })
                              }
                            />
                          }
                          label="往"
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              checked={record.transportationAddon.復}
                              disabled={disableAddons}
                              onChange={event =>
                                onChange(record.date, {
                                  transportationAddon: {
                                    ...record.transportationAddon,
                                    復: event.target.checked,
                                  },
                                })
                              }
                            />
                          }
                          label="復"
                        />
                      </Stack>
                    </TableCell>
                    <TableCell width={100}>
                      <Checkbox
                        size="small"
                        checked={record.mealAddon}
                        disabled={!mealAddonEnabled || disableAddons}
                        onChange={event => onChange(record.date, { mealAddon: event.target.checked })}
                      />
                    </TableCell>
                    <TableCell width={100}>
                      <Checkbox
                        size="small"
                        checked={record.bathingAddon}
                        disabled={disableAddons}
                        onChange={event => onChange(record.date, { bathingAddon: event.target.checked })}
                      />
                    </TableCell>
                    <TableCell width={150}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={Boolean(record.isAbsenceSupportApplied)}
                            disabled={record.isAbsenceSupportDisabled}
                            onChange={event =>
                              onChange(record.date, {
                                isAbsenceSupportApplied: event.target.checked,
                              })
                            }
                          />
                        }
                        label="適用"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={record.memo}
                        onChange={event => onChange(record.date, { memo: event.target.value })}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}

