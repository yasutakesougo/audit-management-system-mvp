import { TESTIDS } from '@/testids';
import Alert from '@mui/material/Alert';
import Box, { type BoxProps } from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React from 'react';

type NurseRecordsSectionProps = BoxProps & {
  user?: string;
  date?: string;
  onUserChange?: (user: string) => void;
  onDateChange?: (date: string) => void;
  defaultRange?: 'today' | 'week' | string;
  loading?: boolean;
  error?: string | null;
};

type NurseRecord = {
  id: string;
  isoDate: string;
  time: string;
  user: string;
  kind: string;
  summary: string;
};

const MOCK_RECORDS: NurseRecord[] = [
  {
    id: 'rec-1',
    isoDate: '2025-11-04',
    time: '09:50',
    user: 'I022 中村 裕樹',
    kind: 'バイタル',
    summary: '体温 36.4℃ / 体重 57.9kg / SpO2 98%',
  },
  {
    id: 'rec-2',
    isoDate: '2025-11-04',
    time: '08:40',
    user: 'I031 佐々木 花',
    kind: '申し送り',
    summary: '嚥下状態：むせ 0回 / 食事摂取 80%',
  },
  {
    id: 'rec-3',
    isoDate: '2025-11-03',
    time: '14:15',
    user: 'I015 山田 太郎',
    kind: '創部ケア',
    summary: '右踵洗浄・ガーゼ交換 / 発赤軽度',
  },
];

function useDebouncedValue<T>(value: T, delay = 300) {
  const [state, setState] = React.useState(value);

  React.useEffect(() => {
    const timer = setTimeout(() => setState(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return state;
}

const NurseRecordsSection: React.FC<NurseRecordsSectionProps> = ({
  sx,
  user = '',
  date,
  onUserChange,
  onDateChange,
  defaultRange,
  loading = false,
  error = null,
  ...boxProps
}) => {
  const [userInput, setUserInput] = React.useState(user);
  React.useEffect(() => {
    setUserInput(user);
  }, [user]);

  const debouncedUser = useDebouncedValue(userInput, 300);

  React.useEffect(() => {
    if (!onUserChange) return;
    if (debouncedUser === user) return;
    onUserChange(debouncedUser);
  }, [debouncedUser, onUserChange, user]);

  const effectiveDate = date ?? new Date().toISOString().slice(0, 10);

  const filteredRecords = React.useMemo(() => {
    const matchUser = (recordUser: string) => {
      if (!debouncedUser) return true;
      return recordUser.toLowerCase().includes(debouncedUser.trim().toLowerCase());
    };
    return MOCK_RECORDS.filter((record) => record.isoDate === effectiveDate && matchUser(record.user));
  }, [debouncedUser, effectiveDate]);

  return (
    <Box data-testid={TESTIDS.NURSE_RECORDS_PAGE} sx={sx} {...boxProps}>
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          検索に失敗しました。ネットワークを確認して再試行してください。
        </Alert>
      ) : null}

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', md: '200px 1fr 200px' },
              alignItems: 'end',
            }}
          >
            <TextField
              type="date"
              label="日付"
              fullWidth
              value={effectiveDate}
              onChange={(event) => onDateChange?.(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="利用者（氏名/コード）"
              fullWidth
              placeholder="I022 / 中村 など"
              value={userInput}
              onChange={(event) => setUserInput(event.target.value)}
            />
            <Button variant="contained" fullWidth data-testid={TESTIDS.NURSE_RECORDS_SEARCH}>
              検索
            </Button>
          </Box>
          {defaultRange ? (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              デフォルト範囲: {defaultRange === 'today' ? '本日分' : defaultRange}
            </Typography>
          ) : null}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>検索結果</strong>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" disabled={filteredRecords.length === 0}>
              PDF出力
            </Button>
            <Button variant="outlined" disabled={filteredRecords.length === 0}>
              監査用エクスポート
            </Button>
          </Box>
        </CardContent>
        {loading ? (
          <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={32} />
          </Box>
        ) : filteredRecords.length > 0 ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>日時</TableCell>
                <TableCell>利用者</TableCell>
                <TableCell>種別</TableCell>
                <TableCell>概要</TableCell>
                <TableCell sx={{ width: 96 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRecords.map((record) => (
                <TableRow key={record.id} hover>
                  <TableCell>{`${record.isoDate} ${record.time}`}</TableCell>
                  <TableCell>{record.user}</TableCell>
                  <TableCell>{record.kind}</TableCell>
                  <TableCell>{record.summary}</TableCell>
                  <TableCell>
                    <Button size="small">詳細</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Box sx={{ py: 5, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              条件に合致する記録がありません。条件を変更して再検索してください。
            </Typography>
          </Box>
        )}
      </Card>

      {/* NOTE: データ件数が多い場合は react-virtuoso 等の仮想化コンポーネントに差し替えてください。 */}
    </Box>
  );
};

export default NurseRecordsSection;
