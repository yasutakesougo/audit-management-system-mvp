import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';

type UserCategory = '利用者' | '職員' | '来客';

type OrderStatus = '受付済' | '提供済' | 'キャンセル';

type Order = {
  id: number;
  userId: string;
  userName: string;
  type: UserCategory;
  details: string;
  status: OrderStatus;
  barista: string;
  price: number;
  timestamp: string;
};

type SummaryRow = {
  name: string;
  orderCount: number;
  totalAmount: number;
  title: string;
};

const STORAGE_KEY = 'barista_orders';
const UNIT_PRICE = 50;
const GROUP_LABEL: Record<UserCategory, string> = {
  利用者: '利用者グループ',
  職員: '職員グループ',
  来客: '来客グループ',
};

const CoffeeShopSummaryPage: React.FC = () => {
  const today = useMemo(() => new Date(), []);
  const initialMonth = useMemo(
    () => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
    [today],
  );

  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setOrders([]);
        return;
      }
      const parsed: Order[] = JSON.parse(stored);
      setOrders(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      console.error('Failed to load coffee shop orders from localStorage', error);
      setOrders([]);
    }
  }, []);

  const [targetYear, targetMonth] = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      return [today.getFullYear(), today.getMonth()];
    }
    return [year, month - 1];
  }, [selectedMonth, today]);

  const monthlyOrders = useMemo(() => {
    return orders.filter(order => {
      if (order.status === 'キャンセル') {
        return false;
      }
      const timestamp = new Date(order.timestamp);
      if (Number.isNaN(timestamp.getTime())) {
        return false;
      }
      return timestamp.getFullYear() === targetYear && timestamp.getMonth() === targetMonth;
    });
  }, [orders, targetMonth, targetYear]);

  const summaryByGroup = useMemo(() => {
    const template: Record<UserCategory, Map<string, SummaryRow>> = {
      利用者: new Map(),
      職員: new Map(),
      来客: new Map(),
    };

    monthlyOrders.forEach(order => {
      const map = template[order.type] ?? template['来客'];
      const existing = map.get(order.userName) ?? {
        name: order.userName,
        orderCount: 0,
        totalAmount: 0,
        title: '',
      };
      const orderCount = existing.orderCount + 1;
      const totalAmount = orderCount * UNIT_PRICE;
      const title = `${targetYear}.${String(targetMonth + 1).padStart(2, '0')}.${order.userName}コーヒー代金として`;

      map.set(order.userName, {
        name: order.userName,
        orderCount,
        totalAmount,
        title,
      });
    });

    return (Object.keys(template) as UserCategory[]).map(group => {
      const rows = Array.from(template[group].values()).sort((a, b) =>
        a.name.localeCompare(b.name, 'ja'),
      );
      const totalAmount = rows.reduce((sum, row) => sum + row.totalAmount, 0);
      return {
        group,
        rows,
        totalAmount,
      };
    });
  }, [monthlyOrders, targetMonth, targetYear]);

  const overallTotal = useMemo(
    () => summaryByGroup.reduce((sum, group) => sum + group.totalAmount, 0),
    [summaryByGroup],
  );

  const handleMonthChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedMonth(event.target.value);
  };

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 2, md: 3 } }}>
      <Container maxWidth="lg" sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={3}
          justifyContent="space-between"
          alignItems={{ md: 'center' }}
        >
          <Box>
            <Typography variant="h4" component="h1" fontWeight={700} color="warning.dark">
              いそかつバリスタボード 集計
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              キャッシュレス決済の月次精算に向けた注文履歴集計一覧です。
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="対象月"
              type="month"
              value={selectedMonth}
              onChange={handleMonthChange}
              size="small"
            />
            <Button variant="outlined" color="warning" href="/coffee-shop">
              注文受付ページへ
            </Button>
          </Stack>
        </Stack>

        <Card variant="outlined">
          <CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
              <Chip
                icon={<AssessmentRoundedIcon />}
                label={`${selectedMonth} の累計金額: ${overallTotal.toLocaleString()}円`}
                color="warning"
                size="medium"
              />
              <Typography variant="body2" color="text.secondary">
                ※ 1注文あたり {UNIT_PRICE} 円で計算
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        {summaryByGroup.map(({ group, rows, totalAmount }) => (
          <Card key={group} elevation={3}>
            <CardContent>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems={{ sm: 'center' }}
                justifyContent="space-between"
              >
                <Typography variant="h6" fontWeight={700} color="warning.dark">
                  {GROUP_LABEL[group]}
                </Typography>
                <Chip
                  label={`合計 ${totalAmount.toLocaleString()} 円`}
                  color={rows.length > 0 ? 'warning' : 'default'}
                  variant={rows.length > 0 ? 'filled' : 'outlined'}
                />
              </Stack>
              <Divider sx={{ my: 2 }} />

              {rows.length === 0 ? (
                <Alert severity="info">該当する注文はありません。</Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>タイトル</TableCell>
                        <TableCell>注文者</TableCell>
                        <TableCell align="right">注文数</TableCell>
                        <TableCell align="right">金額 (円)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map(row => (
                        <TableRow key={`${group}-${row.name}`}>
                          <TableCell>{row.title}</TableCell>
                          <TableCell>{row.name}</TableCell>
                          <TableCell align="right">{row.orderCount.toLocaleString()}</TableCell>
                          <TableCell align="right">{row.totalAmount.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        ))}

        {summaryByGroup.every(group => group.rows.length === 0) ? (
          <Alert severity="info">
            選択した月の注文履歴がありません。注文受付ページで記録されると、ここに集計が表示されます。
          </Alert>
        ) : null}
      </Container>
    </Box>
  );
};

export default CoffeeShopSummaryPage;
