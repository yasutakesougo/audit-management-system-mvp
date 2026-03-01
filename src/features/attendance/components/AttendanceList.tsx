import { Card, CardContent, Stack, Typography } from '@mui/material';

import { formatTime, type AttendanceVisit } from '../attendance.logic';
import type { AttendanceInputMode, AttendanceRowVM } from '../types';
import { AttendanceRow } from './AttendanceRow';

type AttendanceListProps = {
  rows: AttendanceRowVM[];
  savingUsers: ReadonlySet<string>;
  inputMode: AttendanceInputMode;
  tempDraftByUser?: Record<string, number>;
  onOpenTemp?: (userCode: string, userName: string) => void;
  onOpenNurse?: (userCode: string) => void;
  onUpdateStatus: (userCode: string, status: AttendanceVisit['status']) => Promise<void>;
};

export function AttendanceList({
  rows,
  savingUsers,
  inputMode,
  tempDraftByUser = {},
  onOpenTemp,
  onOpenNurse,
  onUpdateStatus,
}: AttendanceListProps): JSX.Element {
  if (!rows.length) {
    return (
      <Card>
        <CardContent>
          <Typography color="text.secondary">対象データがありません。</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack spacing={1.5}>
      {rows.map((row) => {
        const rangeText = row.checkInAt && row.checkOutAt
          ? `${formatTime(row.checkInAt)}〜${formatTime(row.checkOutAt)}`
          : '—';

        return (
          <Card key={row.userCode} variant="outlined">
            <CardContent>
              <AttendanceRow
                user={{
                  id: row.userCode,
                  name: `${row.FullName}（${row.UserID}）`,
                  needsTransport: Boolean(row.TransportToDays?.length || row.TransportFromDays?.length),
                }}
                visit={{
                  status: row.status,
                  checkInAtText: row.checkInAt ? formatTime(row.checkInAt) : undefined,
                  checkOutAtText: row.checkOutAt ? formatTime(row.checkOutAt) : undefined,
                  rangeText,
                }}
                inputMode={inputMode}
                tempValue={tempDraftByUser[row.userCode]}
                canAbsence={row.status === '未' || row.status === '当日欠席'}
                isSaving={savingUsers.has(row.userCode)}
                onCheckIn={() => void onUpdateStatus(row.userCode, '通所中')}
                onCheckOut={() => void onUpdateStatus(row.userCode, '退所済')}
                onAbsence={() => void onUpdateStatus(row.userCode, '当日欠席')}
                onOpenTemp={onOpenTemp ? () => onOpenTemp(row.userCode, row.FullName ?? row.userCode) : undefined}
                onOpenNurse={onOpenNurse ? () => onOpenNurse(row.userCode) : undefined}
                onDetail={() => {}}
              />
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
}
